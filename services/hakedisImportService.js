const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");
const { extractPdfText } = require("../utils/pdfText");
const { findVehicleByPlateSuffix } = require("../utils/plate");
const { parseTrMoney } = require("../utils/numbers");
const { backupDatabase } = require("../utils/backup");
const auditService = require("./auditService");
const { resolveNameFromSlug } = require("../lib/incomeCategoryMap");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "hakedis");
const SERVICE_SLUG = "service";

const TR_MONTHS = {
  oca: 1,
  ocak: 1,
  sub: 2,
  şub: 2,
  subat: 2,
  mar: 3,
  mart: 3,
  nis: 4,
  nisan: 4,
  may: 5,
  mayis: 5,
  haz: 6,
  haziran: 6,
  tem: 7,
  temmuz: 7,
  agu: 8,
  ağu: 8,
  agustos: 8,
  eyl: 9,
  eylul: 9,
  eki: 10,
  ekim: 10,
  kas: 11,
  kasim: 11,
  ara: 12,
  aralik: 12,
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

function extractMoneyFromLine(line) {
  const s = String(line || "");
  const matches = s.match(/\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}/g);
  if (!matches?.length) return 0;
  return parseTrMoney(matches[matches.length - 1]);
}

function parsePeriod(text) {
  const t = normalizePdfText(text);
  let m =
    t.match(/D[oö]nem[:\s]*([A-Za-zğüşıöçĞÜŞİÖÇ]+)\.?\s*(\d{2,4})/i) ||
    t.match(/\b(Oca[k]?|Şub|Sub|Mar|Nis|May|Haz|Tem|Ağu|Agu|Eyl|Eki|Kas|Ara)[^.]*\.?\s*(\d{2})\b/i);

  if (!m) return { label: "—", date: new Date().toISOString().slice(0, 10) };

  const monthKey = trNorm(m[1]).slice(0, 3);
  const month = TR_MONTHS[monthKey] || TR_MONTHS[trNorm(m[1])];
  let year = Number(m[2]);
  if (year < 100) year = 2000 + year;
  if (!month) {
    return { label: `${m[1]}.${m[2]}`, date: `${year}-01-15` };
  }

  const lastDay = new Date(year, month, 0).getDate();
  const label = `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).replace(/\./g, "")}.${String(m[2]).slice(-2)}`;
  return {
    label: label.replace(/ı/g, "i"),
    date: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    month,
    year,
  };
}

function parseCompanyName(text) {
  const t = normalizePdfText(text);
  const m =
    t.match(/\b(KIRPART)\b/i) ||
    t.match(/(?:Firma|Taşeron|Taseron|Hat)[:\s]*([A-ZÇĞİÖŞÜa-zçğıöşü0-9 ]{2,40})/i);
  if (m) return String(m[1] || m[0]).trim().toUpperCase();
  return "KIRPART";
}

function parseTotals(text) {
  const t = normalizePdfText(text);
  const pick = (patterns) => {
    for (const re of patterns) {
      const m = t.match(re);
      if (m) return parseTrMoney(m[1]);
    }
    return null;
  };

  return {
    hakedisTotal: pick([
      /Haked[iİ][sş]ler\s*Toplam[ıi][:\s]*([\d.,\s]+)/i,
      /Hakedisler\s*Toplami[:\s]*([\d.,\s]+)/i,
    ]),
    kdvTotal: pick([/KDV[:\s]*([\d.,\s]+)/i]),
    payableTotal: pick([
      /[ÖO]denecek\s*Tutar[:\s]*([\d.,\s]+)/i,
      /Odenecek\s*Tutar[:\s]*([\d.,\s]+)/i,
    ]),
  };
}

function parseHakedisLines(text, company) {
  const lines = normalizePdfText(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const vehicleRows = [];
  const extraRows = [];
  const seenVehicle = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (/KIRPART\s+KM\s*FARKI/i.test(upper) || /KM\s*FARKI/i.test(upper)) {
      let amount = extractMoneyFromLine(line);
      if (!amount && lines[i + 1]) amount = extractMoneyFromLine(lines[i + 1]);
      if (amount > 0) {
        extraRows.push({
          lineType: "km_farki",
          label: "KM FARKI",
          amount,
          raw: line,
        });
      }
      continue;
    }

    if (/KIRPART\s+OTOBAN/i.test(upper) || /\bOTOBAN\b/.test(upper)) {
      let amount = extractMoneyFromLine(line);
      if (!amount && lines[i + 1]) amount = extractMoneyFromLine(lines[i + 1]);
      if (amount > 0) {
        extraRows.push({
          lineType: "otoban",
          label: "OTOBAN",
          amount,
          raw: line,
        });
      }
      continue;
    }

    if (/^\d{4}(?:\s|$)/.test(line) && !/OTOBAN|FARKI|TOPLAM|KDV/i.test(upper)) {
      const suffix = line.match(/^(\d{4})/)[1];
      if (!seenVehicle.has(suffix)) {
        let amount = extractMoneyFromLine(line);
        if (!amount && lines[i + 1]) amount = extractMoneyFromLine(lines[i + 1]);
        if (amount > 0) {
          seenVehicle.add(suffix);
          vehicleRows.push({ lineType: "vehicle", suffix, amount, raw: line });
          continue;
        }
      }
    }

    const vm =
      line.match(new RegExp(`${company}\\s+(\\d{4})\\b`, "i")) ||
      line.match(new RegExp(`\\b${company}\\s+(\\d{4})\\b`, "i"));

    if (vm && /^\d{4}$/.test(vm[1])) {
      const suffix = vm[1];
      if (seenVehicle.has(suffix)) continue;
      let amount = extractMoneyFromLine(line);
      if (!amount && lines[i + 1] && /^[\d.,\s]+(?:TL)?$/i.test(lines[i + 1])) {
        amount = extractMoneyFromLine(lines[i + 1]);
      }
      if (amount > 0) {
        seenVehicle.add(suffix);
        vehicleRows.push({
          lineType: "vehicle",
          suffix,
          amount,
          raw: line,
        });
      }
    }
  }

  return { vehicleRows, extraRows };
}

function looksLikeHakedisPdf(text) {
  const t = trNorm(text);
  return (
    t.includes("kirpart") ||
    t.includes("hakedis") ||
    t.includes("tahakkuk") ||
    /\b\d{4}\b/.test(t)
  );
}

function parseHakedisText(text, originalName = "") {
  const normalized = normalizePdfText(text);
  if (!normalized || normalized.length < 20) {
    throw new Error("PDF metni okunamadı veya dosya boş görünüyor.");
  }
  if (!looksLikeHakedisPdf(normalized)) {
    throw new Error("Bu PDF hakediş / tahakkuk formatına uymuyor.");
  }

  const period = parsePeriod(normalized);
  const company = parseCompanyName(normalized);
  const totals = parseTotals(normalized);
  const { vehicleRows, extraRows } = parseHakedisLines(normalized, company);

  if (!vehicleRows.length && !extraRows.length) {
    throw new Error("PDF içinde araç veya ek gelir satırı bulunamadı.");
  }

  const calculatedTotal =
    vehicleRows.reduce((s, r) => s + r.amount, 0) + extraRows.reduce((s, r) => s + r.amount, 0);

  const reconciliation = {
    calculatedTotal,
    pdfHakedisTotal: totals.hakedisTotal,
    pdfKdvTotal: totals.kdvTotal,
    pdfPayableTotal: totals.payableTotal,
    diff:
      totals.hakedisTotal != null
        ? calculatedTotal - totals.hakedisTotal
        : null,
    ok:
      totals.hakedisTotal != null
        ? Math.abs(calculatedTotal - totals.hakedisTotal) <= 1
        : null,
  };

  return {
    filename: originalName,
    period,
    company,
    vehicleRows,
    extraRows,
    totals,
    reconciliation,
    totalRows: vehicleRows.length + extraRows.length,
  };
}

async function extractPdfTextFromBuffer(buffer) {
  return extractPdfText(buffer);
}

async function parsePdfBuffer(buffer, originalName = "") {
  const text = await extractPdfTextFromBuffer(buffer);
  return parseHakedisText(text, originalName);
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildDedupKey({ periodLabel, company, lineType, vehicleId, suffix, amount }) {
  return `hakedis:${periodLabel}:${company}:${lineType}:${vehicleId || suffix || "genel"}:${amount}`;
}

function dedupExists(key) {
  if (!key) return false;
  const hit = db.prepare("SELECT id FROM transactions WHERE income_dedup_key = ?").get(key);
  return !!hit;
}

function buildNote({ company, periodLabel, lineType, suffix, label }) {
  if (lineType === "vehicle") {
    return `${company} ${periodLabel} hakediş · ${suffix}`;
  }
  if (lineType === "otoban") {
    return `${company} ${periodLabel} Otoban Hakedişi`;
  }
  if (lineType === "km_farki") {
    return `${company} ${periodLabel} KM Farkı`;
  }
  return `${company} ${periodLabel} ${label || "Hakediş"}`;
}

function importFromParsed(parsed, originalName, fileHash, savedPath = null) {
  const existing = db.prepare("SELECT * FROM hakedis_import_batches WHERE file_hash = ?").get(fileHash);
  if (existing) {
    return batchToResult(existing, {
      ok: false,
      duplicate: true,
      message: "Bu PDF daha önce içe aktarılmış.",
    });
  }

  let backupPath;
  try {
    backupPath = backupDatabase();
  } catch (e) {
    throw new Error(`Yedekleme başarısız — import iptal edildi: ${e.message}`);
  }

  ensureUploadDir();

  const vehicles = db.prepare("SELECT * FROM vehicles").all();
  const categoryName = resolveNameFromSlug(SERVICE_SLUG);
  const periodLabel = parsed.period.label;
  const company = parsed.company;
  const incomeDate = `${parsed.period.date} 12:00:00`;

  const batchInfo = db
    .prepare(
      `INSERT INTO hakedis_import_batches (
        period_label, company_name, period_date, source_file_name, file_hash,
        total_rows, vehicle_rows, extra_rows, calculated_total,
        pdf_hakedis_total, pdf_kdv_total, pdf_payable_total, reconciliation_json, saved_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      periodLabel,
      company,
      parsed.period.date,
      originalName,
      fileHash,
      parsed.totalRows,
      parsed.vehicleRows.length,
      parsed.extraRows.length,
      parsed.reconciliation.calculatedTotal,
      parsed.totals.hakedisTotal,
      parsed.totals.kdvTotal,
      parsed.totals.payableTotal,
      JSON.stringify(parsed.reconciliation),
      savedPath
    );
  const batchId = batchInfo.lastInsertRowid;

  const result = {
    ok: true,
    duplicate: false,
    batchId,
    filename: originalName,
    period: periodLabel,
    company,
    totalRows: parsed.totalRows,
    vehicleRows: parsed.vehicleRows.length,
    extraRows: parsed.extraRows.length,
    imported: 0,
    skippedDuplicate: 0,
    matchedVehicles: 0,
    unmatchedList: [],
    calculatedTotal: parsed.reconciliation.calculatedTotal,
    pdfHakedisTotal: parsed.totals.hakedisTotal,
    pdfKdvTotal: parsed.totals.kdvTotal,
    pdfPayableTotal: parsed.totals.payableTotal,
    reconciliation: parsed.reconciliation,
    errors: [],
    message: "Hakediş PDF içe aktarıldı.",
  };

  const matchedSet = new Set();

  for (const row of parsed.vehicleRows) {
    const vehicle = findVehicleByPlateSuffix(row.suffix, vehicles);
    const vehicleId = vehicle?.id || null;
    const dedupKey = buildDedupKey({
      periodLabel,
      company,
      lineType: "vehicle",
      vehicleId,
      suffix: row.suffix,
      amount: row.amount,
    });

    if (dedupExists(dedupKey)) {
      result.skippedDuplicate++;
      continue;
    }

    if (vehicleId) matchedSet.add(vehicleId);
    else result.unmatchedList.push(row.suffix);

    try {
      db.prepare(
        `INSERT INTO transactions (
          vehicle_id, type, category, category_slug, amount, note, date,
          hakedis_import_id, income_dedup_key
        ) VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        vehicleId,
        categoryName,
        SERVICE_SLUG,
        row.amount,
        buildNote({ company, periodLabel, lineType: "vehicle", suffix: row.suffix }),
        incomeDate,
        batchId,
        dedupKey
      );
      result.imported++;
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        result.skippedDuplicate++;
      } else {
        result.errors.push(`${row.suffix}: ${e.message}`);
      }
    }
  }

  for (const row of parsed.extraRows) {
    const dedupKey = buildDedupKey({
      periodLabel,
      company,
      lineType: row.lineType,
      vehicleId: null,
      suffix: row.label,
      amount: row.amount,
    });

    if (dedupExists(dedupKey)) {
      result.skippedDuplicate++;
      continue;
    }

    try {
      db.prepare(
        `INSERT INTO transactions (
          vehicle_id, type, category, category_slug, amount, note, date,
          hakedis_import_id, income_dedup_key
        ) VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        null,
        categoryName,
        SERVICE_SLUG,
        row.amount,
        buildNote({ company, periodLabel, lineType: row.lineType, label: row.label }),
        incomeDate,
        batchId,
        dedupKey
      );
      result.imported++;
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        result.skippedDuplicate++;
      } else {
        result.errors.push(`${row.label}: ${e.message}`);
      }
    }
  }

  result.matchedVehicles = matchedSet.size;
  result.unmatchedVehicles = result.unmatchedList.length;

  db.prepare(
    `UPDATE hakedis_import_batches SET
      imported=?, skipped_dup=?, matched_vehicles=?, unmatched_vehicles=?
     WHERE id=?`
  ).run(
    result.imported,
    result.skippedDuplicate,
    result.matchedVehicles,
    result.unmatchedVehicles,
    batchId
  );

  auditService.log(
    "hakedis_import",
    "hakedis_import_batch",
    batchId,
    null,
    {
      filename: originalName,
      period: periodLabel,
      company,
      imported: result.imported,
      skipped: result.skippedDuplicate,
      matched: result.matchedVehicles,
      unmatched: result.unmatchedVehicles,
      calculatedTotal: result.calculatedTotal,
      pdfTotal: result.pdfHakedisTotal,
      reconciliationOk: parsed.reconciliation.ok,
      backup: backupPath,
    },
    `Hakediş import: ${originalName}`
  );

  return result;
}

async function importFromBuffer(buffer, originalName) {
  const fileHash = hashBuffer(buffer);
  const parsed = await parsePdfBuffer(buffer, originalName);
  ensureUploadDir();
  const savedName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const savedPath = path.join(UPLOAD_DIR, savedName);
  fs.writeFileSync(savedPath, buffer);
  return importFromParsed(parsed, originalName, fileHash, savedPath);
}

function getBatchSummary(batchId) {
  return db.prepare("SELECT * FROM hakedis_import_batches WHERE id = ?").get(batchId);
}

function batchToResult(batch, overrides = {}) {
  if (!batch) return null;
  let reconciliation = null;
  if (batch.reconciliation_json) {
    try {
      reconciliation = JSON.parse(batch.reconciliation_json);
    } catch (e) {}
  }
  return {
    ok: true,
    duplicate: false,
    batchId: batch.id,
    filename: batch.source_file_name,
    period: batch.period_label,
    company: batch.company_name,
    totalRows: batch.total_rows,
    vehicleRows: batch.vehicle_rows,
    extraRows: batch.extra_rows,
    imported: batch.imported,
    skippedDuplicate: batch.skipped_dup,
    matchedVehicles: batch.matched_vehicles,
    unmatchedVehicles: batch.unmatched_vehicles,
    calculatedTotal: batch.calculated_total,
    pdfHakedisTotal: batch.pdf_hakedis_total,
    pdfKdvTotal: batch.pdf_kdv_total,
    pdfPayableTotal: batch.pdf_payable_total,
    reconciliation,
    message: "Import özeti",
    ...overrides,
  };
}

module.exports = {
  parseHakedisText,
  parsePdfBuffer,
  importFromBuffer,
  importFromParsed,
  getBatchSummary,
  batchToResult,
  buildDedupKey,
  UPLOAD_DIR,
};
