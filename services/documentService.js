const db = require("../lib/db");
const { parseDateInput } = require("../utils/date");

const DOCUMENT_TYPES = {
  inspection: "Muayene",
  traffic_insurance: "Trafik Sigortası",
  casco: "Kasko",
  seat_insurance: "Koltuk Ferdi Kaza Sigortası",
  license_note: "Araç Ruhsat Notları",
  src_psychotechnic: "SRC / Psikoteknik Notları",
  authorization_certificate: "Yetki Belgesi Notları",
};

const STATUS_LABELS = {
  expired: "Süresi Geçti",
  critical: "7 Gün İçinde",
  warning: "30 Gün İçinde",
  upcoming: "60 Gün İçinde",
  ok: "Uygun",
  no_date: "Tarih Yok",
};

const ALERT_STATUSES = new Set(["expired", "critical", "warning", "upcoming"]);

function typeLabel(key) {
  return DOCUMENT_TYPES[key] || key;
}

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function daysUntilExpiry(expiryDate, ref = new Date()) {
  if (!expiryDate) return null;
  const exp = new Date(`${String(expiryDate).slice(0, 10)}T12:00:00`);
  const today = normalizeRefDate(ref);
  today.setHours(12, 0, 0, 0);
  return Math.ceil((exp - today) / 86400000);
}

function computeStatus(expiryDate, ref = new Date()) {
  if (!expiryDate) return "no_date";
  const days = daysUntilExpiry(expiryDate, ref);
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  if (days <= 60) return "upcoming";
  return "ok";
}

function alertSeverityForStatus(status) {
  if (status === "expired" || status === "critical") return "critical";
  if (status === "warning") return "warning";
  if (status === "upcoming") return "info";
  return null;
}

function buildExpiryMessage(label, daysLeft, status) {
  if (status === "expired") {
    return `${label} süresi ${Math.abs(daysLeft)} gün önce doldu.`;
  }
  if (daysLeft === 0) return `${label} bitiş tarihi bugün.`;
  return `${label} bitiş tarihine ${daysLeft} gün kaldı.`;
}

function normalizeRow(row, ref = new Date()) {
  if (!row) return null;
  const expiry_date = row.expiry_date ? String(row.expiry_date).slice(0, 10) : null;
  const daysLeft = daysUntilExpiry(expiry_date, ref);
  const status = computeStatus(expiry_date, ref);
  const title = row.title || typeLabel(row.document_type);
  return {
    ...row,
    expiry_date,
    title,
    type_label: typeLabel(row.document_type),
    status,
    status_label: STATUS_LABELS[status] || status,
    daysLeft,
  };
}

function listAll(filters = {}, ref = new Date()) {
  let sql = `SELECT d.*, v.plate
    FROM vehicle_documents d
    LEFT JOIN vehicles v ON v.id = d.vehicle_id
    WHERE 1=1`;
  const params = [];

  if (filters.vehicle_id) {
    sql += " AND d.vehicle_id = ?";
    params.push(filters.vehicle_id);
  }
  if (filters.document_type) {
    sql += " AND d.document_type = ?";
    params.push(filters.document_type);
  }

  sql += " ORDER BY CASE WHEN d.expiry_date IS NULL OR d.expiry_date = '' THEN 1 ELSE 0 END, d.expiry_date ASC, d.id DESC";

  let rows = db.prepare(sql).all(...params).map((r) => normalizeRow(r, ref));
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  return rows;
}

function listByVehicle(vehicleId, ref = new Date()) {
  return listAll({ vehicle_id: vehicleId }, ref);
}

function listUpcoming(ref = new Date(), limit = 100) {
  return listAll({}, ref)
    .filter((r) => r.expiry_date && ALERT_STATUSES.has(r.status))
    .sort((a, b) => {
      const da = a.daysLeft ?? 9999;
      const db_ = b.daysLeft ?? 9999;
      return da - db_;
    })
    .slice(0, limit);
}

function getKpiSummary(ref = new Date()) {
  const dated = listAll({}, ref).filter((r) => r.expiry_date);
  return {
    expired: dated.filter((r) => r.status === "expired").length,
    within7: dated.filter((r) => r.status === "critical").length,
    within30: dated.filter((r) => r.status === "warning").length,
    within60: dated.filter((r) => r.status === "upcoming").length,
  };
}

function getById(id, ref = new Date()) {
  const row = db
    .prepare(
      `SELECT d.*, v.plate FROM vehicle_documents d
       LEFT JOIN vehicles v ON v.id = d.vehicle_id WHERE d.id = ?`
    )
    .get(id);
  return normalizeRow(row, ref);
}

function parseExpiryField(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const parsed = parseDateInput(raw);
  if (!parsed) throw new Error("Bitiş tarihi geçerli değil (YYYY-MM-DD veya GG.AA.YYYY)");
  return parsed;
}

function create(data) {
  const vehicle_id = Number(data.vehicle_id);
  if (!vehicle_id) throw new Error("Araç seçilmeli");
  if (!data.document_type || !DOCUMENT_TYPES[data.document_type]) {
    throw new Error("Evrak türü geçerli değil");
  }

  const expiry_date = parseExpiryField(data.expiry_date);
  const title = String(data.title || typeLabel(data.document_type)).trim();

  const info = db
    .prepare(
      `INSERT INTO vehicle_documents (vehicle_id, document_type, title, expiry_date, note)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(vehicle_id, data.document_type, title, expiry_date, data.note || "");

  return getById(info.lastInsertRowid);
}

function update(id, data) {
  const cur = getById(id);
  if (!cur) return null;

  const vehicle_id = data.vehicle_id != null ? Number(data.vehicle_id) : cur.vehicle_id;
  const document_type = data.document_type || cur.document_type;
  if (!DOCUMENT_TYPES[document_type]) throw new Error("Evrak türü geçerli değil");

  const expiry_date =
    data.expiry_date !== undefined ? parseExpiryField(data.expiry_date) : cur.expiry_date;
  const title = String(data.title ?? cur.title ?? typeLabel(document_type)).trim();
  const note = data.note ?? cur.note ?? "";

  db.prepare(
    `UPDATE vehicle_documents SET
      vehicle_id = ?, document_type = ?, title = ?, expiry_date = ?, note = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(vehicle_id, document_type, title, expiry_date, note, id);

  return getById(id);
}

function remove(id) {
  const old = getById(id);
  if (!old) return false;
  db.prepare("DELETE FROM vehicle_documents WHERE id = ?").run(id);
  return true;
}

function getDocumentsForAlerts(ref = new Date()) {
  return listAll({}, ref).filter((r) => r.expiry_date && ALERT_STATUSES.has(r.status));
}

module.exports = {
  DOCUMENT_TYPES,
  STATUS_LABELS,
  typeLabel,
  daysUntilExpiry,
  computeStatus,
  alertSeverityForStatus,
  buildExpiryMessage,
  normalizeRow,
  listAll,
  listByVehicle,
  listUpcoming,
  getKpiSummary,
  getById,
  create,
  update,
  remove,
  getDocumentsForAlerts,
  parseExpiryField,
};
