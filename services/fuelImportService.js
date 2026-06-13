const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const db = require("../lib/db");
const { buildVehiclePlateMap, findVehicleByPlate, normalizePlate, platesMatch } = require("../utils/plate");
const { parseTrNumber, parseTrMoney } = require("../utils/numbers");
const { backupDatabase } = require("../utils/backup");
const auditService = require("./auditService");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "fuel");

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

function sheetToMatrix(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

function detectFormat(workbook, filename = "") {
  const fn = trNorm(filename);
  if (workbook.SheetNames.some((n) => trNorm(n) === "satislistesi")) {
    return { format: "dokum", sheetName: workbook.SheetNames.find((n) => trNorm(n) === "satislistesi") };
  }
  for (const name of workbook.SheetNames) {
    const matrix = sheetToMatrix(workbook.Sheets[name]);
    for (let r = 0; r < Math.min(10, matrix.length); r++) {
      const rowText = (matrix[r] || []).join(" ");
      if (
        rowText.includes("Akaryakıt Alım Raporu") ||
        rowText.includes("Akaryakit Alim Raporu") ||
        rowText.includes("Yakit Alim Raporu")
      ) {
        return { format: "ozet", sheetName: name };
      }
    }
    if (fn.includes("yakit") && fn.includes("alim")) {
      const hdr = findHeaderRow(matrix, ["plaka", "litre"]);
      if (hdr >= 0) return { format: "ozet", sheetName: name };
    }
    if (fn.includes("dokum")) {
      const hdr = findHeaderRow(matrix, ["plaka", "miktar"]);
      if (hdr >= 0) return { format: "dokum", sheetName: name };
    }
    const hdrDokum = findHeaderRow(matrix, ["plaka", "miktar"]);
    if (hdrDokum >= 0) return { format: "dokum", sheetName: name };
    const hdrOzet = findHeaderRow(matrix, ["plaka", "litre"]);
    if (hdrOzet >= 0) return { format: "ozet", sheetName: name };
  }
  return { format: "unknown", sheetName: workbook.SheetNames[0] };
}

function findHeaderRow(matrix, requiredKeys) {
  for (let r = 0; r < Math.min(20, matrix.length); r++) {
    const row = matrix[r] || [];
    const norms = row.map(trNorm);
    const hit = requiredKeys.every((k) => norms.some((h) => h.includes(k)));
    if (hit) return r;
  }
  return -1;
}

function mapHeaders(matrix, headerRowIndex) {
  const headers = (matrix[headerRowIndex] || []).map(trNorm);
  const idx = {};
  const set = (keys, field) => {
    keys.forEach((k) => {
      const i = headers.findIndex((h) => h.includes(k));
      if (i >= 0 && idx[field] === undefined) idx[field] = i;
    });
  };
  return { headers, idx, set };
}

function cell(row, i) {
  if (i === undefined || i < 0) return "";
  return row[i] != null ? String(row[i]).trim() : "";
}

function parseNumber(val) {
  return parseTrNumber(val);
}

function parseMoney(val) {
  return parseTrMoney(val);
}

function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  if (typeof val === "number" && val > 40000) {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseDokumSheet(sheet) {
  const matrix = sheetToMatrix(sheet);
  const headerRow = findHeaderRow(matrix, ["plaka", "miktar"]);
  if (headerRow < 0) throw new Error("Döküm formatı: başlık satırı bulunamadı (Plaka, Miktar).");

  const { idx, set } = mapHeaders(matrix, headerRow);
  set(["plaka"], "plate");
  set(["miktar", "litre"], "liter");
  set(["net tutar"], "net_amount");
  set(["brut tutar", "brüt tutar"], "gross_amount");
  set(["birim fiyat"], "price_per_liter");
  set(["kilometre", "km"], "km");
  set(["distributor", "distribut"], "distributor");
  set(["tarih"], "fuel_date");
  set(["islem numarasi", "işlem numarası", "islem no"], "transaction_no");
  set(["istasyon"], "station");
  set(["sehir", "şehir"], "city");
  set(["utts"], "utts");
  set(["tip", "yakit tipi"], "fuel_type");
  set(["fatura numarasi", "fatura no"], "invoice_no");
  set(["fatura tarihi"], "invoice_date");

  const rows = [];
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const plate = cell(row, idx.plate);
    if (!plate) continue;
    const liter = parseNumber(cell(row, idx.liter));
    if (liter <= 0) continue;
    let total = parseMoney(cell(row, idx.net_amount));
    if (!total && idx.gross_amount !== undefined) total = parseMoney(cell(row, idx.gross_amount));
    const price = parseNumber(cell(row, idx.price_per_liter));
    if (!total && liter && price) total = Math.round(liter * price);
    if (!total) continue;

    rows.push({
      plate_text: plate,
      liter,
      total_amount: Math.round(total),
      price_per_liter: price || (liter ? Math.round((total / liter) * 100) / 100 : 0),
      km: parseNumber(cell(row, idx.km)) || null,
      station: cell(row, idx.station) || cell(row, idx.distributor) || "",
      city: cell(row, idx.city) || "",
      distributor: cell(row, idx.distributor) || "",
      utts: cell(row, idx.utts) || "",
      transaction_no: cell(row, idx.transaction_no) || "",
      invoice_no: cell(row, idx.invoice_no) || "",
      invoice_date: parseDate(cell(row, idx.invoice_date)),
      fuel_date: parseDate(cell(row, idx.fuel_date)) || new Date().toISOString().slice(0, 10),
      fuel_type: cell(row, idx.fuel_type) || "",
      source_format: "dokum",
    });
  }
  return rows;
}

function parseOzetSheet(sheet) {
  const matrix = sheetToMatrix(sheet);
  const headerRow = findHeaderRow(matrix, ["plaka", "litre"]);
  if (headerRow < 0) throw new Error("Özet rapor: başlık satırı bulunamadı (Plaka, Litre).");

  const { idx, set } = mapHeaders(matrix, headerRow);
  set(["plaka"], "plate");
  set(["litre", "miktar"], "liter");
  set(["birim fiyat"], "price_per_liter");
  set(["net tutar"], "total_amount");
  set(["bayi", "istasyon"], "station");
  set(["sehir", "şehir"], "city");
  set(["utts"], "utts");
  set(["tarih"], "fuel_date");
  set(["yakit tipi", "akaryakit tipi"], "fuel_type");

  const rows = [];
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const plate = cell(row, idx.plate);
    if (!plate || trNorm(plate).includes("toplam")) continue;
    const liter = parseNumber(cell(row, idx.liter));
    if (liter <= 0) continue;
    let total = parseMoney(cell(row, idx.total_amount));
    const price = parseNumber(cell(row, idx.price_per_liter));
    if (!total && liter && price) total = Math.round(liter * price);
    if (!total) continue;

    rows.push({
      plate_text: plate,
      liter,
      total_amount: Math.round(total),
      price_per_liter: price || Math.round((total / liter) * 100) / 100,
      km: null,
      station: cell(row, idx.station) || "",
      city: cell(row, idx.city) || "",
      distributor: "",
      utts: cell(row, idx.utts) || "",
      transaction_no: "",
      invoice_no: "",
      invoice_date: null,
      fuel_date: parseDate(cell(row, idx.fuel_date)) || new Date().toISOString().slice(0, 10),
      fuel_type: cell(row, idx.fuel_type) || "",
      source_format: "ozet",
    });
  }
  return rows;
}

function parseWorkbook(buffer, originalName) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const { format, sheetName } = detectFormat(workbook, originalName);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Excel sayfası okunamadı.");

  let rows = [];
  if (format === "dokum") rows = parseDokumSheet(sheet);
  else if (format === "ozet") rows = parseOzetSheet(sheet);
  else throw new Error("Tanınmayan Excel formatı. SatisListesi veya Akaryakıt Alım Raporu bekleniyor.");

  return { format, sheetName, rows, originalName };
}

function buildDedupKey(row) {
  if (row.transaction_no) {
    return `tx:${String(row.transaction_no).trim()}`;
  }
  const plate = normalizePlateFlexible(row.plate_text) || normalizePlate(row.plate_text);
  const station = trNorm(row.station || row.distributor || "");
  const liter = Math.round(parseTrNumber(row.liter) * 100) / 100;
  return `c:${plate}|${row.fuel_date}|${liter}|${row.total_amount}|${station}`;
}

function normalizePlateFlexible(plate) {
  const { normalizePlateFlexible: flex } = require("../utils/plate");
  return flex(plate);
}

function dedupExists(dedupKey) {
  const hit = db.prepare("SELECT id FROM fuel_records WHERE dedup_key = ?").get(dedupKey);
  return !!hit;
}

function createExpenseForFuel(fuelId, vehicleId, row) {
  const existing = db
    .prepare("SELECT id FROM transactions WHERE fuel_record_id = ?")
    .get(fuelId);
  if (existing) return null;

  const note = [
    row.station || row.distributor || "Yakıt",
    row.fuel_type,
    `${row.liter} litre`,
    row.utts ? `UTTS:${row.utts}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const info = db
    .prepare(
      `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date, fuel_record_id)
       VALUES (?, 'expense', 'Yakıt', 'yakit', ?, ?, ?, ?)`
    )
    .run(
      vehicleId,
      row.total_amount,
      note.slice(0, 500),
      `${row.fuel_date} 12:00:00`,
      fuelId
    );
  return info.lastInsertRowid;
}

function insertFuelRecord(row, batchId, sourceFile, vehicleId) {
  const dedup_key = buildDedupKey(row);
  const info = db
    .prepare(
      `INSERT INTO fuel_records (
        vehicle_id, plate_text, fuel_type, liter, price_per_liter, total_amount, km,
        station, city, distributor, utts, transaction_no, invoice_no, invoice_date,
        fuel_date, source_file, import_batch_id, dedup_key, note,
        liters, total_cost, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicleId,
      row.plate_text,
      row.fuel_type || "",
      row.liter,
      row.price_per_liter,
      row.total_amount,
      row.km,
      row.station || "",
      row.city || "",
      row.distributor || "",
      row.utts || "",
      row.transaction_no || "",
      row.invoice_no || "",
      row.invoice_date || null,
      row.fuel_date,
      sourceFile,
      batchId,
      dedup_key,
      `Excel import · ${row.source_format}`,
      row.liter,
      row.total_amount,
      row.fuel_date + " 12:00:00"
    );
  return { id: info.lastInsertRowid, dedup_key };
}

function importFromBuffer(buffer, originalName, options = {}) {
  const { autoCreateVehicle = false, syncExpense = true } = options;

  let backupPath;
  try {
    backupPath = backupDatabase();
  } catch (e) {
    throw new Error(`Yedekleme başarısız — import iptal edildi: ${e.message}`);
  }

  ensureUploadDir();

  const savedName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const savedPath = path.join(UPLOAD_DIR, savedName);
  fs.writeFileSync(savedPath, buffer);

  const parsed = parseWorkbook(buffer, originalName);
  const vehicles = db.prepare("SELECT * FROM vehicles").all();
  let vehicleMap = buildVehiclePlateMap(vehicles);

  const batchInfo = db
    .prepare(
      `INSERT INTO fuel_import_batches (filename, format, total_rows, saved_path)
       VALUES (?, ?, ?, ?)`
    )
    .run(originalName, parsed.format, parsed.rows.length, savedPath);
  const batchId = batchInfo.lastInsertRowid;

  const result = {
    batchId,
    format: parsed.format,
    filename: originalName,
    totalRows: parsed.rows.length,
    imported: 0,
    skippedDuplicate: 0,
    unmatchedPlates: 0,
    unmatchedList: [],
    autoCreated: 0,
    expensesCreated: 0,
    totalLiters: 0,
    totalAmount: 0,
    errors: [],
  };

  const unmatchedSet = new Set();

  for (const row of parsed.rows) {
    const dedup_key = buildDedupKey(row);
    if (dedupExists(dedup_key)) {
      result.skippedDuplicate++;
      continue;
    }

    let vehicle = findVehicleByPlate(row.plate_text, vehicleMap);
    let vehicleId = vehicle?.id || null;

    if (!vehicleId && autoCreateVehicle) {
      const plateNorm = normalizePlate(row.plate_text);
      const info = db
        .prepare(`INSERT INTO vehicles (plate, type) VALUES (?, 'Servis')`)
        .run(row.plate_text.trim());
      vehicleId = info.lastInsertRowid;
      vehicle = { id: vehicleId, plate: row.plate_text };
      vehicleMap = buildVehiclePlateMap(db.prepare("SELECT * FROM vehicles").all());
      result.autoCreated++;
    }

    if (!vehicleId) {
      unmatchedSet.add(row.plate_text);
    }

    try {
      const inserted = insertFuelRecord(row, batchId, originalName, vehicleId);
      result.imported++;
      result.totalLiters += row.liter;
      result.totalAmount += row.total_amount;

      if (syncExpense && vehicleId) {
        const txId = createExpenseForFuel(inserted.id, vehicleId, row);
        if (txId) result.expensesCreated++;
      }
    } catch (e) {
      result.errors.push(`${row.plate_text}: ${e.message}`);
    }
  }

  result.unmatchedList = [...unmatchedSet].sort();
  result.unmatchedPlates = result.unmatchedList.length;
  result.totalLiters = Math.round(result.totalLiters * 100) / 100;

  db.prepare(
    `UPDATE fuel_import_batches SET
      imported=?, skipped_dup=?, unmatched=?, total_liters=?, total_amount=?
     WHERE id=?`
  ).run(
    result.imported,
    result.skippedDuplicate,
    result.unmatchedPlates,
    result.totalLiters,
    result.totalAmount,
    batchId
  );

  auditService.log(
    "fuel_import",
    "fuel_import_batch",
    batchId,
    null,
    {
      filename: originalName,
      imported: result.imported,
      skipped: result.skippedDuplicate,
      unmatched: result.unmatchedPlates,
      backup: backupPath,
    },
    `Excel import: ${originalName}`
  );

  return result;
}

function getBatchSummary(batchId) {
  return db.prepare("SELECT * FROM fuel_import_batches WHERE id = ?").get(batchId);
}

function getAllUnmatchedPlates() {
  return db
    .prepare(
      `SELECT DISTINCT plate_text FROM fuel_records
       WHERE vehicle_id IS NULL AND plate_text IS NOT NULL AND trim(plate_text) != ''
       ORDER BY plate_text`
    )
    .all()
    .map((r) => r.plate_text);
}

function getUnmatchedPlatesForBatch(batchId) {
  return db
    .prepare(
      `SELECT DISTINCT plate_text FROM fuel_records
       WHERE import_batch_id = ? AND vehicle_id IS NULL AND plate_text IS NOT NULL
       ORDER BY plate_text`
    )
    .all(batchId)
    .map((r) => r.plate_text);
}

function batchToResult(batch) {
  if (!batch) return null;
  return {
    batchId: batch.id,
    format: batch.format,
    filename: batch.filename,
    totalRows: batch.total_rows,
    imported: batch.imported,
    skippedDuplicate: batch.skipped_dup,
    unmatchedPlates: batch.unmatched,
    totalLiters: batch.total_liters,
    totalAmount: batch.total_amount,
    unmatchedList: getUnmatchedPlatesForBatch(batch.id),
    errors: [],
  };
}

function createVehicleAndLinkPlate(plateText, batchId = null) {
  const plate = String(plateText || "").trim();
  if (!plate) throw new Error("Plaka gerekli.");

  const existing = findVehicleByPlate(
    plate,
    buildVehiclePlateMap(db.prepare("SELECT * FROM vehicles").all())
  );
  if (existing) {
    return linkFuelRecordsToVehicle(existing.id, plate, batchId);
  }

  const info = db.prepare(`INSERT INTO vehicles (plate, type) VALUES (?, 'Servis')`).run(plate);
  const out = linkFuelRecordsToVehicle(info.lastInsertRowid, plate, batchId);
  auditService.log("fuel_create_vehicle", "vehicle", out.vehicleId, null, { plate, linked: out.linked }, "Import sonrası araç oluşturuldu");
  return out;
}

function linkFuelRecordsToVehicle(vehicleId, plateText, batchId) {
  const unmatched = db
    .prepare(
      `SELECT id, plate_text FROM fuel_records WHERE vehicle_id IS NULL` +
        (batchId ? ` AND import_batch_id = ?` : "")
    )
    .all(...(batchId ? [batchId] : []));

  const ids = unmatched.filter((r) => platesMatch(r.plate_text, plateText)).map((r) => r.id);
  if (!ids.length) return { vehicleId, linked: 0, expensesCreated: 0 };

  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE fuel_records SET vehicle_id = ? WHERE id IN (${placeholders})`).run(
    vehicleId,
    ...ids
  );

  const records = db
    .prepare(
      `SELECT id, liter, total_amount, fuel_date, station, fuel_type, utts FROM fuel_records
       WHERE id IN (${placeholders})`
    )
    .all(...ids);

  let expensesCreated = 0;
  records.forEach((row) => {
    const tx = createExpenseForFuel(row.id, vehicleId, {
      liter: row.liter,
      total_amount: row.total_amount,
      fuel_date: row.fuel_date,
      station: row.station,
      fuel_type: row.fuel_type,
      utts: row.utts,
      distributor: "",
    });
    if (tx) expensesCreated++;
  });

  return { vehicleId, linked: ids.length, expensesCreated };
}

function linkPlateToVehicle(plateText, vehicleId, batchId = null) {
  const plate = String(plateText || "").trim();
  const vid = Number(vehicleId);
  if (!plate || !vid) throw new Error("Plaka ve araç seçilmeli.");
  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(vid);
  if (!vehicle) throw new Error("Araç bulunamadı.");
  const out = linkFuelRecordsToVehicle(vid, plate, batchId);
  auditService.log("fuel_link_plate", "vehicle", vid, null, { plate, linked: out.linked }, "Eşleşmeyen plaka bağlandı");
  return out;
}

module.exports = {
  parseWorkbook,
  importFromBuffer,
  getBatchSummary,
  batchToResult,
  getUnmatchedPlatesForBatch,
  getAllUnmatchedPlates,
  createVehicleAndLinkPlate,
  linkPlateToVehicle,
  buildDedupKey,
  UPLOAD_DIR,
};
