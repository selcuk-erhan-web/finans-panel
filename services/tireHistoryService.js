const db = require("../lib/db");
const { parseMoneyInput } = require("../utils/money");
const { parseDateInput } = require("../utils/date");
const { TIRE_SEASONS, TIRE_POSITIONS, TIRE_CHANGE_TYPES } = require("../lib/constants");
const { seasonLabel, positionLabel } = require("./tireService");
const auditLogService = require("./auditLogService");

const CHANGE_TYPE_LABELS = Object.fromEntries(TIRE_CHANGE_TYPES);
const VALID_CHANGE_TYPES = new Set(TIRE_CHANGE_TYPES.map(([k]) => k));
const VALID_SEASONS = new Set(TIRE_SEASONS.map(([k]) => k));
const VALID_POSITIONS = new Set(TIRE_POSITIONS.map(([k]) => k));

function changeTypeLabel(key) {
  return CHANGE_TYPE_LABELS[key] || key;
}

function auditActorFrom(ctx) {
  if (!ctx) return { actor_id: "system", actor_name: "System" };
  return {
    actor_id: ctx.actor_id || "system",
    actor_name: ctx.actor_name || "System",
  };
}

function tireHistoryActionSummary(action, record) {
  const plate = record.plate || "—";
  const changeType = changeTypeLabel(record.change_type);
  if (action === "create") return `${plate} için ${changeType} lastik değişim kaydı oluşturuldu.`;
  if (action === "update") return `${plate} için lastik değişim kaydı güncellendi.`;
  if (action === "delete") return `${plate} için lastik değişim kaydı silindi.`;
  return `${plate} lastik değişim kaydı ${action}.`;
}

function logTireHistoryAudit(action, record, auditContext) {
  if (!record) return;
  const actor = auditActorFrom(auditContext);
  auditLogService.createAuditLog({
    module: "tire",
    entity_type: "tire_change_record",
    entity_id: String(record.id),
    action,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    summary: tireHistoryActionSummary(action, record),
    metadata: {
      vehicle_id: String(record.vehicle_id),
      plate: record.plate || "",
      change_type: record.change_type,
      change_type_label: changeTypeLabel(record.change_type),
      change_date: record.change_date,
      cost: record.cost,
    },
  });
}

function toTireChangeRecord(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    vehicle_id: String(row.vehicle_id),
    plate: row.plate || "",
    tire_id: row.tire_id != null ? String(row.tire_id) : null,
    change_type: row.change_type,
    change_type_label: changeTypeLabel(row.change_type),
    change_date: row.change_date || null,
    odometer_km: row.odometer_km != null ? Number(row.odometer_km) : null,
    season: row.season || null,
    season_label: row.season ? seasonLabel(row.season) : null,
    position: row.position || "unknown",
    position_label: positionLabel(row.position || "unknown"),
    quantity: Number(row.quantity ?? 1),
    cost: row.cost != null ? Number(row.cost) : null,
    vendor: row.vendor || "",
    notes: row.notes || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

function listTireChangeRecords(filters = {}) {
  let sql = `SELECT h.*, v.plate AS vehicle_plate FROM tire_change_history h
    LEFT JOIN vehicles v ON v.id = h.vehicle_id WHERE 1=1`;
  const params = [];

  if (filters.vehicle_id) {
    sql += " AND h.vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }
  if (filters.tire_id) {
    sql += " AND h.tire_id = ?";
    params.push(Number(filters.tire_id));
  }
  if (filters.change_type) {
    sql += " AND h.change_type = ?";
    params.push(String(filters.change_type).trim());
  }
  if (filters.season) {
    sql += " AND h.season = ?";
    params.push(String(filters.season).trim());
  }
  if (filters.date_from) {
    sql += " AND h.change_date >= ?";
    params.push(String(filters.date_from).trim());
  }
  if (filters.date_to) {
    sql += " AND h.change_date <= ?";
    params.push(String(filters.date_to).trim());
  }

  sql +=
    " ORDER BY h.change_date DESC, COALESCE(h.odometer_km, 0) DESC, COALESCE(h.created_at, h.change_date) DESC, h.id DESC";

  return db
    .prepare(sql)
    .all(...params)
    .map((row) => toTireChangeRecord({ ...row, plate: row.plate || row.vehicle_plate || "" }));
}

function getTireHistorySummary(filters = {}) {
  const rows = listTireChangeRecords(filters);
  const sumQty = (pred) => rows.filter(pred).reduce((sum, r) => sum + (r.quantity || 0), 0);

  return {
    total_records: rows.length,
    total_quantity: rows.reduce((sum, r) => sum + (r.quantity || 0), 0),
    total_cost: rows.reduce((sum, r) => sum + (r.cost || 0), 0),
    installed: sumQty((r) => r.change_type === "installed"),
    removed: sumQty((r) => r.change_type === "removed"),
    seasonal_swap: sumQty((r) => r.change_type === "seasonal_swap"),
    storage_move: sumQty((r) => r.change_type === "storage_move"),
    disposed: sumQty((r) => r.change_type === "disposed"),
    replacement: sumQty((r) => r.change_type === "replacement"),
  };
}

function getTireChangeRecord(id) {
  const row = db
    .prepare(
      `SELECT h.*, v.plate AS vehicle_plate FROM tire_change_history h
       LEFT JOIN vehicles v ON v.id = h.vehicle_id WHERE h.id = ?`
    )
    .get(id);
  return toTireChangeRecord(row ? { ...row, plate: row.plate || row.vehicle_plate || "" } : null);
}

function parseOptionalCost(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = parseMoneyInput(value);
  if (n == null || n < 0) throw new Error("Maliyet geçerli değil");
  return Math.round(n);
}

function parseOptionalKm(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("KM geçerli değil");
  return Math.round(n);
}

function parseOptionalQuantity(value, fallback = 1) {
  if (value == null || String(value).trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Adet pozitif bir sayı olmalı");
  return Math.round(n);
}

function parseOptionalTireId(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Lastik kaydı geçersiz");
  const tire = db.prepare("SELECT id FROM tires WHERE id = ?").get(n);
  if (!tire) throw new Error("Lastik kaydı bulunamadı");
  return n;
}

function parseTireChangeInput(data) {
  const vehicle_id = Number(data.vehicle_id);
  if (!vehicle_id || !Number.isFinite(vehicle_id)) throw new Error("Araç seçilmeli");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const change_type = String(data.change_type || "").trim();
  if (!VALID_CHANGE_TYPES.has(change_type)) throw new Error("İşlem türü geçersiz");

  const change_date = parseDateInput(data.change_date);
  if (!change_date) throw new Error("İşlem tarihi geçersiz");

  const quantity = parseOptionalQuantity(data.quantity, 1);
  const odometer_km = data.odometer_km !== undefined ? parseOptionalKm(data.odometer_km) : null;
  const cost = data.cost !== undefined ? parseOptionalCost(data.cost) : null;
  const tire_id = data.tire_id !== undefined ? parseOptionalTireId(data.tire_id) : null;

  const seasonRaw = data.season != null ? String(data.season).trim() : "";
  const season = seasonRaw ? seasonRaw : null;
  if (season && !VALID_SEASONS.has(season)) throw new Error("Sezon geçersiz");

  const positionRaw = String(data.position || "unknown").trim();
  const position = VALID_POSITIONS.has(positionRaw) ? positionRaw : "unknown";

  return {
    vehicle_id,
    plate: vehicle.plate,
    tire_id,
    change_type,
    change_date,
    odometer_km,
    season,
    position,
    quantity,
    cost,
    vendor: String(data.vendor || "").trim(),
    notes: String(data.notes || "").trim(),
  };
}

function createTireChangeRecord(data, auditContext = null) {
  const parsed = parseTireChangeInput(data);
  const info = db
    .prepare(
      `INSERT INTO tire_change_history (
        vehicle_id, plate, tire_id, change_type, change_date, odometer_km,
        season, position, quantity, cost, vendor, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      parsed.vehicle_id,
      parsed.plate,
      parsed.tire_id,
      parsed.change_type,
      parsed.change_date,
      parsed.odometer_km,
      parsed.season,
      parsed.position,
      parsed.quantity,
      parsed.cost,
      parsed.vendor,
      parsed.notes
    );
  const record = getTireChangeRecord(info.lastInsertRowid);
  logTireHistoryAudit("create", record, auditContext);
  return record;
}

function updateTireChangeRecord(id, data, auditContext = null) {
  const cur = getTireChangeRecord(id);
  if (!cur) throw new Error("Kayıt bulunamadı");

  const merged = parseTireChangeInput({
    vehicle_id: data.vehicle_id ?? cur.vehicle_id,
    tire_id: data.tire_id !== undefined ? data.tire_id : cur.tire_id,
    change_type: data.change_type ?? cur.change_type,
    change_date: data.change_date ?? cur.change_date,
    odometer_km: data.odometer_km !== undefined ? data.odometer_km : cur.odometer_km,
    season: data.season !== undefined ? data.season : cur.season,
    position: data.position ?? cur.position,
    quantity: data.quantity ?? cur.quantity,
    cost: data.cost !== undefined ? data.cost : cur.cost,
    vendor: data.vendor ?? cur.vendor,
    notes: data.notes ?? cur.notes,
  });

  db.prepare(
    `UPDATE tire_change_history SET
      vehicle_id=?, plate=?, tire_id=?, change_type=?, change_date=?, odometer_km=?,
      season=?, position=?, quantity=?, cost=?, vendor=?, notes=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    merged.vehicle_id,
    merged.plate,
    merged.tire_id,
    merged.change_type,
    merged.change_date,
    merged.odometer_km,
    merged.season,
    merged.position,
    merged.quantity,
    merged.cost,
    merged.vendor,
    merged.notes,
    id
  );

  const record = getTireChangeRecord(id);
  logTireHistoryAudit("update", record, auditContext);
  return record;
}

function deleteTireChangeRecord(id, auditContext = null) {
  const existing = getTireChangeRecord(id);
  if (!existing) throw new Error("Kayıt bulunamadı");
  db.prepare("DELETE FROM tire_change_history WHERE id = ?").run(id);
  logTireHistoryAudit("delete", existing, auditContext);
  return existing;
}

function getVehicleTireHistory(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) throw new Error("Araç geçersiz");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const records = listTireChangeRecords({ vehicle_id: id });
  return {
    vehicle_id: String(id),
    plate: vehicle.plate,
    records,
    summary: getTireHistorySummary({ vehicle_id: id }),
  };
}

module.exports = {
  changeTypeLabel,
  toTireChangeRecord,
  listTireChangeRecords,
  getTireHistorySummary,
  getTireChangeRecord,
  createTireChangeRecord,
  updateTireChangeRecord,
  deleteTireChangeRecord,
  getVehicleTireHistory,
  VALID_CHANGE_TYPES,
};
