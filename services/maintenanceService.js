const db = require("../lib/db");
const { parseMoneyInput } = require("../utils/money");
const auditService = require("./auditService");
const { UPCOMING_DAYS } = require("../lib/constants");

const TYPE_LABELS = {
  yag_bakimi: "Yağ Bakımı",
  yag: "Yağ Bakımı",
  lastik: "Lastik",
  fren: "Fren",
  muayene: "Muayene",
  sigorta: "Sigorta",
  periyodik: "Periyodik Bakım",
  diger: "Diğer",
};

function typeLabel(key) {
  return TYPE_LABELS[key] || key;
}

function normalizeRow(row) {
  if (!row) return null;
  const description = row.description || row.title || typeLabel(row.type);
  const amount = Number(row.amount ?? row.cost ?? 0);
  const service_date = row.service_date || row.done_date || null;
  const next_service_date = row.next_service_date || row.due_date || null;
  const status = computeStatus(next_service_date, service_date);
  return {
    ...row,
    description,
    amount,
    service_date,
    next_service_date,
    status,
    type_label: typeLabel(row.type),
  };
}

function computeStatus(nextServiceDate, serviceDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (!nextServiceDate) {
    return serviceDate ? "done" : "pending";
  }
  if (nextServiceDate < today) return "overdue";
  const limit = new Date();
  limit.setDate(limit.getDate() + UPCOMING_DAYS);
  if (nextServiceDate <= limit.toISOString().slice(0, 10)) return "upcoming";
  return "pending";
}

function listAll(filters = {}) {
  let sql = `SELECT m.*, v.plate FROM maintenance_records m
    LEFT JOIN vehicles v ON v.id = m.vehicle_id WHERE 1=1`;
  const params = [];
  if (filters.vehicle_id) {
    sql += " AND m.vehicle_id = ?";
    params.push(filters.vehicle_id);
  }
  if (filters.type) {
    sql += " AND m.type = ?";
    params.push(filters.type);
  }
  sql += " ORDER BY COALESCE(m.next_service_date, m.service_date) ASC, m.id DESC";
  let rows = db.prepare(sql).all(...params).map(normalizeRow);
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  return rows;
}

function listByVehicle(vehicleId) {
  return listAll({ vehicle_id: vehicleId });
}

function getUpcoming(limit = 15) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + UPCOMING_DAYS);
  const end = limitDate.toISOString().slice(0, 10);

  const rows = db
    .prepare(
      `SELECT m.*, v.plate FROM maintenance_records m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.next_service_date IS NOT NULL AND m.next_service_date <= ?
       ORDER BY m.next_service_date ASC LIMIT ?`
    )
    .all(end, limit);

  return rows.map(normalizeRow).filter((r) => r.status === "upcoming" || r.status === "overdue");
}

function getUpcomingMuayeneSigorta(limit = 8) {
  return getUpcoming(30).filter((m) => m.type === "muayene" || m.type === "sigorta").slice(0, limit);
}

function hasUpcomingMaintenance() {
  return getUpcoming(1).length > 0;
}

function getLastServiceByVehicle(vehicleId) {
  const row = db
    .prepare(
      `SELECT * FROM maintenance_records WHERE vehicle_id = ?
       AND service_date IS NOT NULL ORDER BY service_date DESC LIMIT 1`
    )
    .get(vehicleId);
  return normalizeRow(row);
}

function getById(id) {
  const row = db
    .prepare(
      `SELECT m.*, v.plate FROM maintenance_records m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id WHERE m.id = ?`
    )
    .get(id);
  return normalizeRow(row);
}

function parseOptionalAmount(value, fallback = 0) {
  if (value == null || String(value).trim() === "") return fallback;
  const n = parseMoneyInput(value);
  if (n == null || n < 0) throw new Error("Tutar geçerli değil");
  return Math.round(n);
}

function create(data) {
  const description = data.description || data.title || typeLabel(data.type);
  const amount = parseOptionalAmount(data.amount ?? data.cost, 0);
  const service_date = data.service_date || data.done_date || null;
  const next_service_date = data.next_service_date || data.due_date || null;
  const status = computeStatus(next_service_date, service_date);

  const info = db
    .prepare(
      `INSERT INTO maintenance_records (
        vehicle_id, type, description, amount, km, service_date, next_service_date, note, status,
        title, cost, done_date, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.vehicle_id,
      data.type,
      description,
      amount,
      Number(data.km || 0),
      service_date,
      next_service_date,
      data.note || "",
      status,
      description,
      amount,
      service_date,
      next_service_date
    );
  return getById(info.lastInsertRowid);
}

function update(id, data) {
  const cur = getById(id);
  if (!cur) return null;
  const merged = {
    vehicle_id: data.vehicle_id ?? cur.vehicle_id,
    type: data.type ?? cur.type,
    description: data.description ?? data.title ?? cur.description,
    amount:
      data.amount !== undefined || data.cost !== undefined
        ? parseOptionalAmount(data.amount ?? data.cost, cur.amount)
        : cur.amount,
    km: Number(data.km ?? cur.km ?? 0),
    service_date: data.service_date ?? data.done_date ?? cur.service_date,
    next_service_date: data.next_service_date ?? data.due_date ?? cur.next_service_date,
    note: data.note ?? cur.note,
  };
  const status = computeStatus(merged.next_service_date, merged.service_date);

  db.prepare(
    `UPDATE maintenance_records SET
      vehicle_id=?, type=?, description=?, amount=?, km=?,
      service_date=?, next_service_date=?, note=?, status=?,
      title=?, cost=?, done_date=?, due_date=?
     WHERE id=?`
  ).run(
    merged.vehicle_id,
    merged.type,
    merged.description,
    merged.amount,
    merged.km,
    merged.service_date,
    merged.next_service_date,
    merged.note,
    status,
    merged.description,
    merged.amount,
    merged.service_date,
    merged.next_service_date,
    id
  );
  return getById(id);
}

function markDone(id, serviceDate) {
  const d = serviceDate || new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE maintenance_records SET service_date=?, done_date=?, status='done' WHERE id=?`
  ).run(d, d, id);
  return getById(id);
}

function remove(id) {
  const old = getById(id);
  db.prepare("DELETE FROM maintenance_records WHERE id = ?").run(id);
  if (old) {
    auditService.log("maintenance_delete", "maintenance_record", id, old, null, "Bakım kaydı silindi");
  }
}

module.exports = {
  TYPE_LABELS,
  typeLabel,
  normalizeRow,
  listAll,
  listByVehicle,
  getUpcoming,
  getUpcomingMuayeneSigorta,
  hasUpcomingMaintenance,
  getLastServiceByVehicle,
  getById,
  create,
  update,
  markDone,
  remove,
  computeStatus,
};
