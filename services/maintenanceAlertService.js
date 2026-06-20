const db = require("../lib/db");
const maintenanceSchedulerService = require("./maintenanceSchedulerService");
const maintenanceService = require("./maintenanceService");
const { normalizePlate } = require("../utils/plate");

const ALERT_STATUSES = new Set(["upcoming", "due", "overdue"]);

const TYPE_SLUG = {
  engine_oil: "motor-yagi",
  oil_filter: "yag-filtresi",
  air_filter: "hava-filtresi",
  fuel_filter: "yakit-filtresi",
  brake_pads: "fren-balatasi",
  brake_discs: "fren-diski",
  battery: "aku",
  tires: "lastik",
  periodic_maintenance: "periyodik-bakim",
  general_repair: "genel-onarim",
  inspection: "muayene",
  other: "diger",
  yag_bakimi: "yag-bakimi",
  yag: "motor-yagi",
  lastik: "lastik",
  fren: "fren",
  muayene: "muayene",
  sigorta: "sigorta",
  periyodik: "periyodik-bakim",
  diger: "diger",
};

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function typeSlug(maintenanceType) {
  if (!maintenanceType) return "bakim";
  return TYPE_SLUG[maintenanceType] || String(maintenanceType).replace(/_/g, "-");
}

function buildSourceKey(schedule) {
  const plateNorm = normalizePlate(schedule.plate || "");
  const slug = typeSlug(schedule.maintenance_type);
  const severity = schedule.status;
  return `${plateNorm || "unknown"}-${slug}-${severity}`;
}

function buildMessage(schedule) {
  const plate = schedule.plate || "—";
  const label =
    schedule.maintenance_type_label || maintenanceService.typeLabel(schedule.maintenance_type);

  if (schedule.status === "overdue") {
    return `${plate} için ${label} bakımı gecikti.`;
  }
  if (schedule.status === "due") {
    return `${plate} için ${label} günü geldi.`;
  }
  if (schedule.status === "upcoming") {
    return `${plate} için ${label} bakımı yaklaşıyor.`;
  }
  return `${plate} için ${label}`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    vehicle_id: row.vehicle_id != null ? String(row.vehicle_id) : null,
    plate: row.plate,
    maintenance_type: row.maintenance_type,
    maintenance_type_label: maintenanceService.typeLabel(row.maintenance_type),
    severity: row.severity,
    message: row.message,
    status: row.status,
    source_key: row.source_key,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    read_at: row.read_at,
  };
}

function generateMaintenanceAlerts(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const report = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref);
  const candidates = (report.schedules || []).filter((row) => ALERT_STATUSES.has(row.status));

  let created = 0;
  const insert = db.prepare(`
    INSERT INTO maintenance_alerts (
      vehicle_id, plate, maintenance_type, severity, message, status, source_key
    ) VALUES (?, ?, ?, ?, ?, 'unread', ?)
  `);

  for (const schedule of candidates) {
    const source_key = buildSourceKey(schedule);
    const existing = db.prepare("SELECT id FROM maintenance_alerts WHERE source_key = ?").get(source_key);
    if (existing) continue;

    try {
      insert.run(
        schedule.vehicle_id || null,
        schedule.plate || null,
        schedule.maintenance_type,
        schedule.status,
        buildMessage(schedule),
        source_key
      );
      created += 1;
    } catch (err) {
      if (!String(err.message || "").includes("UNIQUE")) throw err;
    }
  }

  return {
    created,
    scanned: candidates.length,
    unread_count: getUnreadMaintenanceAlertCount(),
  };
}

function getUnreadMaintenanceAlertCount() {
  return db.prepare("SELECT COUNT(*) AS c FROM maintenance_alerts WHERE status = 'unread'").get().c;
}

function listMaintenanceAlerts(filters = {}) {
  const filter = String(filters.filter || filters.status || "all").trim().toLowerCase();
  let sql = "SELECT * FROM maintenance_alerts WHERE 1=1";
  const params = [];

  if (filter === "unread") {
    sql += " AND status = 'unread'";
  } else if (ALERT_STATUSES.has(filter)) {
    sql += " AND severity = ?";
    params.push(filter);
  }

  if (filters.vehicle_id) {
    sql += " AND vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }

  sql += ` ORDER BY
    CASE severity WHEN 'overdue' THEN 0 WHEN 'due' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,
    datetime(created_at) DESC,
    id DESC`;

  return db.prepare(sql).all(...params).map(mapRow);
}

function getMaintenanceAlertById(id) {
  const row = db.prepare("SELECT * FROM maintenance_alerts WHERE id = ?").get(Number(id));
  return mapRow(row);
}

function markMaintenanceAlertRead(id) {
  const existing = getMaintenanceAlertById(id);
  if (!existing) return null;
  if (existing.status === "read") return existing;

  db.prepare(
    `UPDATE maintenance_alerts
     SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(Number(id));

  return getMaintenanceAlertById(id);
}

function buildMaintenanceAlertPayload(filters = {}, referenceDate = new Date()) {
  generateMaintenanceAlerts(referenceDate);
  const alerts = listMaintenanceAlerts(filters);
  return {
    unread_count: getUnreadMaintenanceAlertCount(),
    alerts,
  };
}

module.exports = {
  ALERT_STATUSES,
  TYPE_SLUG,
  buildSourceKey,
  buildMessage,
  generateMaintenanceAlerts,
  listMaintenanceAlerts,
  getMaintenanceAlertById,
  markMaintenanceAlertRead,
  getUnreadMaintenanceAlertCount,
  buildMaintenanceAlertPayload,
  mapRow,
};
