const db = require("../lib/db");
const documentService = require("./documentService");
const complianceNotificationService = require("./complianceNotificationService");
const maintenanceService = require("./maintenanceService");
const maintenanceAlertService = require("./maintenanceAlertService");
const tireService = require("./tireService");
const tireHistoryService = require("./tireHistoryService");
const tireAlertService = require("./tireAlertService");
const auditLogService = require("./auditLogService");

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const VALID_SOURCES = new Set([
  "compliance",
  "maintenance",
  "maintenance_alert",
  "tire",
  "tire_history",
  "tire_alert",
  "audit",
  "finance",
  "system",
]);

const VALID_SEVERITIES = new Set(["info", "warning", "critical", "success", "neutral"]);

function safeGetVehicle(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) return null;
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) || null;
}

function splitDateTime(value) {
  if (!value) return { event_date: null, event_time: null };
  const raw = String(value).trim();
  if (!raw) return { event_date: null, event_time: null };
  const datePart = raw.slice(0, 10);
  const timePart = raw.length > 10 ? raw.slice(11, 19) : null;
  return { event_date: datePart, event_time: timePart || null };
}

function makeEvent({
  id,
  vehicle_id,
  plate,
  event_date,
  event_time,
  source,
  type,
  severity,
  title,
  description,
  amount = null,
  odometer_km = null,
  reference_id = null,
  metadata = {},
}) {
  const dateBits = event_date ? { event_date, event_time: event_time || null } : splitDateTime(event_time);
  const finalDate = event_date || dateBits.event_date;
  const finalTime = event_time || dateBits.event_time;

  return {
    id: String(id),
    vehicle_id: String(vehicle_id),
    plate: plate || "",
    event_date: finalDate,
    event_time: finalTime,
    source,
    type,
    severity: VALID_SEVERITIES.has(severity) ? severity : "info",
    title,
    description,
    amount: amount != null ? Number(amount) : null,
    odometer_km: odometer_km != null ? Number(odometer_km) : null,
    reference_id: reference_id != null ? String(reference_id) : null,
    metadata,
  };
}

function complianceSeverity(status) {
  if (status === "expired" || status === "critical") return "critical";
  if (status === "warning") return "warning";
  if (status === "active" || status === "ok") return "success";
  return "info";
}

function maintenanceAlertSeverity(severity) {
  if (severity === "overdue") return "critical";
  if (severity === "due") return "warning";
  return "info";
}

function tireAlertSeverity(severity) {
  if (severity === "mismatch") return "critical";
  if (severity === "attention") return "warning";
  return "info";
}

function auditSeverity(action) {
  if (action === "delete") return "warning";
  if (action === "import") return "info";
  if (action === "create") return "success";
  return "info";
}

function auditMatchesVehicle(row, vehicleId) {
  const meta = row?.metadata;
  if (!meta || meta.vehicle_id == null) return false;
  return Number(meta.vehicle_id) === Number(vehicleId);
}

function collectComplianceEvents(vehicleId, plate, ref = new Date()) {
  const events = [];

  try {
    const docs = documentService.listByVehicle(vehicleId, ref);
    docs.forEach((doc) => {
      const label = doc.type_label || doc.title || "Evrak";
      const issueDate = doc.issue_date || doc.created_at;
      if (issueDate) {
        const bits = splitDateTime(issueDate);
        events.push(
          makeEvent({
            id: `compliance:doc:${doc.id}:issue`,
            vehicle_id: vehicleId,
            plate,
            event_date: bits.event_date,
            event_time: bits.event_time,
            source: "compliance",
            type: "document",
            severity: "success",
            title: "Evrak / Uygunluk",
            description: `${label} kaydı eklendi.`,
            reference_id: doc.id,
            metadata: { document_type: doc.document_type, status: doc.status },
          })
        );
      }

      if (doc.expiry_date) {
        const bits = splitDateTime(doc.expiry_date);
        const statusText =
          doc.status === "expired"
            ? "süresi geçti"
            : doc.status === "critical"
              ? "kritik sürede"
              : doc.status === "warning"
                ? "bitiş tarihi yaklaşıyor"
                : "geçerli";
        events.push(
          makeEvent({
            id: `compliance:doc:${doc.id}:expiry`,
            vehicle_id: vehicleId,
            plate,
            event_date: bits.event_date,
            event_time: bits.event_time,
            source: "compliance",
            type: "document",
            severity: complianceSeverity(doc.status),
            title: "Evrak / Uygunluk",
            description: `${label} ${statusText}.`,
            reference_id: doc.id,
            metadata: { document_type: doc.document_type, status: doc.status, days_left: doc.daysLeft },
          })
        );
      }
    });
  } catch {
    /* safe */
  }

  try {
    complianceNotificationService.generateComplianceNotifications(ref);
    const notifications = complianceNotificationService
      .listNotifications("all")
      .filter((row) => Number(row.vehicle_id) === Number(vehicleId));
    notifications.forEach((note) => {
      const bits = splitDateTime(note.created_at);
      events.push(
        makeEvent({
          id: `compliance:notification:${note.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "compliance",
          type: "alert",
          severity: complianceSeverity(note.severity),
          title: "Uygunluk bildirimi",
          description: note.message || "Uygunluk bildirimi oluşturuldu.",
          reference_id: note.id,
          metadata: { document_id: note.document_id, severity: note.severity },
        })
      );
    });
  } catch {
    /* safe */
  }

  return events;
}

function collectMaintenanceEvents(vehicleId, plate) {
  const events = [];

  try {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleId);
    (history.records || []).forEach((row) => {
      const bits = splitDateTime(row.maintenance_date || row.created_at);
      events.push(
        makeEvent({
          id: `maintenance:record:${row.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "maintenance",
          type: "service",
          severity: "success",
          title: "Bakım kaydı",
          description: `${row.maintenance_type_label || "Bakım"} bakımı yapıldı.`,
          amount: row.cost,
          odometer_km: row.odometer_km,
          reference_id: row.id,
          metadata: { maintenance_type: row.maintenance_type, vendor: row.vendor },
        })
      );
    });
  } catch {
    /* safe */
  }

  try {
    const alerts = maintenanceAlertService.listMaintenanceAlerts({ vehicle_id: vehicleId });
    alerts.forEach((alert) => {
      const bits = splitDateTime(alert.created_at);
      events.push(
        makeEvent({
          id: `maintenance_alert:${alert.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "maintenance_alert",
          type: "alert",
          severity: maintenanceAlertSeverity(alert.severity),
          title: "Bakım uyarısı",
          description: alert.message || `${alert.maintenance_type_label || "Bakım"} uyarısı.`,
          reference_id: alert.id,
          metadata: { maintenance_type: alert.maintenance_type, severity: alert.severity },
        })
      );
    });
  } catch {
    /* safe */
  }

  return events;
}

function collectTireEvents(vehicleId, plate) {
  const events = [];

  try {
    const status = tireService.getVehicleTireStatus(vehicleId);
    (status.records || []).forEach((row) => {
      const bits = splitDateTime(row.purchase_date || row.created_at);
      events.push(
        makeEvent({
          id: `tire:record:${row.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "tire",
          type: "tire",
          severity: "info",
          title: "Lastik kaydı",
          description: `${row.season_label || "Lastik"} · ${row.status_label || row.status} durumda.`,
          amount: row.cost,
          reference_id: row.id,
          metadata: { season: row.season, status: row.status, quantity: row.quantity },
        })
      );
    });
  } catch {
    /* safe */
  }

  try {
    const history = tireHistoryService.getVehicleTireHistory(vehicleId);
    (history.records || []).forEach((row) => {
      const bits = splitDateTime(row.change_date || row.created_at);
      events.push(
        makeEvent({
          id: `tire_history:${row.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "tire_history",
          type: "tire",
          severity: row.change_type === "disposed" ? "warning" : "success",
          title: "Lastik işlemi",
          description: `${row.change_type_label || "Lastik işlemi"}${row.season_label ? ` · ${row.season_label}` : ""}.`,
          amount: row.cost,
          odometer_km: row.odometer_km,
          reference_id: row.id,
          metadata: { change_type: row.change_type, season: row.season },
        })
      );
    });
  } catch {
    /* safe */
  }

  try {
    const alerts = tireAlertService.listTireAlerts({ vehicle_id: vehicleId });
    alerts.forEach((alert) => {
      const bits = splitDateTime(alert.created_at);
      events.push(
        makeEvent({
          id: `tire_alert:${alert.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "tire_alert",
          type: "alert",
          severity: tireAlertSeverity(alert.severity),
          title: "Lastik uyarısı",
          description: alert.message || "Lastik uyarısı oluşturuldu.",
          reference_id: alert.id,
          metadata: { severity: alert.severity, current_season: alert.current_season },
        })
      );
    });
  } catch {
    /* safe */
  }

  return events;
}

function collectAuditEvents(vehicleId, plate) {
  const events = [];
  try {
    const logs = auditLogService.listAuditLogs({ limit: MAX_LIMIT });
    logs
      .filter((row) => auditMatchesVehicle(row, vehicleId))
      .forEach((row) => {
        const bits = splitDateTime(row.created_at);
        events.push(
          makeEvent({
            id: `audit:${row.id}`,
            vehicle_id: vehicleId,
            plate,
            event_date: bits.event_date,
            event_time: bits.event_time,
            source: "audit",
            type: "audit",
            severity: auditSeverity(row.action),
            title: "İşlem geçmişi",
            description: row.summary || `${row.module_label || row.module || "Kayıt"} ${row.action_label || row.action}.`,
            reference_id: row.id,
            metadata: {
              module: row.module,
              entity_type: row.entity_type,
              action: row.action,
            },
          })
        );
      });
  } catch {
    /* safe */
  }
  return events;
}

function collectFinanceEvents(vehicleId, plate) {
  const events = [];
  try {
    const rows = db
      .prepare(
        `SELECT id, vehicle_id, type, category, category_slug, amount, note, date, created_at
         FROM transactions WHERE vehicle_id = ? ORDER BY date DESC, id DESC LIMIT ?`
      )
      .all(vehicleId, MAX_LIMIT);

    rows.forEach((row) => {
      const bits = splitDateTime(row.date || row.created_at);
      const isIncome = row.type === "income";
      events.push(
        makeEvent({
          id: `finance:tx:${row.id}`,
          vehicle_id: vehicleId,
          plate,
          event_date: bits.event_date,
          event_time: bits.event_time,
          source: "finance",
          type: isIncome ? "income" : "expense",
          severity: isIncome ? "success" : "neutral",
          title: "Finans hareketi",
          description: `${isIncome ? "Gelir" : "Gider"} · ${row.category || row.category_slug || "Kayıt"}${row.note ? ` · ${row.note}` : ""}.`,
          amount: row.amount,
          reference_id: row.id,
          metadata: { category: row.category, category_slug: row.category_slug, tx_type: row.type },
        })
      );
    });
  } catch {
    /* safe */
  }
  return events;
}

function collectAllEvents(vehicleId, plate, options = {}) {
  const ref = options.referenceDate || options.date || new Date();
  return [
    ...collectComplianceEvents(vehicleId, plate, ref),
    ...collectMaintenanceEvents(vehicleId, plate),
    ...collectTireEvents(vehicleId, plate),
    ...collectAuditEvents(vehicleId, plate),
    ...collectFinanceEvents(vehicleId, plate),
  ];
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aHasDate = Boolean(a.event_date);
    const bHasDate = Boolean(b.event_date);
    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;
    if (!aHasDate && !bHasDate) return 0;

    const aKey = `${a.event_date} ${a.event_time || "00:00:00"}`;
    const bKey = `${b.event_date} ${b.event_time || "00:00:00"}`;
    if (aKey !== bKey) return bKey.localeCompare(aKey);

    return String(b.id).localeCompare(String(a.id));
  });
}

function applyFilters(events, options = {}) {
  let filtered = [...events];

  if (options.source && VALID_SOURCES.has(String(options.source))) {
    filtered = filtered.filter((row) => row.source === options.source);
  }

  if (options.severity && VALID_SEVERITIES.has(String(options.severity))) {
    filtered = filtered.filter((row) => row.severity === options.severity);
  }

  if (options.date_from) {
    const from = String(options.date_from).slice(0, 10);
    filtered = filtered.filter((row) => row.event_date && row.event_date >= from);
  }

  if (options.date_to) {
    const to = String(options.date_to).slice(0, 10);
    filtered = filtered.filter((row) => row.event_date && row.event_date <= to);
  }

  return filtered;
}

function buildEventSummary(events) {
  const dated = events.filter((row) => row.event_date);
  const latest = dated[0] || null;

  return {
    total_events: events.length,
    critical_events: events.filter((row) => row.severity === "critical").length,
    warning_events: events.filter((row) => row.severity === "warning").length,
    maintenance_events: events.filter((row) =>
      ["maintenance", "maintenance_alert"].includes(row.source)
    ).length,
    tire_events: events.filter((row) => ["tire", "tire_history", "tire_alert"].includes(row.source))
      .length,
    compliance_events: events.filter((row) => row.source === "compliance").length,
    audit_events: events.filter((row) => row.source === "audit").length,
    finance_events: events.filter((row) => row.source === "finance").length,
    latest_event_date: latest?.event_date || null,
    finance_coverage: events.some((row) => row.source === "finance") ? "partial" : "none",
  };
}

function buildVehicleTimeline(vehicleId, options = {}) {
  const vehicle = safeGetVehicle(vehicleId);
  if (!vehicle) return null;

  const limit = Math.min(
    Math.max(Number(options.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const allEvents = collectAllEvents(vehicle.id, vehicle.plate, options);
  const filtered = applyFilters(allEvents, options);
  const sorted = sortEvents(filtered);
  const summary = buildEventSummary(sorted);

  return {
    vehicle_id: String(vehicle.id),
    plate: vehicle.plate,
    summary,
    events: sorted.slice(0, limit),
  };
}

function buildFleetTimelineSummary(options = {}) {
  const vehicles = db.prepare("SELECT id, plate FROM vehicles ORDER BY plate ASC").all();
  const rows = vehicles.map((vehicle) => {
    const timeline = buildVehicleTimeline(vehicle.id, {
      ...options,
      limit: options.fleet_event_limit || MAX_LIMIT,
    });
    return {
      vehicle_id: String(vehicle.id),
      plate: vehicle.plate,
      total_events: timeline?.summary?.total_events || 0,
      critical_events: timeline?.summary?.critical_events || 0,
      warning_events: timeline?.summary?.warning_events || 0,
      latest_event_date: timeline?.summary?.latest_event_date || null,
    };
  });

  const withEvents = rows.filter((row) => row.total_events > 0);

  return {
    summary: {
      vehicles_with_events: withEvents.length,
      total_events: rows.reduce((sum, row) => sum + row.total_events, 0),
      critical_events: rows.reduce((sum, row) => sum + row.critical_events, 0),
      warning_events: rows.reduce((sum, row) => sum + row.warning_events, 0),
    },
    vehicles: rows,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  VALID_SOURCES,
  VALID_SEVERITIES,
  buildVehicleTimeline,
  buildFleetTimelineSummary,
  collectAllEvents,
  applyFilters,
  sortEvents,
  buildEventSummary,
  makeEvent,
};
