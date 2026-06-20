const db = require("../lib/db");
const { parseMoneyInput } = require("../utils/money");
const { parseDateInput } = require("../utils/date");
const { TIRE_SEASONS, TIRE_STATUSES, TIRE_POSITIONS } = require("../lib/constants");
const auditLogService = require("./auditLogService");

const SEASON_LABELS = Object.fromEntries(TIRE_SEASONS);
const STATUS_LABELS = Object.fromEntries(TIRE_STATUSES);
const POSITION_LABELS = Object.fromEntries(TIRE_POSITIONS);

const VALID_SEASONS = new Set(TIRE_SEASONS.map(([k]) => k));
const VALID_STATUSES = new Set(TIRE_STATUSES.map(([k]) => k));
const VALID_POSITIONS = new Set(TIRE_POSITIONS.map(([k]) => k));

function seasonLabel(key) {
  return SEASON_LABELS[key] || key;
}

function statusLabel(key) {
  return STATUS_LABELS[key] || key;
}

function positionLabel(key) {
  return POSITION_LABELS[key] || key;
}

function auditActorFrom(ctx) {
  if (!ctx) return { actor_id: "system", actor_name: "System" };
  return {
    actor_id: ctx.actor_id || "system",
    actor_name: ctx.actor_name || "System",
  };
}

function tireActionSummary(action, record) {
  const plate = record.plate || "—";
  const season = seasonLabel(record.season);
  if (action === "create") return `${plate} için ${season} lastik kaydı oluşturuldu.`;
  if (action === "update") return `${plate} için lastik kaydı güncellendi.`;
  if (action === "delete") return `${plate} için lastik kaydı silindi.`;
  return `${plate} lastik kaydı ${action}.`;
}

function logTireAudit(action, record, auditContext) {
  if (!record) return;
  const actor = auditActorFrom(auditContext);
  auditLogService.createAuditLog({
    module: "tire",
    entity_type: "tire_record",
    entity_id: String(record.id),
    action,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    summary: tireActionSummary(action, record),
    metadata: {
      vehicle_id: String(record.vehicle_id),
      plate: record.plate || "",
      season: record.season,
      season_label: seasonLabel(record.season),
      status: record.status,
      quantity: record.quantity,
      cost: record.cost,
    },
  });
}

function toTireRecord(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    vehicle_id: String(row.vehicle_id),
    plate: row.plate || "",
    season: row.season,
    season_label: seasonLabel(row.season),
    brand: row.brand || "",
    model: row.model || "",
    size: row.size || "",
    dot: row.dot || "",
    tread_depth_mm: row.tread_depth_mm != null ? Number(row.tread_depth_mm) : null,
    quantity: Number(row.quantity ?? 1),
    status: row.status,
    status_label: statusLabel(row.status),
    position: row.position || "unknown",
    position_label: positionLabel(row.position || "unknown"),
    purchase_date: row.purchase_date || null,
    cost: row.cost != null ? Number(row.cost) : null,
    vendor: row.vendor || "",
    notes: row.notes || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

function listTireRecords(filters = {}) {
  let sql = `SELECT t.*, v.plate AS vehicle_plate FROM tires t
    LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE 1=1`;
  const params = [];

  if (filters.vehicle_id) {
    sql += " AND t.vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }
  if (filters.season) {
    sql += " AND t.season = ?";
    params.push(String(filters.season).trim());
  }
  if (filters.status) {
    sql += " AND t.status = ?";
    params.push(String(filters.status).trim());
  }
  if (filters.brand) {
    sql += " AND LOWER(t.brand) LIKE ?";
    params.push(`%${String(filters.brand).trim().toLowerCase()}%`);
  }

  sql += " ORDER BY COALESCE(t.created_at, t.purchase_date) DESC, COALESCE(t.purchase_date, '') DESC, t.id DESC";

  return db
    .prepare(sql)
    .all(...params)
    .map((row) => toTireRecord({ ...row, plate: row.plate || row.vehicle_plate || "" }));
}

function getTireSummary(filters = {}) {
  const rows = listTireRecords(filters);
  const sumQty = (pred) => rows.filter(pred).reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalCost = rows.reduce((sum, r) => sum + (r.cost || 0), 0);

  return {
    total_records: rows.length,
    total_quantity: rows.reduce((sum, r) => sum + (r.quantity || 0), 0),
    on_vehicle: sumQty((r) => r.status === "on_vehicle"),
    in_storage: sumQty((r) => r.status === "in_storage"),
    disposed: sumQty((r) => r.status === "disposed"),
    summer: sumQty((r) => r.season === "summer"),
    winter: sumQty((r) => r.season === "winter"),
    all_season: sumQty((r) => r.season === "all_season"),
    total_cost: totalCost,
  };
}

function getTireRecord(id) {
  const row = db
    .prepare(
      `SELECT t.*, v.plate AS vehicle_plate FROM tires t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE t.id = ?`
    )
    .get(id);
  return toTireRecord(row ? { ...row, plate: row.plate || row.vehicle_plate || "" } : null);
}

function parseOptionalCost(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = parseMoneyInput(value);
  if (n == null || n < 0) throw new Error("Maliyet geçerli değil");
  return Math.round(n);
}

function parseOptionalTreadDepth(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Diş derinliği geçerli değil");
  return n;
}

function parseOptionalQuantity(value, fallback = 1) {
  if (value == null || String(value).trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Adet pozitif bir sayı olmalı");
  return Math.round(n);
}

function parseTireInput(data) {
  const vehicle_id = Number(data.vehicle_id);
  if (!vehicle_id || !Number.isFinite(vehicle_id)) throw new Error("Araç seçilmeli");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const season = String(data.season || "").trim();
  if (!VALID_SEASONS.has(season)) throw new Error("Sezon geçersiz");

  const status = String(data.status || "").trim();
  if (!VALID_STATUSES.has(status)) throw new Error("Durum geçersiz");

  const quantity = parseOptionalQuantity(data.quantity, 1);
  const tread_depth_mm =
    data.tread_depth_mm !== undefined ? parseOptionalTreadDepth(data.tread_depth_mm) : null;
  const cost = data.cost !== undefined ? parseOptionalCost(data.cost) : null;

  const positionRaw = String(data.position || "unknown").trim();
  const position = VALID_POSITIONS.has(positionRaw) ? positionRaw : "unknown";

  const purchase_date =
    data.purchase_date != null && String(data.purchase_date).trim() !== ""
      ? parseDateInput(data.purchase_date)
      : null;
  if (data.purchase_date != null && String(data.purchase_date).trim() !== "" && !purchase_date) {
    throw new Error("Satın alma tarihi geçersiz");
  }

  return {
    vehicle_id,
    plate: vehicle.plate,
    season,
    brand: String(data.brand || "").trim(),
    model: String(data.model || "").trim(),
    size: String(data.size || "").trim(),
    dot: String(data.dot || "").trim(),
    tread_depth_mm,
    quantity,
    status,
    position,
    purchase_date,
    cost,
    vendor: String(data.vendor || "").trim(),
    notes: String(data.notes || "").trim(),
  };
}

function createTireRecord(data, auditContext = null) {
  const parsed = parseTireInput(data);
  const info = db
    .prepare(
      `INSERT INTO tires (
        vehicle_id, plate, season, brand, model, size, dot, tread_depth_mm,
        quantity, status, position, purchase_date, cost, vendor, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      parsed.vehicle_id,
      parsed.plate,
      parsed.season,
      parsed.brand,
      parsed.model,
      parsed.size,
      parsed.dot,
      parsed.tread_depth_mm,
      parsed.quantity,
      parsed.status,
      parsed.position,
      parsed.purchase_date,
      parsed.cost,
      parsed.vendor,
      parsed.notes
    );
  const record = getTireRecord(info.lastInsertRowid);
  logTireAudit("create", record, auditContext);
  return record;
}

function updateTireRecord(id, data, auditContext = null) {
  const cur = getTireRecord(id);
  if (!cur) throw new Error("Kayıt bulunamadı");

  const merged = parseTireInput({
    vehicle_id: data.vehicle_id ?? cur.vehicle_id,
    season: data.season ?? cur.season,
    status: data.status ?? cur.status,
    brand: data.brand ?? cur.brand,
    model: data.model ?? cur.model,
    size: data.size ?? cur.size,
    dot: data.dot ?? cur.dot,
    tread_depth_mm: data.tread_depth_mm !== undefined ? data.tread_depth_mm : cur.tread_depth_mm,
    quantity: data.quantity ?? cur.quantity,
    position: data.position ?? cur.position,
    purchase_date: data.purchase_date !== undefined ? data.purchase_date : cur.purchase_date,
    cost: data.cost !== undefined ? data.cost : cur.cost,
    vendor: data.vendor ?? cur.vendor,
    notes: data.notes ?? cur.notes,
  });

  db.prepare(
    `UPDATE tires SET
      vehicle_id=?, plate=?, season=?, brand=?, model=?, size=?, dot=?,
      tread_depth_mm=?, quantity=?, status=?, position=?, purchase_date=?,
      cost=?, vendor=?, notes=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    merged.vehicle_id,
    merged.plate,
    merged.season,
    merged.brand,
    merged.model,
    merged.size,
    merged.dot,
    merged.tread_depth_mm,
    merged.quantity,
    merged.status,
    merged.position,
    merged.purchase_date,
    merged.cost,
    merged.vendor,
    merged.notes,
    id
  );

  const record = getTireRecord(id);
  logTireAudit("update", record, auditContext);
  return record;
}

function deleteTireRecord(id, auditContext = null) {
  const existing = getTireRecord(id);
  if (!existing) throw new Error("Kayıt bulunamadı");
  db.prepare("DELETE FROM tires WHERE id = ?").run(id);
  logTireAudit("delete", existing, auditContext);
  return existing;
}

function getVehicleTireStatus(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) throw new Error("Araç geçersiz");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const records = listTireRecords({ vehicle_id: id, status: "on_vehicle" });
  return {
    vehicle_id: String(id),
    plate: vehicle.plate,
    records,
  };
}

module.exports = {
  seasonLabel,
  statusLabel,
  positionLabel,
  toTireRecord,
  listTireRecords,
  getTireSummary,
  getTireRecord,
  createTireRecord,
  updateTireRecord,
  deleteTireRecord,
  getVehicleTireStatus,
  VALID_SEASONS,
  VALID_STATUSES,
  VALID_POSITIONS,
};
