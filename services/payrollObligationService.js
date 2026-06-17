const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");
const { extractPdfText } = require("../utils/pdfText");
const { parseTrNumber } = require("../utils/numbers");
const { parseMoneyInputRequired } = require("../utils/money");
const { parseDateInput, parsePeriodInput } = require("../utils/date");
const { money } = require("../lib/finance");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "payroll");

const TYPE_LABELS = {
  sgk: "SGK",
  muhtasar: "Muhtasar",
};

const STATUS_LABELS = {
  pending: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
};

const TR_MONTHS = [
  "",
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function parsePayrollAmount(val) {
  if (val == null || String(val).trim() === "") return 0;
  return Math.round(parseTrNumber(val));
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function trNorm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function periodDisplay(period) {
  if (!period) return "—";
  const m = String(period).match(/^(\d{4})-(\d{2})$/);
  if (!m) return period;
  return `${TR_MONTHS[Number(m[2])] || m[2]} ${m[1]}`;
}

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function daysUntilDue(dueDate, ref = new Date()) {
  if (!dueDate) return null;
  const due = new Date(`${String(dueDate).slice(0, 10)}T12:00:00`);
  const today = normalizeRefDate(ref);
  today.setHours(12, 0, 0, 0);
  return Math.ceil((due - today) / 86400000);
}

function computeStatus(row, ref = new Date()) {
  if (row.status === "paid" || row.paid_date) return "paid";
  const days = daysUntilDue(row.due_date, ref);
  if (row.due_date && days != null && days < 0) return "overdue";
  return "pending";
}

function detectObligationType(text) {
  const t = trNorm(text);
  if (t.includes("muhtasar") || t.includes("gelir vergisi s")) return "muhtasar";
  if (
    t.includes("sgk") ||
    t.includes("tahakkuk fisi") ||
    t.includes("odenecek net tutar") ||
    t.includes("kisi sayisi")
  ) {
    return "sgk";
  }
  return null;
}

function parseSgkText(text) {
  const raw = normalizePdfText(text);
  const t = trNorm(raw);
  let period = null;
  let person_count = null;
  let amount = null;
  let due_date = null;

  const yearMonth =
    raw.match(/AİT\s+OLDUĞU\s+YIL\s*[:\s]*(\d{4}).*?AİT\s+OLDUĞU\s+AY\s*[:\s]*(\d{1,2})/is) ||
    t.match(/ait\s+oldugu\s+yil\s*[:\s]*(\d{4}).*?ait\s+oldugu\s+ay\s*[:\s]*(\d{1,2})/s) ||
    t.match(/(\d{4})\s*[\/]\s*(\d{1,2})\s*donem/i);

  if (yearMonth) {
    period = `${yearMonth[1]}-${String(yearMonth[2]).padStart(2, "0")}`;
  }

  const personMatch =
    t.match(/kisi\s+sayisi\s*[:\s]*(\d+)/i) || raw.match(/KİŞİ\s+SAYISI\s*[:\s]*(\d+)/i);
  if (personMatch) person_count = Number(personMatch[1]);

  const amountMatch =
    t.match(/odenecek\s+net\s+tutar\s*[:\s]*([\d.,\s]+)/i) ||
    raw.match(/ÖDENECEK\s+NET\s+TUTAR\s*[:\s]*([\d.,\s]+)/i);
  if (amountMatch) amount = parsePayrollAmount(amountMatch[1]);

  const dueMatch =
    t.match(/belge\s+kabul\s+tarihi\s*[:\s]*(\d{1,2}[/.]\d{1,2}[/.]\d{4})/i) ||
    raw.match(/BELGE\s+KABUL\s+TARİHİ\s*[:\s]*(\d{1,2}[/.]\d{1,2}[/.]\d{4})/i) ||
    t.match(/vadesi\s*[:\s]*(\d{1,2}[/.]\d{1,2}[/.]\d{4})/i);
  if (dueMatch) due_date = parseDateInput(dueMatch[1]);

  if (!period || !amount) {
    throw new Error("SGK PDF içinden dönem veya tutar okunamadı.");
  }

  return {
    obligation_type: "sgk",
    period,
    amount,
    due_date,
    person_count,
  };
}

function parseMuhtasarText(text) {
  const raw = normalizePdfText(text);
  const t = trNorm(raw);
  let period = null;
  let amount = null;
  let due_date = null;

  const periodMatch =
    raw.match(/VERGİLENDİRME\s+DÖNEMİ\s*[:\s]*(\d{1,2}[/.]\d{4})/i) ||
    t.match(/vergilendirme\s+donemi\s*[:\s]*(\d{1,2}[/.]\d{4})/i);
  if (periodMatch) period = parsePeriodInput(periodMatch[1]);

  const totalMatch = t.match(/toplam\s*[:\s]*([\d.,\s]+)/i);
  if (totalMatch) amount = parsePayrollAmount(totalMatch[1]);

  const dueMatch =
    t.match(/vadesi\s*[:\s]*(\d{1,2}[/.]\d{1,2}[/.]\d{4})/i) ||
    raw.match(/VADESİ\s*[:\s]*(\d{1,2}[/.]\d{1,2}[/.]\d{4})/i);
  if (dueMatch) due_date = parseDateInput(dueMatch[1]);

  if (!period || !amount) {
    throw new Error("Muhtasar PDF içinden dönem veya tutar okunamadı.");
  }

  return {
    obligation_type: "muhtasar",
    period,
    amount,
    due_date,
    person_count: null,
  };
}

function parsePayrollText(text, typeHint = null) {
  const normalized = normalizePdfText(text);
  if (!normalized || normalized.length < 20) {
    throw new Error("PDF metni okunamadı veya dosya boş görünüyor.");
  }

  const detected = typeHint || detectObligationType(normalized);
  if (detected === "muhtasar") return parseMuhtasarText(normalized);
  if (detected === "sgk") return parseSgkText(normalized);
  throw new Error("Belge türü tespit edilemedi. SGK veya Muhtasar seçerek tekrar deneyin.");
}

async function parsePdfBuffer(buffer, typeHint = null, originalName = "") {
  const text = await extractPdfText(buffer);
  const parsed = parsePayrollText(text, typeHint);
  return { ...parsed, raw_text: normalizePdfText(text), source_file_name: originalName };
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function findDuplicateByKey(obligation_type, period, amount) {
  return db
    .prepare(
      `SELECT * FROM payroll_obligations
       WHERE obligation_type = ? AND period = ? AND amount = ? LIMIT 1`
    )
    .get(obligation_type, period, amount);
}

function findByHash(fileHash) {
  if (!fileHash) return null;
  return db.prepare("SELECT * FROM payroll_obligations WHERE file_hash = ?").get(fileHash);
}

function normalizeRow(row, ref = new Date()) {
  if (!row) return null;
  const status = computeStatus(row, ref);
  const daysLeft = daysUntilDue(row.due_date, ref);
  return {
    ...row,
    amount: safeAmount(row.amount),
    person_count: row.person_count != null ? Number(row.person_count) : null,
    type_label: TYPE_LABELS[row.obligation_type] || row.obligation_type,
    status,
    status_label: STATUS_LABELS[status] || status,
    period_label: periodDisplay(row.period),
    daysLeft,
  };
}

function insertObligation(data) {
  const info = db
    .prepare(
      `INSERT INTO payroll_obligations (
        obligation_type, period, amount, due_date, person_count,
        source_file_name, file_hash, status, paid_date, note, raw_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.obligation_type,
      data.period,
      safeAmount(data.amount),
      data.due_date || null,
      data.person_count != null ? Number(data.person_count) : null,
      data.source_file_name || null,
      data.file_hash || null,
      data.status || "pending",
      data.paid_date || null,
      data.note || "",
      data.raw_text || null
    );
  return getById(info.lastInsertRowid);
}

function getById(id, ref = new Date()) {
  const row = db.prepare("SELECT * FROM payroll_obligations WHERE id = ?").get(id);
  return normalizeRow(row, ref);
}

function listAll(ref = new Date()) {
  return db
    .prepare("SELECT * FROM payroll_obligations ORDER BY period DESC, id DESC")
    .all()
    .map((r) => normalizeRow(r, ref));
}

function createManual(data) {
  const obligation_type = data.obligation_type;
  if (!TYPE_LABELS[obligation_type]) throw new Error("Belge türü geçerli değil");
  const period = parsePeriodInput(data.period);
  if (!period) throw new Error("Dönem geçerli değil (YYYY-MM veya MM/YYYY)");
  const amount = parseMoneyInputRequired(data.amount);
  const due_date = data.due_date ? parseDateInput(data.due_date) : null;
  if (data.due_date && !due_date) throw new Error("Vade tarihi geçerli değil");
  const person_count =
    data.person_count != null && String(data.person_count).trim() !== ""
      ? Number(data.person_count)
      : null;

  const dup = findDuplicateByKey(obligation_type, period, amount);
  if (dup) {
    return { ok: false, duplicate: true, message: "Aynı tür, dönem ve tutarda kayıt zaten var.", row: getById(dup.id) };
  }

  const row = insertObligation({
    obligation_type,
    period,
    amount,
    due_date,
    person_count,
    note: data.note || "",
    status: "pending",
  });
  return { ok: true, duplicate: false, row };
}

function importFromParsedData(parsed, originalName, fileHash) {
  const existingHash = findByHash(fileHash);
  if (existingHash) {
    return {
      ok: false,
      duplicate: true,
      duplicateKind: "file_hash",
      message: "Bu PDF daha önce içe aktarılmış.",
      row: getById(existingHash.id),
    };
  }

  const dup = findDuplicateByKey(parsed.obligation_type, parsed.period, parsed.amount);
  if (dup) {
    return {
      ok: false,
      duplicate: true,
      duplicateKind: "logical",
      message: "Aynı tür, dönem ve tutarda kayıt zaten mevcut.",
      row: getById(dup.id),
    };
  }

  const row = insertObligation({
    ...parsed,
    file_hash: fileHash,
    source_file_name: originalName,
    status: "pending",
  });

  return { ok: true, duplicate: false, row };
}

function importFromText(text, originalName, typeHint = null) {
  const fileHash = hashBuffer(Buffer.from(String(text || "")));
  const parsed = {
    ...parsePayrollText(text, typeHint),
    raw_text: normalizePdfText(text),
    source_file_name: originalName,
  };
  return importFromParsedData(parsed, originalName, fileHash);
}

async function importFromBuffer(buffer, originalName, typeHint = null) {
  const fileHash = hashBuffer(buffer);
  const parsed = await parsePdfBuffer(buffer, typeHint, originalName);

  ensureUploadDir();
  const savedName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const savedPath = path.join(UPLOAD_DIR, savedName);
  fs.writeFileSync(savedPath, buffer);

  const result = importFromParsedData(parsed, originalName, fileHash);
  if (result.ok) result.savedPath = savedPath;
  return result;
}

function markPaid(id, paidDate = null) {
  const row = getById(id);
  if (!row) return null;
  const paid_date = paidDate || new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE payroll_obligations SET status='paid', paid_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(paid_date, id);
  return getById(id);
}

function markPending(id) {
  const row = getById(id);
  if (!row) return null;
  db.prepare(
    `UPDATE payroll_obligations SET status='pending', paid_date=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(id);
  return getById(id);
}

function remove(id) {
  db.prepare("DELETE FROM payroll_allocations WHERE obligation_id = ?").run(id);
  db.prepare("DELETE FROM payroll_obligations WHERE id = ?").run(id);
  return true;
}

function getKpiSummary(ref = new Date()) {
  const rows = listAll(ref).filter((r) => r.status !== "paid");
  const pendingSgk = rows.filter((r) => r.obligation_type === "sgk");
  const pendingMuhtasar = rows.filter((r) => r.obligation_type === "muhtasar");
  const upcoming = rows.filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 30);
  const overdue = rows.filter((r) => r.status === "overdue");

  return {
    pendingSgkAmount: pendingSgk.reduce((s, r) => s + r.amount, 0),
    pendingMuhtasarAmount: pendingMuhtasar.reduce((s, r) => s + r.amount, 0),
    upcomingDueCount: upcoming.length,
    overdueCount: overdue.length,
  };
}

function getOpenObligations(ref = new Date()) {
  return listAll(ref).filter((r) => r.status !== "paid");
}

function alertSeverityForObligation(row, ref = new Date()) {
  if (row.status === "paid") return null;
  const days = row.daysLeft;
  if (row.status === "overdue" || (days != null && days >= 0 && days <= 7)) return "critical";
  if (days != null && days >= 8 && days <= 30) return "warning";
  if (!row.due_date && row.status === "pending") return "info";
  return null;
}

function buildDueAlertMessage(row) {
  const label = TYPE_LABELS[row.obligation_type] || row.obligation_type;
  const amt = money(row.amount);
  if (row.status === "overdue") {
    return `${row.period} ${label} tahakkuku ${amt}, vadesi geçmiş.`;
  }
  if (row.daysLeft == null) {
    return `${row.period} ${label} tahakkuku ${amt}, vade bilgisi yok.`;
  }
  if (row.daysLeft === 0) {
    return `${row.period} ${label} tahakkuku ${amt}, vadesi bugün.`;
  }
  return `${row.period} ${label} tahakkuku ${amt}, vadesine ${row.daysLeft} gün kaldı.`;
}

function buildDueAlertTitle(row) {
  const label = TYPE_LABELS[row.obligation_type] || "Ödeme";
  if (row.status === "overdue") return `${label} Ödemesi Gecikmiş`;
  return `${label} Ödemesi Yaklaşıyor`;
}

module.exports = {
  TYPE_LABELS,
  STATUS_LABELS,
  UPLOAD_DIR,
  parsePayrollText,
  parseSgkText,
  parseMuhtasarText,
  detectObligationType,
  parsePdfBuffer,
  importFromBuffer,
  importFromText,
  createManual,
  listAll,
  getById,
  markPaid,
  markPending,
  remove,
  getKpiSummary,
  getOpenObligations,
  alertSeverityForObligation,
  buildDueAlertMessage,
  buildDueAlertTitle,
  computeStatus,
  daysUntilDue,
  periodDisplay,
  findByHash,
  findDuplicateByKey,
};
