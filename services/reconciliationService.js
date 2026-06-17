const db = require("../lib/db");
const { money } = require("../lib/finance");

const TOLERANCE = 1;
const SERVICE_SLUG = "service";
const KNOWN_COMPANIES = ["KIRPART"];

const STATUS_LABELS = {
  matched: "Eşleşti",
  underpaid: "Eksik Tahsilat",
  overpaid: "Fazla Tahsilat",
  unmatched: "Eşleşmedi",
  low_confidence: "Düşük Güven",
};

const CONFIDENCE_LABELS = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
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

function safeAmount(v) {
  return Math.round(Number(v) || 0);
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

function monthKeyFromDate(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7);
}

function periodDisplay(period) {
  if (!period) return "—";
  const m = String(period).match(/^(\d{4})-(\d{2})$/);
  if (!m) return period;
  const name = TR_MONTHS[Number(m[2])] || m[2];
  return `${name} ${m[1]}`;
}

function extractCompanyFromNote(note) {
  const u = String(note || "").toUpperCase();
  for (const c of KNOWN_COMPANIES) {
    if (u.includes(c)) return c;
  }
  const m = u.match(/\b([A-ZÇĞİÖŞÜ]{3,20})\b/);
  if (m && KNOWN_COMPANIES.includes(m[1])) return m[1];
  return null;
}

function parseDedupKey(key) {
  const parts = String(key || "").split(":");
  if (parts[0] !== "hakedis" || parts.length < 5) return null;
  return {
    periodLabel: parts[1],
    company: parts[2],
    lineType: parts[3],
    vehicleOrSuffix: parts[4],
  };
}

function parseLineTypeFromNote(note, vehicleId) {
  const u = trNorm(note);
  if (u.includes("otoban")) return "otoban";
  if (u.includes("km fark")) return "km_farki";
  if (vehicleId) return "vehicle";
  return "general";
}

function bucketKey({ period, company, vehicleId, lineType }) {
  return `${period || "?"}|${company || "?"}|${vehicleId || "x"}|${lineType || "general"}`;
}

function parseBucketKey(key) {
  const [period, company, vehiclePart, lineType] = String(key).split("|");
  return {
    period: period === "?" ? null : period,
    company: company === "?" ? null : company,
    vehicleId: vehiclePart === "x" ? null : Number(vehiclePart),
    lineType,
  };
}

function loadActualTransactions() {
  return db
    .prepare(
      `SELECT t.id, t.vehicle_id, t.amount, t.note, t.date, t.income_dedup_key,
              v.plate, b.period_label, b.company_name, b.period_date
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN hakedis_import_batches b ON b.id = t.hakedis_import_id
       WHERE t.type = 'income' AND t.category_slug = ?
         AND (
           t.hakedis_import_id IS NOT NULL
           OR (t.income_dedup_key IS NOT NULL AND t.income_dedup_key LIKE 'hakedis:%')
         )`
    )
    .all(SERVICE_SLUG);
}

function loadExpectedTransactions() {
  return db
    .prepare(
      `SELECT t.id, t.vehicle_id, t.amount, t.note, t.date, t.income_dedup_key, v.plate
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.type = 'income' AND t.category_slug = ?
         AND (t.hakedis_import_id IS NULL OR t.hakedis_import_id = 0)
         AND (t.income_dedup_key IS NULL OR t.income_dedup_key NOT LIKE 'hakedis:%')`
    )
    .all(SERVICE_SLUG);
}

function normalizeActualRow(row) {
  const period =
    monthKeyFromDate(row.period_date) || monthKeyFromDate(row.date);
  let company = row.company_name || extractCompanyFromNote(row.note);
  let lineType = "general";
  let vehicleId = row.vehicle_id || null;

  const dedup = parseDedupKey(row.income_dedup_key);
  if (dedup) {
    company = company || dedup.company;
    if (dedup.lineType && dedup.lineType !== "vehicle") {
      lineType = dedup.lineType;
    } else {
      lineType = "vehicle";
      if (!vehicleId && /^\d+$/.test(dedup.vehicleOrSuffix)) {
        vehicleId = Number(dedup.vehicleOrSuffix);
      }
    }
  }

  if (lineType === "general") {
    lineType = parseLineTypeFromNote(row.note, vehicleId);
  }

  return {
    period,
    company,
    vehicleId,
    plate: row.plate || null,
    lineType,
    amount: safeAmount(row.amount),
    side: "actual",
    note: row.note || "",
  };
}

function normalizeExpectedRow(row) {
  const period = monthKeyFromDate(row.date);
  const company = extractCompanyFromNote(row.note);
  const vehicleId = row.vehicle_id || null;
  const lineType = parseLineTypeFromNote(row.note, vehicleId);

  return {
    period,
    company,
    vehicleId,
    plate: row.plate || null,
    lineType,
    amount: safeAmount(row.amount),
    side: "expected",
    note: row.note || "",
  };
}

function addToMap(map, item) {
  const key = bucketKey(item);
  if (!map.has(key)) {
    map.set(key, {
      ...parseBucketKey(key),
      plate: item.plate,
      expectedAmount: 0,
      actualAmount: 0,
      expectedNotes: [],
      actualNotes: [],
    });
  }
  const bucket = map.get(key);
  if (item.plate && !bucket.plate) bucket.plate = item.plate;
  if (item.side === "expected") {
    bucket.expectedAmount += item.amount;
    if (item.note) bucket.expectedNotes.push(item.note);
  } else {
    bucket.actualAmount += item.amount;
    if (item.note) bucket.actualNotes.push(item.note);
  }
}

function resolveConfidence(meta) {
  const hasPeriod = !!meta.period;
  const hasCompany = !!meta.company;
  const hasVehicle = !!meta.vehicleId;

  if (hasPeriod && hasCompany && hasVehicle) return "high";
  if (hasPeriod && hasCompany) return "medium";
  return "low";
}

function resolveStatus(expectedAmount, actualAmount, confidence) {
  const expected = safeAmount(expectedAmount);
  const actual = safeAmount(actualAmount);
  const diff = actual - expected;

  if (expected === 0 && actual === 0) return "unmatched";

  if (confidence === "low") {
    return "low_confidence";
  }

  if (expected === 0 && actual > 0) return "unmatched";
  if (actual === 0 && expected > 0) return "underpaid";

  if (Math.abs(diff) <= TOLERANCE) return "matched";
  if (diff < -TOLERANCE) return "underpaid";
  if (diff > TOLERANCE) return "overpaid";
  return "unmatched";
}

function buildNote(meta, status) {
  const parts = [];
  if (meta.expectedNotes?.length) parts.push(`Beklenen: ${meta.expectedNotes[0]}`);
  if (meta.actualNotes?.length) parts.push(`Hakediş: ${meta.actualNotes[0]}`);
  if (status === "unmatched" && meta.actualAmount > 0 && !meta.expectedAmount) {
    parts.push("Beklenen kayıt bulunamadı");
  }
  if (status === "underpaid" && meta.expectedAmount > 0 && !meta.actualAmount) {
    parts.push("Hakediş kaydı bulunamadı");
  }
  if (confidenceNote(status, meta)) parts.push(confidenceNote(status, meta));
  return parts.filter(Boolean).join(" · ") || "—";
}

function confidenceNote(status, meta) {
  if (status !== "low_confidence") return "";
  if (!meta.company) return "Firma bilgisi net değil";
  if (!meta.vehicleId && meta.lineType === "vehicle") return "Araç eşleşmesi belirsiz";
  return "Eşleşme güveni düşük";
}

function buildReconciliationRows() {
  const actualMap = new Map();
  const expectedMap = new Map();

  loadActualTransactions().forEach((row) => addToMap(actualMap, normalizeActualRow(row)));
  loadExpectedTransactions().forEach((row) => addToMap(expectedMap, normalizeExpectedRow(row)));

  const keys = new Set([...actualMap.keys(), ...expectedMap.keys()]);
  const rows = [];

  keys.forEach((key) => {
    const actual = actualMap.get(key);
    const expected = expectedMap.get(key);
    const meta = {
      period: actual?.period || expected?.period || null,
      company: actual?.company || expected?.company || null,
      vehicleId: actual?.vehicleId || expected?.vehicleId || null,
      plate: actual?.plate || expected?.plate || null,
      lineType: actual?.lineType || expected?.lineType || "general",
      expectedAmount: expected?.expectedAmount || 0,
      actualAmount: actual?.actualAmount || 0,
      expectedNotes: expected?.expectedNotes || [],
      actualNotes: actual?.actualNotes || [],
    };

    const confidence = resolveConfidence(meta);
    const difference = meta.actualAmount - meta.expectedAmount;
    const status = resolveStatus(meta.expectedAmount, meta.actualAmount, confidence);

    rows.push({
      period: meta.period,
      periodLabel: periodDisplay(meta.period),
      company: meta.company || "—",
      vehicleId: meta.vehicleId,
      plate: meta.plate,
      lineType: meta.lineType,
      expectedAmount: meta.expectedAmount,
      actualAmount: meta.actualAmount,
      difference,
      status,
      confidence,
      note: buildNote(meta, status),
    });
  });

  return rows.sort((a, b) => {
    const p = String(a.period || "").localeCompare(String(b.period || ""));
    if (p !== 0) return p;
    const c = String(a.company || "").localeCompare(String(b.company || ""), "tr");
    if (c !== 0) return c;
    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function getReconciliationSummary(rows = null) {
  const list = rows || buildReconciliationRows();
  const totalExpected = list.reduce((s, r) => s + r.expectedAmount, 0);
  const totalActual = list.reduce((s, r) => s + r.actualAmount, 0);

  return {
    totalExpected,
    totalActual,
    totalDifference: totalActual - totalExpected,
    underpaidCount: list.filter((r) => r.status === "underpaid").length,
    overpaidCount: list.filter((r) => r.status === "overpaid").length,
    unmatchedCount: list.filter((r) => r.status === "unmatched").length,
    lowConfidenceCount: list.filter((r) => r.status === "low_confidence").length,
    matchedCount: list.filter((r) => r.status === "matched").length,
    rowCount: list.length,
  };
}

function getUnderpaidRows(rows = null) {
  return (rows || buildReconciliationRows()).filter((r) => r.status === "underpaid");
}

function buildUnderpaymentMessage(row) {
  const company = row.company && row.company !== "—" ? row.company : "Hakediş";
  const month = periodDisplay(row.period).split(" ")[0] || periodDisplay(row.period);
  const gap = Math.abs(row.difference);
  return `${company} ${month} hakedişinde ${money(gap)} eksik tahsilat görünüyor.`;
}

function alertSeverityForUnderpayment(difference) {
  const gap = Math.abs(difference);
  if (gap > 5000) return "critical";
  if (gap > 100) return "warning";
  return null;
}

module.exports = {
  TOLERANCE,
  STATUS_LABELS,
  CONFIDENCE_LABELS,
  periodDisplay,
  buildReconciliationRows,
  getReconciliationSummary,
  getUnderpaidRows,
  buildUnderpaymentMessage,
  alertSeverityForUnderpayment,
  resolveStatus,
  resolveConfidence,
  extractCompanyFromNote,
  parseLineTypeFromNote,
};
