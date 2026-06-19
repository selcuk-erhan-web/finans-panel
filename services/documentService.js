const db = require("../lib/db");
const { parseDateInput } = require("../utils/date");
const { parseMoneyInput } = require("../utils/money");

const COMPLIANCE_TYPES = {
  traffic_insurance: "Trafik Sigortası",
  casco: "Kasko",
  seat_insurance: "Koltuk Ferdi Kaza",
  inspection: "Muayene",
  emission: "Egzoz Emisyon",
  license: "Ruhsat",
  authorization_certificate: "Yetki Belgesi",
};

const LEGACY_DOCUMENT_TYPES = {
  license_note: "Ruhsat",
  src_psychotechnic: "SRC / Psikoteknik Notları",
};

const DOCUMENT_TYPES = { ...COMPLIANCE_TYPES, ...LEGACY_DOCUMENT_TYPES };

const INSURANCE_TYPES = new Set(["traffic_insurance", "casco", "seat_insurance"]);
const TECHNICAL_TYPES = new Set(["inspection", "emission"]);

const STATUS_LABELS = {
  expired: "Süresi Geçti",
  critical: "7 Gün İçinde",
  warning: "30 Gün İçinde",
  upcoming: "60 Gün İçinde",
  ok: "Uygun",
  no_date: "Tarih Yok",
};

const ALERT_STATUSES = new Set(["expired", "critical", "warning", "upcoming"]);

const RESULT_NORMALIZE = {
  passed: "passed",
  geçti: "passed",
  gecti: "passed",
  failed: "failed",
  kaldı: "failed",
  kaldi: "failed",
};

function isComplianceType(type) {
  return Object.prototype.hasOwnProperty.call(COMPLIANCE_TYPES, type);
}

function isValidDocumentType(type) {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, type);
}

function typeLabel(key) {
  if (key === "license_note") return "Ruhsat";
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

function normalizeDateField(value) {
  if (value == null || String(value).trim() === "") return null;
  return String(value).slice(0, 10);
}

function normalizePremiumField(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeReminderDaysField(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeOptionalText(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeRow(row, ref = new Date()) {
  if (!row) return null;
  const expiry_date = normalizeDateField(row.expiry_date);
  const issue_date = normalizeDateField(row.issue_date);
  const daysLeft = daysUntilExpiry(expiry_date, ref);
  const status = computeStatus(expiry_date, ref);
  const title = row.title || typeLabel(row.document_type);
  return {
    ...row,
    expiry_date,
    issue_date,
    policy_number: normalizeOptionalText(row.policy_number),
    insurer: normalizeOptionalText(row.insurer),
    premium_amount: normalizePremiumField(row.premium_amount),
    file_path: normalizeOptionalText(row.file_path),
    file_name: normalizeOptionalText(row.file_name),
    station: normalizeOptionalText(row.station),
    result: normalizeOptionalText(row.result),
    reminder_days: normalizeReminderDaysField(row.reminder_days),
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

function parseIssueDateField(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const parsed = parseDateInput(raw);
  if (!parsed) throw new Error("Düzenlenme tarihi geçerli değil (YYYY-MM-DD veya GG.AA.YYYY)");
  return parsed;
}

function parsePremiumAmountField(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = parseMoneyInput(raw);
  if (n == null || n < 0) throw new Error("Prim tutarı geçerli değil");
  return Math.round(n);
}

function parseReminderDaysField(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) throw new Error("Hatırlatma günü geçerli değil");
  return n;
}

function parseResultField(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const key = String(raw).trim().toLowerCase();
  return RESULT_NORMALIZE[key] || String(raw).trim();
}

function parseOptionalTextField(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

function resolveComplianceFields(data, cur = null) {
  const has = (key) => Object.prototype.hasOwnProperty.call(data, key);

  return {
    issue_date: has("issue_date") ? parseIssueDateField(data.issue_date) : (cur?.issue_date ?? null),
    policy_number: has("policy_number")
      ? parseOptionalTextField(data.policy_number)
      : (cur?.policy_number ?? null),
    insurer: has("insurer") ? parseOptionalTextField(data.insurer) : (cur?.insurer ?? null),
    premium_amount: has("premium_amount")
      ? parsePremiumAmountField(data.premium_amount)
      : (cur?.premium_amount ?? null),
    file_path: has("file_path") ? parseOptionalTextField(data.file_path) : (cur?.file_path ?? null),
    file_name: has("file_name") ? parseOptionalTextField(data.file_name) : (cur?.file_name ?? null),
    station: has("station") ? parseOptionalTextField(data.station) : (cur?.station ?? null),
    result: has("result") ? parseResultField(data.result) : (cur?.result ?? null),
    reminder_days: has("reminder_days")
      ? parseReminderDaysField(data.reminder_days)
      : (cur?.reminder_days ?? null),
  };
}

function create(data) {
  const vehicle_id = Number(data.vehicle_id);
  if (!vehicle_id) throw new Error("Araç seçilmeli");
  if (!data.document_type || !isValidDocumentType(data.document_type)) {
    throw new Error("Evrak türü geçerli değil");
  }

  const expiry_date = parseExpiryField(data.expiry_date);
  const title = String(data.title || typeLabel(data.document_type)).trim();
  const note = data.note || "";
  const extra = resolveComplianceFields(data);

  const info = db
    .prepare(
      `INSERT INTO vehicle_documents (
        vehicle_id, document_type, title, expiry_date, note,
        issue_date, policy_number, insurer, premium_amount,
        file_path, file_name, station, result, reminder_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicle_id,
      data.document_type,
      title,
      expiry_date,
      note,
      extra.issue_date,
      extra.policy_number,
      extra.insurer,
      extra.premium_amount,
      extra.file_path,
      extra.file_name,
      extra.station,
      extra.result,
      extra.reminder_days
    );

  return getById(info.lastInsertRowid);
}

function update(id, data) {
  const cur = getById(id);
  if (!cur) return null;

  const vehicle_id = data.vehicle_id != null ? Number(data.vehicle_id) : cur.vehicle_id;
  const document_type = data.document_type || cur.document_type;
  if (!isValidDocumentType(document_type)) throw new Error("Evrak türü geçerli değil");

  const expiry_date =
    data.expiry_date !== undefined ? parseExpiryField(data.expiry_date) : cur.expiry_date;
  const title = String(data.title ?? cur.title ?? typeLabel(document_type)).trim();
  const note = data.note ?? cur.note ?? "";
  const extra = resolveComplianceFields(data, cur);

  db.prepare(
    `UPDATE vehicle_documents SET
      vehicle_id = ?, document_type = ?, title = ?, expiry_date = ?, note = ?,
      issue_date = ?, policy_number = ?, insurer = ?, premium_amount = ?,
      file_path = ?, file_name = ?, station = ?, result = ?, reminder_days = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    vehicle_id,
    document_type,
    title,
    expiry_date,
    note,
    extra.issue_date,
    extra.policy_number,
    extra.insurer,
    extra.premium_amount,
    extra.file_path,
    extra.file_name,
    extra.station,
    extra.result,
    extra.reminder_days,
    id
  );

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
  COMPLIANCE_TYPES,
  LEGACY_DOCUMENT_TYPES,
  DOCUMENT_TYPES,
  INSURANCE_TYPES,
  TECHNICAL_TYPES,
  STATUS_LABELS,
  isComplianceType,
  isValidDocumentType,
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
  parseIssueDateField,
  parsePremiumAmountField,
  parseReminderDaysField,
  parseResultField,
};
