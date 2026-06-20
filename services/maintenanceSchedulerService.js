const db = require("../lib/db");
const maintenanceService = require("./maintenanceService");

const STATUS_RANK = { unknown: 0, ok: 1, upcoming: 2, due: 3, overdue: 4 };

const STATUS_LABELS = {
  ok: "OK",
  upcoming: "Yaklaşıyor",
  due: "Günü Geldi",
  overdue: "Gecikti",
  unknown: "Bilinmiyor",
};

const DEFAULT_SCHEDULE_TEMPLATES = {
  engine_oil: { interval_km: 10000, interval_days: 365 },
  oil_filter: { interval_km: 10000, interval_days: 365 },
  air_filter: { interval_km: 20000, interval_days: 365 },
  fuel_filter: { interval_km: 20000, interval_days: 365 },
  brake_pads: { interval_km: null, interval_days: null },
  brake_discs: { interval_km: null, interval_days: null },
  battery: { interval_km: null, interval_days: null },
  tires: { interval_km: null, interval_days: null },
  periodic_maintenance: { interval_km: 10000, interval_days: 365 },
  general_repair: { interval_km: null, interval_days: null },
  inspection: { interval_km: null, interval_days: null },
  other: { interval_km: null, interval_days: null },
  yag_bakimi: { interval_km: 10000, interval_days: 365 },
  yag: { interval_km: 10000, interval_days: 365 },
  periyodik: { interval_km: 10000, interval_days: 365 },
  lastik: { interval_km: null, interval_days: null },
  fren: { interval_km: null, interval_days: null },
  muayene: { interval_km: null, interval_days: null },
  sigorta: { interval_km: null, interval_days: null },
  diger: { interval_km: null, interval_days: null },
};

function toDateStr(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  const from = new Date(`${toDateStr(fromStr)}T12:00:00`);
  const to = new Date(`${toDateStr(toStr)}T12:00:00`);
  return Math.round((to - from) / 86400000);
}

function normalizeInterval(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function getDefaultTemplate(maintenanceType) {
  return (
    DEFAULT_SCHEDULE_TEMPLATES[maintenanceType] || {
      interval_km: null,
      interval_days: null,
    }
  );
}

function resolveIntervals(vehicleId, maintenanceType, options = {}) {
  if (options.interval_km !== undefined || options.interval_days !== undefined) {
    return {
      interval_km: normalizeInterval(options.interval_km),
      interval_days: normalizeInterval(options.interval_days),
    };
  }

  const vehicleRule = db
    .prepare(
      `SELECT * FROM maintenance_schedule_rules
       WHERE vehicle_id = ? AND maintenance_type = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(Number(vehicleId), maintenanceType);

  if (vehicleRule) {
    return {
      interval_km: normalizeInterval(vehicleRule.interval_km),
      interval_days: normalizeInterval(vehicleRule.interval_days),
    };
  }

  const globalRule = db
    .prepare(
      `SELECT * FROM maintenance_schedule_rules
       WHERE vehicle_id IS NULL AND maintenance_type = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(maintenanceType);

  if (globalRule) {
    return {
      interval_km: normalizeInterval(globalRule.interval_km),
      interval_days: normalizeInterval(globalRule.interval_days),
    };
  }

  return getDefaultTemplate(maintenanceType);
}

function kmScheduleStatus(currentKm, nextDueKm) {
  if (nextDueKm == null || currentKm == null || !Number.isFinite(Number(currentKm))) return null;
  const current = Number(currentKm);
  const remaining = nextDueKm - current;
  if (current > nextDueKm) return { status: "overdue", remaining_km: remaining };
  if (current >= nextDueKm) return { status: "due", remaining_km: remaining };
  if (remaining <= 1000) return { status: "upcoming", remaining_km: remaining };
  return { status: "ok", remaining_km: remaining };
}

function dateScheduleStatus(referenceDate, nextDueDate) {
  if (!nextDueDate) return null;
  const ref = toDateStr(referenceDate);
  const days = daysBetween(ref, nextDueDate);
  if (ref > nextDueDate) return { status: "overdue", days_remaining: days };
  if (ref === nextDueDate) return { status: "due", days_remaining: 0 };
  if (days <= 30) return { status: "upcoming", days_remaining: days };
  return { status: "ok", days_remaining: days };
}

function combineScheduleStatuses(kmResult, dateResult) {
  if (!kmResult && !dateResult) {
    return { status: "unknown", remaining_km: null, days_remaining: null };
  }

  let status = "unknown";
  for (const result of [kmResult, dateResult]) {
    if (!result) continue;
    if (STATUS_RANK[result.status] > STATUS_RANK[status]) status = result.status;
  }

  return {
    status,
    remaining_km: kmResult?.remaining_km ?? null,
    days_remaining: dateResult?.days_remaining ?? null,
  };
}

function calculateScheduleStatus(schedule, currentOdometerKm, referenceDate = new Date()) {
  const kmResult = kmScheduleStatus(currentOdometerKm, schedule.next_due_km);
  const dateResult = dateScheduleStatus(referenceDate, schedule.next_due_date);
  return combineScheduleStatuses(kmResult, dateResult);
}

function calculateNextDueFromHistory(vehicleId, maintenanceType, options = {}) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) throw new Error("Araç geçersiz");

  const vehicle = db.prepare("SELECT id, plate, current_km, km FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const type = String(maintenanceType || "").trim();
  if (!type) throw new Error("Bakım türü geçersiz");

  const history = maintenanceService.listMaintenanceRecords({
    vehicle_id: id,
    maintenance_type: type,
  });
  const last = history[0] || null;
  const intervals = resolveIntervals(id, type, options);

  const last_maintenance_date = last?.maintenance_date || null;
  const last_odometer_km = last?.odometer_km ?? null;

  let next_due_km = null;
  if (intervals.interval_km != null && last_odometer_km != null) {
    next_due_km = Number(last_odometer_km) + intervals.interval_km;
  }

  let next_due_date = null;
  if (intervals.interval_days != null && last_maintenance_date) {
    next_due_date = addDays(last_maintenance_date, intervals.interval_days);
  }

  const currentKmRaw = options.currentOdometerKm ?? vehicle.current_km ?? vehicle.km;
  const currentKm =
    currentKmRaw != null && currentKmRaw !== "" && Number.isFinite(Number(currentKmRaw))
      ? Number(currentKmRaw)
      : null;

  const schedule = {
    vehicle_id: String(id),
    plate: vehicle.plate,
    maintenance_type: type,
    maintenance_type_label: maintenanceService.typeLabel(type),
    interval_km: intervals.interval_km,
    interval_days: intervals.interval_days,
    last_maintenance_date,
    last_odometer_km,
    next_due_km,
    next_due_date,
  };

  const statusInfo = calculateScheduleStatus(schedule, currentKm, options.referenceDate || new Date());
  return { ...schedule, ...statusInfo };
}

function listDistinctVehicleTypes(filters = {}) {
  let sql = `SELECT DISTINCT m.vehicle_id, m.type AS maintenance_type, v.plate
    FROM maintenance_records m
    LEFT JOIN vehicles v ON v.id = m.vehicle_id
    WHERE 1=1`;
  const params = [];
  if (filters.vehicle_id) {
    sql += " AND m.vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }
  sql += " ORDER BY v.plate ASC, m.type ASC";
  return db.prepare(sql).all(...params);
}

function buildMaintenanceScheduleReport(referenceDate = new Date(), filters = {}) {
  const pairs = listDistinctVehicleTypes(filters);
  const schedules = pairs.map((pair) => calculateNextDueFromHistory(pair.vehicle_id, pair.maintenance_type, { referenceDate }));

  schedules.sort((a, b) => {
    const rankDiff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
    if (rankDiff !== 0) return rankDiff;
    const dateA = a.next_due_date || "9999-99-99";
    const dateB = b.next_due_date || "9999-99-99";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.next_due_km ?? Number.MAX_SAFE_INTEGER) - (b.next_due_km ?? Number.MAX_SAFE_INTEGER);
  });

  const summary = { total: schedules.length, ok: 0, upcoming: 0, due: 0, overdue: 0, unknown: 0 };
  schedules.forEach((row) => {
    if (summary[row.status] != null) summary[row.status] += 1;
    else summary.unknown += 1;
  });

  return { summary, schedules };
}

function getVehicleSchedulePreview(vehicleId, limit = 5, referenceDate = new Date()) {
  const report = buildMaintenanceScheduleReport(referenceDate, { vehicle_id: vehicleId });
  return {
    summary: report.summary,
    items: report.schedules.slice(0, limit),
  };
}

function toScheduleRule(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    vehicle_id: row.vehicle_id != null ? String(row.vehicle_id) : null,
    maintenance_type: row.maintenance_type,
    interval_km: normalizeInterval(row.interval_km),
    interval_days: normalizeInterval(row.interval_days),
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

function getScheduleRuleById(id) {
  const row = db.prepare("SELECT * FROM maintenance_schedule_rules WHERE id = ?").get(id);
  return toScheduleRule(row);
}

function listScheduleRules(filters = {}) {
  let sql = "SELECT * FROM maintenance_schedule_rules WHERE 1=1";
  const params = [];
  if (filters.vehicle_id !== undefined && filters.vehicle_id !== "") {
    sql += " AND vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }
  if (filters.maintenance_type) {
    sql += " AND maintenance_type = ?";
    params.push(filters.maintenance_type);
  }
  sql += " ORDER BY COALESCE(vehicle_id, 0) ASC, maintenance_type ASC, id DESC";
  return db.prepare(sql).all(...params).map(toScheduleRule);
}

function createScheduleRule(data) {
  const maintenance_type = String(data.maintenance_type || "").trim();
  if (!maintenance_type) throw new Error("Bakım türü gerekli");

  const vehicle_id =
    data.vehicle_id == null || data.vehicle_id === "" ? null : Number(data.vehicle_id);
  if (vehicle_id != null && (!Number.isFinite(vehicle_id) || vehicle_id <= 0)) {
    throw new Error("Araç geçersiz");
  }
  if (vehicle_id != null) {
    const vehicle = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(vehicle_id);
    if (!vehicle) throw new Error("Araç bulunamadı");
  }

  const interval_km = normalizeInterval(data.interval_km);
  const interval_days = normalizeInterval(data.interval_days);
  if (interval_km == null && interval_days == null) {
    throw new Error("En az bir periyot (KM veya gün) gerekli");
  }

  const info = db
    .prepare(
      `INSERT INTO maintenance_schedule_rules (vehicle_id, maintenance_type, interval_km, interval_days)
       VALUES (?, ?, ?, ?)`
    )
    .run(vehicle_id, maintenance_type, interval_km, interval_days);
  return getScheduleRuleById(info.lastInsertRowid);
}

function updateScheduleRule(id, data) {
  const current = getScheduleRuleById(id);
  if (!current) throw new Error("Plan kuralı bulunamadı");

  const maintenance_type = String(data.maintenance_type ?? current.maintenance_type).trim();
  const vehicle_id =
    data.vehicle_id !== undefined
      ? data.vehicle_id == null || data.vehicle_id === ""
        ? null
        : Number(data.vehicle_id)
      : current.vehicle_id != null
        ? Number(current.vehicle_id)
        : null;

  if (vehicle_id != null && (!Number.isFinite(vehicle_id) || vehicle_id <= 0)) {
    throw new Error("Araç geçersiz");
  }

  const interval_km =
    data.interval_km !== undefined ? normalizeInterval(data.interval_km) : current.interval_km;
  const interval_days =
    data.interval_days !== undefined ? normalizeInterval(data.interval_days) : current.interval_days;

  if (interval_km == null && interval_days == null) {
    throw new Error("En az bir periyot (KM veya gün) gerekli");
  }

  db.prepare(
    `UPDATE maintenance_schedule_rules SET
      vehicle_id = ?, maintenance_type = ?, interval_km = ?, interval_days = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(vehicle_id, maintenance_type, interval_km, interval_days, id);

  return getScheduleRuleById(id);
}

function deleteScheduleRule(id) {
  const existing = getScheduleRuleById(id);
  if (!existing) throw new Error("Plan kuralı bulunamadı");
  db.prepare("DELETE FROM maintenance_schedule_rules WHERE id = ?").run(id);
  return existing;
}

module.exports = {
  STATUS_RANK,
  STATUS_LABELS,
  DEFAULT_SCHEDULE_TEMPLATES,
  calculateNextDueFromHistory,
  calculateScheduleStatus,
  buildMaintenanceScheduleReport,
  getVehicleSchedulePreview,
  createScheduleRule,
  updateScheduleRule,
  deleteScheduleRule,
  listScheduleRules,
  getDefaultTemplate,
  resolveIntervals,
};
