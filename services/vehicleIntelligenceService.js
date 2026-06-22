const db = require("../lib/db");
const complianceStatusService = require("./complianceStatusService");
const maintenanceService = require("./maintenanceService");
const maintenanceSchedulerService = require("./maintenanceSchedulerService");
const tireService = require("./tireService");
const tireHistoryService = require("./tireHistoryService");
const tireSeasonalSchedulerService = require("./tireSeasonalSchedulerService");
const tireAlertService = require("./tireAlertService");
const auditLogService = require("./auditLogService");
const profitService = require("./profitService");

const MAINTENANCE_SEVERITY = { overdue: 0, due: 1, upcoming: 2, ok: 3, unknown: 4 };

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? new Date(ref.getTime()) : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function formatDateKey(ref) {
  const d = normalizeRefDate(ref);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoIso(ref, days) {
  const d = normalizeRefDate(ref);
  d.setDate(d.getDate() - days);
  return formatDateKey(d);
}

function safeGetVehicle(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) return null;
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) || null;
}

function listVehicles(options = {}) {
  let vehicles = db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
  const plateFilter = options.plate ? String(options.plate).trim().toLowerCase() : "";
  if (plateFilter) {
    vehicles = vehicles.filter((v) => String(v.plate || "").toLowerCase().includes(plateFilter));
  }
  return vehicles;
}

function auditMatchesVehicle(row, vehicleId) {
  const meta = row?.metadata;
  if (!meta || meta.vehicle_id == null) return false;
  return Number(meta.vehicle_id) === Number(vehicleId);
}

function buildComplianceSection(vehicleId, complianceReport) {
  const scoreRow =
    (complianceReport.vehicle_scores || []).find((s) => Number(s.vehicle_id) === Number(vehicleId)) || {};
  const vehicleRecords = (complianceReport.records || []).filter(
    (r) => Number(r.vehicle_id) === Number(vehicleId)
  );
  const counts = { active: 0, warning: 0, critical: 0, expired: 0 };
  vehicleRecords.forEach((r) => {
    if (Object.prototype.hasOwnProperty.call(counts, r.status)) counts[r.status] += 1;
  });

  let nearest = null;
  vehicleRecords.forEach((r) => {
    if (r.days_remaining == null) return;
    if (!nearest || r.days_remaining < nearest.days_remaining) nearest = r;
  });

  return {
    status: scoreRow.status || "unknown",
    score: scoreRow.score ?? null,
    active: counts.active,
    warning: counts.warning,
    critical: counts.critical,
    expired: counts.expired,
    nearest_expiration_date: nearest?.expiry_date ? String(nearest.expiry_date).slice(0, 10) : null,
    nearest_expiration_days: nearest?.days_remaining ?? null,
  };
}

function buildMaintenanceSection(vehicleId, scheduleReport, historyPayload) {
  const history =
    historyPayload ||
    (() => {
      try {
        return maintenanceService.getVehicleMaintenanceHistory(vehicleId);
      } catch {
        return {
          summary: {
            total_records: 0,
            total_cost: 0,
            last_maintenance_date: null,
            last_odometer_km: null,
          },
        };
      }
    })();

  const schedules = (scheduleReport?.schedules || []).filter(
    (s) => Number(s.vehicle_id) === Number(vehicleId)
  );
  const counts = { upcoming: 0, due: 0, overdue: 0 };
  let worst = schedules.length ? "ok" : "unknown";

  schedules.forEach((s) => {
    if (Object.prototype.hasOwnProperty.call(counts, s.status)) counts[s.status] += 1;
    if (
      Object.prototype.hasOwnProperty.call(MAINTENANCE_SEVERITY, s.status) &&
      MAINTENANCE_SEVERITY[s.status] < MAINTENANCE_SEVERITY[worst]
    ) {
      worst = s.status;
    }
  });

  if (!schedules.length && history.summary?.total_records > 0) worst = "ok";

  return {
    status: worst,
    total_records: history.summary?.total_records || 0,
    total_cost: history.summary?.total_cost || 0,
    last_maintenance_date: history.summary?.last_maintenance_date || null,
    last_odometer_km: history.summary?.last_odometer_km ?? null,
    upcoming: counts.upcoming,
    due: counts.due,
    overdue: counts.overdue,
  };
}

function buildTireSection(vehicleId, seasonalReport, alertsPayload, tireHistoryPayload) {
  const seasonal = (seasonalReport?.vehicles || []).find(
    (v) => Number(v.vehicle_id) === Number(vehicleId)
  );

  let tireSummary = { total_records: 0, total_quantity: 0, on_vehicle: 0, in_storage: 0, total_cost: 0 };
  try {
    tireSummary = tireService.getTireSummary({ vehicle_id: vehicleId });
  } catch {
    /* safe fallback */
  }

  let history = tireHistoryPayload;
  if (!history) {
    try {
      history = tireHistoryService.getVehicleTireHistory(vehicleId);
    } catch {
      history = { records: [], summary: { total_cost: 0 } };
    }
  }

  const lastChangeDate = history.records?.[0]?.change_date
    ? String(history.records[0].change_date).slice(0, 10)
    : null;

  const alertCount = (alertsPayload?.alerts || []).filter(
    (a) => Number(a.vehicle_id) === Number(vehicleId)
  ).length;

  return {
    seasonal_status: seasonal?.status || "unknown",
    total_records: tireSummary.total_records || 0,
    total_quantity: tireSummary.total_quantity || 0,
    on_vehicle_quantity: tireSummary.on_vehicle || 0,
    in_storage_quantity: tireSummary.in_storage || 0,
    last_change_date: lastChangeDate,
    alert_count: alertCount,
  };
}

function buildAuditSection(vehicleId, auditLogs) {
  const vehicleLogs = (auditLogs || []).filter((row) => auditMatchesVehicle(row, vehicleId));
  const latest = vehicleLogs[0] || null;

  return {
    events_30d: vehicleLogs.length,
    latest_activity_date: latest?.created_at ? String(latest.created_at).slice(0, 10) : null,
    latest_activity_summary: latest?.summary || null,
  };
}

function buildFinanceSection(profitRow, tireCost = 0) {
  const legacy = profitRow
    ? profitService.toLegacyRow(profitRow)
    : {
        income: 0,
        totalExpense: 0,
        fuel: 0,
        hgs: 0,
        maintenance: 0,
        netProfit: 0,
      };

  return {
    total_income: legacy.income || 0,
    total_expense: legacy.totalExpense || 0,
    fuel_cost: legacy.fuel || 0,
    hgs_cost: legacy.hgs || 0,
    maintenance_cost: legacy.maintenance || 0,
    tire_cost: tireCost || 0,
    net_profit: legacy.netProfit || 0,
  };
}

function generateSignals(plate, compliance, maintenance, tire, finance) {
  const signals = [];
  const p = plate || "Araç";

  if (compliance.expired > 0) {
    signals.push({ level: "critical", message: `${p} için süresi geçmiş evrak bulunuyor.` });
  } else if (compliance.critical > 0 || compliance.status === "critical") {
    signals.push({ level: "critical", message: `${p} için kritik uygunluk riski bulunuyor.` });
  } else if (compliance.warning > 0 || compliance.status === "warning") {
    signals.push({ level: "warning", message: `${p} için yaklaşan uygunluk uyarısı bulunuyor.` });
  }

  if (maintenance.overdue > 0 || maintenance.status === "overdue") {
    signals.push({ level: "critical", message: `${p} için bakım gecikmiş.` });
  } else if (maintenance.due > 0 || maintenance.status === "due") {
    signals.push({ level: "warning", message: `${p} için bakım vadesi geldi.` });
  } else if (maintenance.upcoming > 0 || maintenance.status === "upcoming") {
    signals.push({ level: "info", message: `${p} için yaklaşan bakım planı var.` });
  }

  if (tire.seasonal_status === "mismatch") {
    signals.push({ level: "critical", message: `${p} lastik sezon uyumsuzluğu taşıyor.` });
  } else if (tire.seasonal_status === "attention") {
    signals.push({ level: "warning", message: `${p} için lastik sezon takibi gerekiyor.` });
  } else if (tire.seasonal_status === "unknown") {
    signals.push({ level: "info", message: `${p} için lastik sezon durumu belirsiz.` });
  }

  if (finance.net_profit < 0) {
    signals.push({ level: "critical", message: `${p} zarar üretiyor (net ${finance.net_profit.toLocaleString("tr-TR")} ₺).` });
  } else if (finance.net_profit === 0 && finance.total_income > 0) {
    signals.push({ level: "warning", message: `${p} gelir-gider dengesinde (net sıfır).` });
  } else if (finance.total_income === 0 && finance.total_expense === 0) {
    signals.push({
      level: "info",
      message: `${p} için finans verisi eksik veya sıfır.`,
    });
  }

  return signals;
}

function buildVehicleIntelligenceObject(vehicle, context) {
  const vehicleId = vehicle.id;
  const profitRow =
    (context.profitRows || []).find((r) => Number(r.vehicleId) === Number(vehicleId)) || null;

  let tireHistoryPayload = null;
  if (context.tireHistoryCache?.has(vehicleId)) {
    tireHistoryPayload = context.tireHistoryCache.get(vehicleId);
  }

  let maintenanceHistoryPayload = null;
  if (context.maintenanceHistoryCache?.has(vehicleId)) {
    maintenanceHistoryPayload = context.maintenanceHistoryCache.get(vehicleId);
  }

  if (!tireHistoryPayload) {
    try {
      tireHistoryPayload = tireHistoryService.getVehicleTireHistory(vehicleId);
    } catch {
      tireHistoryPayload = { records: [], summary: { total_cost: 0 } };
    }
  }

  const compliance = buildComplianceSection(vehicleId, context.complianceReport);
  const maintenance = buildMaintenanceSection(
    vehicleId,
    context.scheduleReport,
    maintenanceHistoryPayload
  );
  const tire = buildTireSection(
    vehicleId,
    context.seasonalReport,
    context.alertsPayload,
    tireHistoryPayload
  );
  const audit = buildAuditSection(vehicleId, context.auditLogs);
  const finance = buildFinanceSection(profitRow, tireHistoryPayload.summary?.total_cost || 0);
  const signals = generateSignals(vehicle.plate, compliance, maintenance, tire, finance);

  return {
    vehicle_id: String(vehicleId),
    plate: vehicle.plate,
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      type: vehicle.type || null,
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: vehicle.year || null,
      current_km: vehicle.current_km ?? vehicle.km ?? null,
    },
    compliance,
    maintenance,
    tire,
    audit,
    finance,
    signals,
  };
}

function buildFleetContext(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  let complianceReport = { records: [], vehicle_scores: [] };
  let scheduleReport = { schedules: [] };
  let seasonalReport = { vehicles: [] };
  let alertsPayload = { alerts: [] };
  let auditLogs = [];
  let profitRows = [];

  try {
    complianceReport = complianceStatusService.buildStatusReport(ref);
  } catch {
    /* safe */
  }
  try {
    scheduleReport = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref);
  } catch {
    /* safe */
  }
  try {
    seasonalReport = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref);
  } catch {
    /* safe */
  }
  try {
    alertsPayload = tireAlertService.buildTireAlertPayload({}, ref);
  } catch {
    /* safe */
  }
  try {
    auditLogs = auditLogService.listAuditLogs({
      date_from: daysAgoIso(ref, 30),
      date_to: formatDateKey(ref),
      limit: 500,
    });
  } catch {
    /* safe */
  }
  try {
    profitRows = profitService.getVehicleProfitRows();
  } catch {
    /* safe */
  }

  return {
    referenceDate: ref,
    complianceReport,
    scheduleReport,
    seasonalReport,
    alertsPayload,
    auditLogs,
    profitRows,
    maintenanceHistoryCache: new Map(),
    tireHistoryCache: new Map(),
  };
}

function sortVehicleIntelligence(vehicles) {
  return [...vehicles].sort((a, b) => {
    const aCritical = a.signals.some((s) => s.level === "critical") ? 0 : 1;
    const bCritical = b.signals.some((s) => s.level === "critical") ? 0 : 1;
    if (aCritical !== bCritical) return aCritical - bCritical;

    const aWarning = a.signals.some((s) => s.level === "warning") ? 0 : 1;
    const bWarning = b.signals.some((s) => s.level === "warning") ? 0 : 1;
    if (aWarning !== bWarning) return aWarning - bWarning;

    if (a.finance.net_profit !== b.finance.net_profit) {
      return a.finance.net_profit - b.finance.net_profit;
    }

    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function buildFleetSummary(vehicles) {
  return {
    total_vehicles: vehicles.length,
    vehicles_with_critical_signals: vehicles.filter((v) => v.signals.some((s) => s.level === "critical"))
      .length,
    vehicles_with_warning_signals: vehicles.filter((v) => v.signals.some((s) => s.level === "warning"))
      .length,
    vehicles_profitable: vehicles.filter((v) => v.finance.net_profit > 0).length,
    vehicles_unprofitable: vehicles.filter((v) => v.finance.net_profit < 0).length,
    total_income: vehicles.reduce((sum, v) => sum + (v.finance.total_income || 0), 0),
    total_expense: vehicles.reduce((sum, v) => sum + (v.finance.total_expense || 0), 0),
    net_profit: vehicles.reduce((sum, v) => sum + (v.finance.net_profit || 0), 0),
  };
}

function buildVehicleIntelligence(vehicleId, options = {}) {
  const vehicle = safeGetVehicle(vehicleId);
  if (!vehicle) return null;

  const context = buildFleetContext(options.referenceDate || options.date || new Date());
  return buildVehicleIntelligenceObject(vehicle, context);
}

function buildFleetVehicleIntelligence(options = {}) {
  const context = buildFleetContext(options.referenceDate || options.date || new Date());
  const vehicles = listVehicles(options).map((vehicle) => buildVehicleIntelligenceObject(vehicle, context));
  const sorted = sortVehicleIntelligence(vehicles);

  return {
    reference_date: formatDateKey(context.referenceDate),
    summary: buildFleetSummary(sorted),
    vehicles: sorted,
  };
}

module.exports = {
  buildVehicleIntelligence,
  buildFleetVehicleIntelligence,
  buildComplianceSection,
  buildMaintenanceSection,
  buildTireSection,
  buildAuditSection,
  buildFinanceSection,
  generateSignals,
  sortVehicleIntelligence,
};
