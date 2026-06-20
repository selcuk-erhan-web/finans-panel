const db = require("../lib/db");
const { parseMoneyInput } = require("../utils/money");
const { parseDateInput } = require("../utils/date");
const auditService = require("./auditService");
const { UPCOMING_DAYS, MAINTENANCE_TYPES, LEGACY_MAINTENANCE_TYPES } = require("../lib/constants");

const TYPE_LABELS = {
  engine_oil: "Motor Yağı",
  oil_filter: "Yağ Filtresi",
  air_filter: "Hava Filtresi",
  fuel_filter: "Yakıt Filtresi",
  brake_pads: "Fren Balatası",
  brake_discs: "Fren Diski",
  battery: "Akü",
  tires: "Lastik",
  periodic_maintenance: "Periyodik Bakım",
  general_repair: "Genel Onarım",
  inspection: "Muayene",
  other: "Diğer",
  yag_bakimi: "Yağ Bakımı",
  yag: "Yağ Bakımı",
  lastik: "Lastik",
  fren: "Fren",
  muayene: "Muayene",
  sigorta: "Sigorta",
  periyodik: "Periyodik Bakım",
  diger: "Diğer",
};

const VALID_MAINTENANCE_TYPES = new Set([
  ...MAINTENANCE_TYPES.map(([k]) => k),
  ...LEGACY_MAINTENANCE_TYPES.map(([k]) => k),
  "yag",
]);

function typeLabel(key) {
  return TYPE_LABELS[key] || key;
}

function isValidMaintenanceType(type) {
  return VALID_MAINTENANCE_TYPES.has(String(type || "").trim());
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
    vendor: row.vendor || "",
    updated_at: row.updated_at || row.created_at || null,
  };
}

function toMaintenanceRecord(row) {
  const normalized = normalizeRow(row);
  if (!normalized) return null;
  return {
    id: String(normalized.id),
    vehicle_id: String(normalized.vehicle_id),
    plate: normalized.plate || "",
    maintenance_type: normalized.type,
    maintenance_type_label: normalized.type_label,
    maintenance_date: normalized.service_date || null,
    odometer_km: normalized.km != null ? Number(normalized.km) : null,
    cost: Number(normalized.amount ?? normalized.cost ?? 0),
    vendor: normalized.vendor || "",
    description: normalized.description || "",
    created_at: normalized.created_at || null,
    updated_at: normalized.updated_at || normalized.created_at || null,
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

function listMaintenanceRecords(filters = {}) {
  let sql = `SELECT m.*, v.plate FROM maintenance_records m
    LEFT JOIN vehicles v ON v.id = m.vehicle_id WHERE 1=1`;
  const params = [];
  if (filters.vehicle_id) {
    sql += " AND m.vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }
  const typeFilter = filters.maintenance_type || filters.type;
  if (typeFilter) {
    sql += " AND m.type = ?";
    params.push(typeFilter);
  }
  sql += " ORDER BY COALESCE(m.service_date, m.created_at) DESC, COALESCE(m.km, 0) DESC, m.id DESC";
  return db
    .prepare(sql)
    .all(...params)
    .map(toMaintenanceRecord);
}

function getSummary(filters = {}) {
  const rows = listMaintenanceRecords(filters);
  const vehicleIds = new Set(rows.map((r) => r.vehicle_id));
  const totalCost = rows.reduce((sum, row) => sum + (row.cost || 0), 0);
  const latest = rows[0] || null;
  return {
    total_records: rows.length,
    total_cost: totalCost,
    vehicles_with_maintenance: vehicleIds.size,
    last_maintenance_date: latest?.maintenance_date || null,
    last_odometer_km: latest?.odometer_km ?? null,
  };
}

function buildHistorySummary(records) {
  const latest = records[0] || null;
  return {
    total_records: records.length,
    total_cost: records.reduce((sum, row) => sum + (row.cost || 0), 0),
    last_maintenance_date: latest?.maintenance_date || null,
    last_odometer_km: latest?.odometer_km ?? null,
  };
}

function getVehicleMaintenanceHistory(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) throw new Error("Araç geçersiz");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const records = listMaintenanceRecords({ vehicle_id: id });
  return {
    vehicle_id: String(id),
    plate: vehicle.plate,
    records,
    summary: buildHistorySummary(records),
  };
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

function getMaintenanceRecord(id) {
  const row = db
    .prepare(
      `SELECT m.*, v.plate FROM maintenance_records m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id WHERE m.id = ?`
    )
    .get(id);
  return toMaintenanceRecord(row);
}

function parseOptionalAmount(value, fallback = 0) {
  if (value == null || String(value).trim() === "") return fallback;
  const n = parseMoneyInput(value);
  if (n == null || n < 0) throw new Error("Tutar geçerli değil");
  return Math.round(n);
}

function parseOptionalKm(value) {
  if (value == null || String(value).trim() === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("KM geçerli değil");
  return Math.round(n);
}

function parseMaintenanceInput(data) {
  const vehicle_id = Number(data.vehicle_id);
  if (!vehicle_id || !Number.isFinite(vehicle_id)) throw new Error("Araç seçilmeli");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const maintenance_type = String(data.maintenance_type || data.type || "").trim();
  if (!isValidMaintenanceType(maintenance_type)) throw new Error("Bakım türü geçersiz");

  const maintenance_date = parseDateInput(data.maintenance_date || data.service_date);
  if (!maintenance_date) throw new Error("Bakım tarihi geçersiz");

  const odometer_km = parseOptionalKm(data.odometer_km ?? data.km);
  const cost =
    data.cost !== undefined || data.amount !== undefined
      ? parseOptionalAmount(data.cost ?? data.amount, 0)
      : 0;
  const vendor = String(data.vendor || "").trim();
  const description = String(data.description || "").trim() || typeLabel(maintenance_type);

  return {
    vehicle_id,
    plate: vehicle.plate,
    type: maintenance_type,
    service_date: maintenance_date,
    km: odometer_km,
    amount: cost,
    cost,
    vendor,
    description,
    note: data.note || "",
    next_service_date: data.next_service_date || data.due_date || null,
  };
}

function create(data) {
  const useCenterInput =
    data.maintenance_type ||
    data.maintenance_date ||
    data.odometer_km !== undefined ||
    data.vendor !== undefined;

  const parsed = useCenterInput ? parseMaintenanceInput(data) : data;
  const description = parsed.description || parsed.title || typeLabel(parsed.type);
  const amount = parsed.amount != null ? parsed.amount : parseOptionalAmount(parsed.cost, 0);
  const service_date = parsed.service_date || parsed.done_date || null;
  const next_service_date = parsed.next_service_date || parsed.due_date || null;
  const status = computeStatus(next_service_date, service_date);

  const info = db
    .prepare(
      `INSERT INTO maintenance_records (
        vehicle_id, type, description, amount, km, service_date, next_service_date, note, status,
        title, cost, done_date, due_date, vendor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      parsed.vehicle_id,
      parsed.type,
      description,
      amount,
      Number(parsed.km || 0),
      service_date,
      next_service_date,
      parsed.note || "",
      status,
      description,
      amount,
      service_date,
      next_service_date,
      parsed.vendor || ""
    );
  return getById(info.lastInsertRowid);
}

function createMaintenanceRecord(data) {
  return toMaintenanceRecord(create(parseMaintenanceInput(data)));
}

function update(id, data) {
  const cur = getById(id);
  if (!cur) return null;

  const hasCenterFields =
    data.maintenance_type ||
    data.type ||
    data.maintenance_date ||
    data.service_date ||
    data.odometer_km !== undefined ||
    data.km !== undefined ||
    data.cost !== undefined ||
    data.amount !== undefined ||
    data.vendor !== undefined ||
    data.description !== undefined;

  const merged = hasCenterFields
    ? {
        ...cur,
        ...parseMaintenanceInput({
          vehicle_id: data.vehicle_id ?? cur.vehicle_id,
          maintenance_type: data.maintenance_type ?? data.type ?? cur.type,
          maintenance_date: data.maintenance_date ?? data.service_date ?? cur.service_date,
          odometer_km: data.odometer_km ?? data.km ?? cur.km,
          cost: data.cost ?? data.amount ?? cur.amount,
          vendor: data.vendor ?? cur.vendor,
          description: data.description ?? cur.description,
          note: data.note ?? cur.note,
          next_service_date: data.next_service_date ?? data.due_date ?? cur.next_service_date,
        }),
      }
    : {
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
        vendor: data.vendor ?? cur.vendor ?? "",
      };

  const status = computeStatus(merged.next_service_date, merged.service_date);

  db.prepare(
    `UPDATE maintenance_records SET
      vehicle_id=?, type=?, description=?, amount=?, km=?,
      service_date=?, next_service_date=?, note=?, status=?,
      title=?, cost=?, done_date=?, due_date=?, vendor=?,
      updated_at=CURRENT_TIMESTAMP
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
    merged.vendor || "",
    id
  );
  return getById(id);
}

function updateMaintenanceRecord(id, data) {
  const updated = update(id, data);
  if (!updated) throw new Error("Kayıt bulunamadı");
  return toMaintenanceRecord(updated);
}

function markDone(id, serviceDate) {
  const d = serviceDate || new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE maintenance_records SET service_date=?, done_date=?, status='done', updated_at=CURRENT_TIMESTAMP WHERE id=?`
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

function deleteMaintenanceRecord(id) {
  const existing = getMaintenanceRecord(id);
  if (!existing) throw new Error("Kayıt bulunamadı");
  remove(id);
  return existing;
}

module.exports = {
  TYPE_LABELS,
  MAINTENANCE_TYPES,
  typeLabel,
  isValidMaintenanceType,
  normalizeRow,
  toMaintenanceRecord,
  listAll,
  listMaintenanceRecords,
  getSummary,
  buildHistorySummary,
  getVehicleMaintenanceHistory,
  listByVehicle,
  getUpcoming,
  getUpcomingMuayeneSigorta,
  hasUpcomingMaintenance,
  getLastServiceByVehicle,
  getById,
  getMaintenanceRecord,
  create,
  createMaintenanceRecord,
  update,
  updateMaintenanceRecord,
  markDone,
  remove,
  deleteMaintenanceRecord,
  computeStatus,
};
