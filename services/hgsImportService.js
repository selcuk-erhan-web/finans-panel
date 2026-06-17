const crypto = require("crypto");
const { extractPdfText } = require("../utils/pdfText");
const db = require("../lib/db");
const { normalizePlate, buildVehiclePlateMap, findVehicleByPlate } = require("../utils/plate");
const { parseMoneyInput } = require("../utils/money");
const { resolveNameFromSlug } = require("../lib/expenseCategoryMap");
const { backupDatabase } = require("../utils/backup");
const auditService = require("./auditService");

const HGS_EXPENSE_SLUG = "hgs-ogs";

function normalizePdfText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function parseHgsAmount(val) {
  const n = parseMoneyInput(val);
  if (n == null || n <= 0) return 0;
  return Math.round(n);
}

function parseTrDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  let y = m[3];
  if (y.length === 2) y = "20" + y;
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parsePointDateTime(segment) {
  const s = String(segment || "").trim();
  const m = s.match(/^(.+?)\s+(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (!m) return { point: s, date: null, datetime: null };
  const date = parseTrDate(m[2]);
  const time = m[3].length === 5 ? `${m[3]}:00` : m[3];
  return {
    point: m[1].trim(),
    date,
    datetime: date ? `${date} ${time}` : null,
  };
}

function extractField(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return String(m[1]).trim();
  }
  return null;
}

function parseReportHeader(text) {
  const t = normalizePdfText(text);
  const warnings = [];

  const header = {
    hgs_no: extractField(t, [/HGS\s*No[:\s]*(\d+)/i]),
    plate: extractField(t, [
      /Plaka\s*Numaras[ıi][:\s]*([0-9]{1,2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{1,5})/i,
      /Plaka[^:\n]*:\s*([0-9]{1,2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{1,5})/i,
      /Plaka\s*Numaras[ıi][:\s]*([A-Z0-9]+)/i,
    ]),
    vehicle_class: extractField(t, [/Ara[cç]\s*S[ıi]n[ıi]f[ıi][:\s]*(\d+)/i, /Arac\s*Sinifi[:\s]*(\d+)/i]),
    period_start: null,
    period_end: null,
    balance: 0,
    balance_date: null,
    loading_count: 0,
    passage_count: 0,
    loading_total: 0,
    passage_total: 0,
  };

  const periodMatch = t.match(/D[oö]nem[:\s]*(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/i);
  if (periodMatch) {
    header.period_start = parseTrDate(periodMatch[1]);
    header.period_end = parseTrDate(periodMatch[2]);
  } else {
    warnings.push("Dönem tarihi PDF metninde bulunamadı.");
  }

  const balanceStr = extractField(t, [/HGS\s*Bakiyesi[:\s]*([\d.,]+)/i]);
  if (balanceStr) header.balance = parseHgsAmount(balanceStr);

  const balanceDateStr = extractField(t, [/HGS\s*Bakiye\s*Tarihi[:\s]*([\d.\s:]+)/i]);
  if (balanceDateStr) {
    const dm = balanceDateStr.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (dm) header.balance_date = `${parseTrDate(dm[1])} ${dm[2]}`;
  }

  const loadingCountStr = extractField(t, [/D[oö]nem\s*[İi]çi\s*Y[uü]kleme\s*Adedi[:\s]*(\d+)/i]);
  if (loadingCountStr) header.loading_count = Number(loadingCountStr) || 0;

  const passageCountStr = extractField(t, [/D[oö]nem\s*[İi]çi\s*Ge[cç]i[sş]\s*Adedi[:\s]*(\d+)/i]);
  if (passageCountStr) header.passage_count = Number(passageCountStr) || 0;

  const loadingTotalStr = extractField(t, [/D[oö]nem\s*[İi]çi\s*Y[uü]klemeler\s*Toplam[ıi][:\s]*([\d.,]+)/i]);
  if (loadingTotalStr) header.loading_total = parseHgsAmount(loadingTotalStr);

  const passageTotalStr = extractField(t, [/D[oö]nem\s*[İi]çi\s*Ge[cç]i[sş]ler\s*Toplam[ıi][:\s]*([\d.,]+)/i]);
  if (passageTotalStr) header.passage_total = parseHgsAmount(passageTotalStr);

  if (header.plate) {
    header.plate = header.plate.replace(/\s+/g, "").toUpperCase();
  }
  header.plate_normalized = normalizePlate(header.plate);

  if (!header.hgs_no) warnings.push("HGS No bulunamadı.");
  if (!header.plate_normalized) warnings.push("Plaka bulunamadı.");

  return { header, warnings };
}

function isPassageLine(line) {
  const norm = line.toLowerCase();
  return /goi/.test(norm) || /ge[cç]i[sş]/.test(norm);
}

function isLoadingLine(line) {
  const norm = line.toLowerCase();
  return /y[uü]kleme/.test(norm) && !/toplam|adedi/.test(norm);
}

function parsePassageLine(line) {
  const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 5) {
    const highway = parts[1];
    const entry = parsePointDateTime(parts[2]);
    const exit = parsePointDateTime(parts[3]);
    const amount = parseHgsAmount(parts[parts.length - 1]);
    if (amount <= 0) return null;
    return {
      transaction_type: "passage",
      highway,
      entry_point: entry.point,
      entry_datetime: entry.datetime,
      exit_point: exit.point,
      exit_datetime: exit.datetime,
      transaction_date: entry.date || exit.date,
      amount,
      raw_line: line,
    };
  }

  const rx =
    /(?:GOI\s*)?Ge[cç]i[sş]\s*\|?\s*([A-ZÇĞİÖŞÜ\-a-zçğıöşü]+)\s*\|?\s*(.+?\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}(?::\d{2})?)\s*\|?\s*(.+?\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}(?::\d{2})?)\s*\|?\s*([\d.,]+)/i;
  const m = line.match(rx);
  if (!m) return null;
  const entry = parsePointDateTime(m[2]);
  const exit = parsePointDateTime(m[3]);
  const amount = parseHgsAmount(m[4]);
  if (amount <= 0) return null;
  return {
    transaction_type: "passage",
    highway: m[1].trim(),
    entry_point: entry.point,
    entry_datetime: entry.datetime,
    exit_point: exit.point,
    exit_datetime: exit.datetime,
    transaction_date: entry.date || exit.date,
    amount,
    raw_line: line,
  };
}

function parseLoadingLine(line) {
  const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && /y[uü]kleme/i.test(parts[0])) {
    const date = parseTrDate(parts[1]);
    const amount = parseHgsAmount(parts[parts.length - 1]);
    if (!date || amount <= 0) return null;
    return {
      transaction_type: "loading",
      highway: null,
      entry_point: null,
      entry_datetime: null,
      exit_point: null,
      exit_datetime: null,
      transaction_date: date,
      amount,
      raw_line: line,
    };
  }

  const m = line.match(/y[uü]kleme\s*\|?\s*(\d{2}\.\d{2}\.\d{4})\s*\|?\s*([\d.,]+)/i);
  if (!m) return null;
  const date = parseTrDate(m[1]);
  const amount = parseHgsAmount(m[2]);
  if (!date || amount <= 0) return null;
  return {
    transaction_type: "loading",
    highway: null,
    entry_point: null,
    entry_datetime: null,
    exit_point: null,
    exit_datetime: null,
    transaction_date: date,
    amount,
    raw_line: line,
  };
}

function parseTransactions(text) {
  const lines = normalizePdfText(text).split("\n");
  const transactions = [];
  const warnings = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isLoadingLine(line)) {
      const tx = parseLoadingLine(line);
      if (tx) transactions.push(tx);
      continue;
    }

    if (isPassageLine(line)) {
      const tx = parsePassageLine(line);
      if (tx) transactions.push(tx);
    }
  }

  if (!transactions.length) {
    warnings.push("PDF içinde işlem satırı bulunamadı.");
  }

  return { transactions, warnings };
}

function buildTxDedupKey(tx) {
  return [
    tx.transaction_type,
    tx.transaction_date || "",
    tx.amount,
    tx.entry_point || "",
    tx.exit_point || "",
  ].join("|");
}

function buildExpenseNote(tx, plateNormalized) {
  const plate = plateNormalized || "—";
  if (tx.transaction_type === "loading") {
    return `HGS/OGS Yükleme · ${plate} · ${tx.transaction_date || ""}`;
  }
  const route = tx.highway ? ` · ${tx.highway}` : "";
  const points = [tx.entry_point, tx.exit_point].filter(Boolean).join(" → ");
  return `HGS/OGS Geçiş${route}${points ? ` · ${points}` : ""} · ${plate}`;
}

function buildExpenseDedupKey(plateNormalized, tx) {
  return `hgs:${plateNormalized || "unknown"}:${tx.transaction_type}:${tx.transaction_date}:${tx.amount}:${tx.entry_point || ""}:${tx.exit_point || ""}`;
}

function expenseDedupExists(key) {
  if (!key) return false;
  return !!db.prepare("SELECT id FROM transactions WHERE expense_dedup_key = ?").get(key);
}

function looksLikeIsbankHgs(text) {
  const t = normalizePdfText(text).toLowerCase();
  return (
    t.includes("hgs") &&
    (t.includes("plaka") || t.includes("gecis") || t.includes("geçiş") || t.includes("yukleme") || t.includes("yükleme"))
  );
}

async function extractPdfTextFromBuffer(buffer) {
  return extractPdfText(buffer);
}

function parsePdfText(text, originalName = "") {
  const normalized = normalizePdfText(text);
  if (!normalized || normalized.length < 40) {
    throw new Error("PDF metni okunamadı veya dosya boş görünüyor.");
  }
  if (!looksLikeIsbankHgs(normalized)) {
    throw new Error(
      "Bu PDF İş Bankası HGS ekstre formatına uymuyor. Lütfen doğru HGS PDF dosyasını yükleyin."
    );
  }

  const { header, warnings: headerWarnings } = parseReportHeader(normalized);
  const { transactions, warnings: txWarnings } = parseTransactions(normalized);
  const warnings = [...headerWarnings, ...txWarnings];

  return {
    filename: originalName,
    header,
    transactions,
    warnings,
    summary: buildParseSummary(header, transactions, warnings),
  };
}

async function parsePdfBuffer(buffer, originalName = "") {
  const text = await extractPdfTextFromBuffer(buffer);
  return parsePdfText(text, originalName);
}

function buildParseSummary(header, transactions, warnings = []) {
  const passageRows = transactions.filter((t) => t.transaction_type === "passage");
  const loadingRows = transactions.filter((t) => t.transaction_type === "loading");
  return {
    plate: header.plate_normalized || header.plate || "—",
    hgs_no: header.hgs_no || "—",
    period:
      header.period_start && header.period_end
        ? `${header.period_start} — ${header.period_end}`
        : "—",
    passage_count: header.passage_count || passageRows.length,
    loading_count: header.loading_count || loadingRows.length,
    passage_total: header.passage_total || passageRows.reduce((s, t) => s + t.amount, 0),
    loading_total: header.loading_total || loadingRows.reduce((s, t) => s + t.amount, 0),
    parsed_transactions: transactions.length,
    warnings,
  };
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getReportByHash(fileHash) {
  return db.prepare("SELECT * FROM hgs_reports WHERE file_hash = ?").get(fileHash);
}

function insertHgsTransaction(reportId, vehicleId, plateNormalized, tx) {
  const info = db
    .prepare(
      `INSERT INTO hgs_transactions (
        report_id, vehicle_id, plate_normalized, transaction_type, highway,
        entry_point, entry_datetime, exit_point, exit_datetime,
        transaction_date, amount, raw_line
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      reportId,
      vehicleId,
      plateNormalized,
      tx.transaction_type,
      tx.highway,
      tx.entry_point,
      tx.entry_datetime,
      tx.exit_point,
      tx.exit_datetime,
      tx.transaction_date,
      tx.amount,
      tx.raw_line
    );
  return info.lastInsertRowid;
}

function createHgsExpense({ vehicleId, amount, note, date, hgsTransactionId, dedupKey }) {
  const categoryName = resolveNameFromSlug(HGS_EXPENSE_SLUG);
  const expenseDate = date ? `${date} 12:00:00` : new Date().toISOString().slice(0, 10) + " 12:00:00";
  return db
    .prepare(
      `INSERT INTO transactions (
        vehicle_id, type, category, category_slug, amount, note, date,
        hgs_transaction_id, expense_dedup_key
      ) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicleId,
      categoryName,
      HGS_EXPENSE_SLUG,
      amount,
      note,
      expenseDate,
      hgsTransactionId,
      dedupKey
    );
}

function importFromParsed(parsed, originalName, fileHash) {
  const existing = getReportByHash(fileHash);
  if (existing) {
    return {
      ok: false,
      duplicate: true,
      reportId: existing.id,
      filename: originalName,
      plate: existing.plate_normalized,
      hgs_no: existing.hgs_no,
      period:
        existing.period_start && existing.period_end
          ? `${existing.period_start} — ${existing.period_end}`
          : "—",
      vehicleMatched: !!existing.vehicle_id,
      totalRows: 0,
      insertedCount: 0,
      expenseCount: 0,
      skippedCount: 0,
      unmatchedPlates: existing.plate_normalized ? [existing.plate_normalized] : [],
      errorCount: 0,
      warnings: ["Bu PDF daha önce içe aktarılmış (dosya hash eşleşmesi)."],
      errors: [],
      message: "Aynı PDF tekrar içe aktarılamaz.",
    };
  }

  let backupPath;
  try {
    backupPath = backupDatabase();
  } catch (e) {
    throw new Error(`Yedekleme başarısız — import iptal edildi: ${e.message}`);
  }

  const { header, transactions, warnings } = parsed;

  const vehicles = db.prepare("SELECT * FROM vehicles").all();
  const vehicleMap = buildVehiclePlateMap(vehicles);
  const vehicle = header.plate_normalized
    ? findVehicleByPlate(header.plate_normalized, vehicleMap)
    : null;
  const vehicleId = vehicle?.id || null;
  const unmatchedPlates = [];

  if (!vehicleId && header.plate_normalized) {
    unmatchedPlates.push(header.plate_normalized);
    warnings.push(`Eşleşmeyen plaka: ${header.plate_normalized}`);
  }

  const reportInfo = db
    .prepare(
      `INSERT INTO hgs_reports (
        vehicle_id, plate_normalized, hgs_no, vehicle_class,
        period_start, period_end, balance, balance_date,
        loading_count, passage_count, loading_total, passage_total,
        source_file_name, file_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicleId,
      header.plate_normalized,
      header.hgs_no,
      header.vehicle_class,
      header.period_start,
      header.period_end,
      header.balance,
      header.balance_date,
      header.loading_count,
      header.passage_count,
      header.loading_total,
      header.passage_total,
      originalName,
      fileHash
    );

  const reportId = reportInfo.lastInsertRowid;
  let insertedCount = 0;
  let expenseCount = 0;
  let skippedCount = 0;
  const errors = [];
  const seen = new Set();

  for (const tx of transactions) {
    const dedupKey = buildTxDedupKey(tx);
    if (seen.has(dedupKey)) {
      skippedCount++;
      continue;
    }
    seen.add(dedupKey);

    const expenseDedupKey = buildExpenseDedupKey(header.plate_normalized, tx);
    if (expenseDedupExists(expenseDedupKey)) {
      skippedCount++;
      continue;
    }

    try {
      const hgsTxId = insertHgsTransaction(reportId, vehicleId, header.plate_normalized, tx);
      insertedCount++;

      if (vehicleId && tx.amount > 0 && tx.transaction_date) {
        const note = buildExpenseNote(tx, header.plate_normalized);
        try {
          const expenseInfo = createHgsExpense({
            vehicleId,
            amount: tx.amount,
            note,
            date: tx.transaction_date,
            hgsTransactionId: hgsTxId,
            dedupKey: expenseDedupKey,
          });
          db.prepare("UPDATE hgs_transactions SET expense_id = ? WHERE id = ?").run(
            expenseInfo.lastInsertRowid,
            hgsTxId
          );
          expenseCount++;
        } catch (e) {
          if (String(e.message).includes("UNIQUE")) {
            skippedCount++;
          } else {
            errors.push(e.message);
          }
        }
      }
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) {
        skippedCount++;
      } else {
        errors.push(e.message);
      }
    }
  }

  const result = {
    ok: true,
    duplicate: false,
    reportId,
    filename: originalName,
    plate: header.plate_normalized || header.plate || "—",
    hgs_no: header.hgs_no || "—",
    period:
      header.period_start && header.period_end
        ? `${header.period_start} — ${header.period_end}`
        : "—",
    vehicleMatched: !!vehicleId,
    vehiclePlate: vehicle?.plate || null,
    passage_count: header.passage_count,
    loading_count: header.loading_count,
    passage_total: header.passage_total,
    loading_total: header.loading_total,
    totalRows: transactions.length,
    insertedCount,
    expenseCount,
    skippedCount,
    unmatchedPlates,
    errorCount: errors.length,
    warnings,
    errors,
    backupPath,
    message: "HGS PDF başarıyla içe aktarıldı.",
  };

  auditService.log(
    "hgs_import",
    "hgs_report",
    reportId,
    null,
    {
      file_name: originalName,
      plate: result.plate,
      hgs_no: result.hgs_no,
      passage_total: result.passage_total,
      loading_total: result.loading_total,
      inserted_count: insertedCount,
      expense_count: expenseCount,
      skipped_count: skippedCount,
      unmatched_plates: unmatchedPlates,
      backup: backupPath,
    },
    `HGS PDF import: ${originalName}`
  );

  return result;
}

async function importFromBuffer(buffer, originalName = "") {
  if (!buffer || !buffer.length) {
    throw new Error("PDF dosyası boş veya okunamadı.");
  }

  const fileHash = hashBuffer(buffer);
  const parsed = await parsePdfBuffer(buffer, originalName);
  return importFromParsed(parsed, originalName, fileHash);
}

function importFromParsedText(text, originalName = "hgs.pdf") {
  const fileHash = hashBuffer(Buffer.from(text));
  const parsed = parsePdfText(text, originalName);
  return importFromParsed(parsed, originalName, fileHash);
}

function getReportSummary(reportId) {
  const report = db
    .prepare(
      `SELECT r.*, v.plate AS vehicle_plate
       FROM hgs_reports r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.id = ?`
    )
    .get(reportId);
  if (!report) return null;

  const stats = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM hgs_transactions WHERE report_id = ?) AS total_rows,
        (SELECT COUNT(*) FROM transactions t
          INNER JOIN hgs_transactions h ON h.id = t.hgs_transaction_id
          WHERE h.report_id = ?) AS expense_count`
    )
    .get(reportId, reportId);

  return {
    ...report,
    matched: !!report.vehicle_id,
    period_label:
      report.period_start && report.period_end
        ? `${report.period_start} — ${report.period_end}`
        : "—",
    totalRows: stats?.total_rows || 0,
    expenseCount: stats?.expense_count || 0,
    unmatchedPlates: report.vehicle_id || !report.plate_normalized ? [] : [report.plate_normalized],
  };
}

module.exports = {
  parsePdfText,
  parsePdfBuffer,
  parseReportHeader,
  parseTransactions,
  parseHgsAmount,
  parseTrDate,
  importFromBuffer,
  importFromParsed,
  importFromParsedText,
  getReportByHash,
  getReportSummary,
  buildParseSummary,
  buildTxDedupKey,
  buildExpenseDedupKey,
  buildExpenseNote,
  hashBuffer,
};
