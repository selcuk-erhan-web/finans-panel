const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../lib/db");
const { extractPdfText } = require("../utils/pdfText");
const { parseMoneyInput } = require("../utils/money");
const { buildVehiclePlateMap, findVehicleByPlate, normalizePlate } = require("../utils/plate");
const documentService = require("./documentService");

const OCR_REQUIRED_MSG =
  "Bu belge tarama görünüyor. OCR gerekir. Şimdilik manuel girin.";

const MIN_TEXT_CHARS = 100;

const IMPORTABLE_TYPES = new Set([
  "traffic_insurance",
  "casco",
  "seat_insurance",
  "inspection",
]);

function getUploadRoot() {
  return (
    process.env.FLEETOS_COMPLIANCE_UPLOAD_DIR ||
    path.join(__dirname, "..", "uploads", "compliance")
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function meaningfulCharCount(text) {
  const t = normalizePdfText(text).replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*/gi, "");
  return t.length;
}

function parseTrDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  let m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2})(?!\d)/);
  if (m) {
    return `20${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function extractField(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return String(m[1]).trim();
  }
  return null;
}

function extractPlate(text) {
  const labeled = extractField(text, [
    /PLAKA\s*(?:NO|NUMARASI)?\s*:\s*([0-9]{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*[0-9]{1,5})/i,
    /Plaka\s*:\s*([0-9]{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*[0-9]{1,5})/i,
    /PLAKA\s*(?:NO|NUMARASI)?\s*:\s*([0-9]{2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{1,5})/i,
    /Plaka\s*:\s*([0-9]{2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{1,5})/i,
  ]);
  if (labeled) return labeled.replace(/\s+/g, " ").trim();
  const loose = text.match(/\b([0-9]{2}[A-ZÇĞİÖŞÜ]{1,3}[0-9]{1,5})\b/i);
  return loose ? loose[1] : null;
}

function extractPolicyNumber(text) {
  const policyNo = text.match(
    /(?:^|\n)\s*(?!(?:Ö\.|ESKİ|ÖNCEKİ|Ö\.YENİLEME)\s*)POLİÇE\s*NO\s*:\s*(\d{5,})/i
  );
  if (policyNo) return policyNo[1];

  const renewalBeforeLabel = text.match(
    /(?:^|\n)\s*(\d{6,})\s*\/\s*\d+\s*(?:\n|$)[\s\S]{0,160}?POLİÇE\s*\/\s*YENİLEME\s*NO/i
  );
  if (renewalBeforeLabel) return renewalBeforeLabel[1];

  const renewalInline = text.match(
    /POLİÇE\s*\/\s*YENİLEME\s*NO\s*:?\s*(\d{6,})\s*\/\s*\d+/i
  );
  if (renewalInline) return renewalInline[1];

  return null;
}

function cleanInsurerName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+A\.?\s*Ş\.?\.?$/i, "")
    .replace(/\s+AŞ$/i, "")
    .trim();
}

function extractInsurer(text) {
  const known = extractField(text, [
    /(UNICO\s+SİGORTA(?:\s+A\.?\s*Ş\.?)?)/i,
    /(Unico\s+Sigorta(?:\s+A\.?\s*Ş\.?)?)/i,
    /(SOMPO\s+SİGORTA[^\n]{0,40})/i,
    /(ANADOLU\s+SİGORTA[^\n]{0,40})/i,
    /(ALLIANZ[^\n]{0,40})/i,
    /(AKSİGORTA[^\n]{0,40})/i,
    /(HDI\s+SİGORTA[^\n]{0,40})/i,
    /(MAPFRE[^\n]{0,40})/i,
  ]);
  if (known) return cleanInsurerName(known);

  const footer = text.match(
    /\b([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü\s]{2,30}Sigorta\s+A\.?\s*Ş\.?)\b/
  );
  if (footer) return cleanInsurerName(footer[1]);

  return null;
}

function extractPremium(text) {
  const raw =
    extractField(text, [
      /BRÜT\s*PRİM\s*:?\s*([\d.,]+)/i,
      /BRÜT\s*PRİM[^\d]*([\d.,]+)/i,
    ]) || null;
  if (!raw) return null;
  const n = parseMoneyInput(raw);
  return n != null ? Math.round(n) : null;
}

function extractInsuranceDates(text) {
  const slashDates = [...text.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map((m) => m[1]);
  let issue_date = null;
  let expiry_date = null;

  const pairAfterLabels = text.match(
    /BAŞLAMA\s*TARİHİ[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (pairAfterLabels) {
    issue_date = parseTrDate(pairAfterLabels[1]);
    expiry_date = parseTrDate(pairAfterLabels[2]);
    return { issue_date, expiry_date };
  }

  const startLabel = text.match(
    /(?:BAŞLAMA|BAŞLANGIÇ)\s*TARİHİ\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  const endLabel = text.match(/BİTİŞ\s*TARİHİ\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (startLabel) issue_date = parseTrDate(startLabel[1]);
  if (endLabel) expiry_date = parseTrDate(endLabel[1]);

  const tabDates = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+\d+\s*Gün/i);
  if (tabDates) {
    issue_date = parseTrDate(tabDates[1]);
    expiry_date = parseTrDate(tabDates[2]);
    return { issue_date, expiry_date };
  }

  if (!issue_date && slashDates.length >= 1) issue_date = parseTrDate(slashDates[0]);
  if (!expiry_date && slashDates.length >= 2) expiry_date = parseTrDate(slashDates[1]);

  return { issue_date, expiry_date };
}

function detectDocumentType(text, typeHint = "") {
  if (typeHint && IMPORTABLE_TYPES.has(typeHint)) {
    return { type: typeHint, confidence: 1 };
  }

  const t = text.toLowerCase();
  const scores = {
    traffic_insurance: 0,
    casco: 0,
    seat_insurance: 0,
    inspection: 0,
  };

  if (/zorunlu mali|trafik sigorta|karayolları motorlu araçlar zorunlu/i.test(t)) {
    scores.traffic_insurance += 3;
  }
  if (/kasko|genişletilmiş full kasko/i.test(t)) scores.casco += 3;
  if (/koltuk ferdi kaza|yolcu taşımacılığı zorunlu koltuk/i.test(t)) {
    scores.seat_insurance += 3;
  }
  if (/araç muayene raporu|tüvtürk|muayene geçerlilik|vehicle inspection report/i.test(t)) {
    scores.inspection += 4;
  }

  if (/kasko/i.test(t) && !/zorunlu mali/i.test(t)) scores.casco += 1;
  if (/ferdi kaza|koltuk/i.test(t)) scores.seat_insurance += 1;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = ranked[0];
  if (topScore < 2) return { type: null, confidence: 0 };
  const confidence = Math.min(1, topScore / 4);
  return { type: topType, confidence };
}

function parseInspectionText(text) {
  const warnings = [];
  const plate = extractPlate(text);
  const station = extractField(text, [/İstasyon\s*:\s*([^\n]+)/i, /İstasyon:([A-ZÇĞİÖŞÜ]+)/i]);
  const issueRaw = extractField(text, [/Muay\.\s*Tarihi\s*:\s*([^\n]+)/i]);
  const issue_date = issueRaw ? parseTrDate(issueRaw.split(/\s+/)[0]) : null;
  const expiryRaw = extractField(text, [
    /Muayene Geçerlilik Tarihi[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /(\d{1,2}[./]\d{1,2}[./]\d{4})\s*Muayene Geçerlilik/i,
  ]);
  const expiry_date = expiryRaw ? parseTrDate(expiryRaw) : null;
  const kmRaw = extractField(text, [/Km\s*:\s*([\d.]+)/i]);
  let result = null;
  if (/MUAYENE ONAYLANDI|INSPECTION APPROVED/i.test(text)) result = "passed";
  else if (/\bMEN\b|REDDEDİLDİ|REJECTED/i.test(text)) result = "failed";
  else if (/HAFİF KUSURLU|MINOR FAULT/i.test(text)) result = "passed";

  let note = "";
  if (kmRaw) note = `KM: ${kmRaw}`;
  if (/HAFİF KUSURLU|MINOR FAULT/i.test(text)) {
    note = note ? `${note} · Hafif kusurlu` : "Hafif kusurlu";
  }

  if (!station) warnings.push("İstasyon otomatik okunamadı.");
  if (!expiry_date) warnings.push("Geçerlilik tarihi okunamadı.");

  return {
    document_type: "inspection",
    plate,
    station,
    issue_date,
    expiry_date,
    result,
    note,
    policy_number: null,
    insurer: null,
    premium_amount: null,
    warnings,
  };
}

function parseInsuranceText(text, document_type) {
  const warnings = [];
  const plate = extractPlate(text);
  const policy_number = extractPolicyNumber(text);
  const insurer = extractInsurer(text);
  const { issue_date, expiry_date } = extractInsuranceDates(text);
  let premium_amount = extractPremium(text);

  if (document_type === "seat_insurance" && premium_amount && premium_amount > 100000) {
    warnings.push("Prim tutarı yüksek görünüyor — ferdi kaza poliçelerinde tutar teminat olabilir.");
  }
  if (!policy_number) warnings.push("Poliçe numarası okunamadı.");
  if (!expiry_date) warnings.push("Bitiş tarihi okunamadı.");

  return {
    document_type,
    plate,
    policy_number,
    insurer,
    issue_date,
    expiry_date,
    premium_amount,
    station: null,
    result: null,
    note: "",
    warnings,
  };
}

function computeConfidence(fields, document_type) {
  let score = 0;
  let max = 0;

  const bump = (cond, w) => {
    max += w;
    if (cond) score += w;
  };

  bump(!!fields.plate, 20);
  bump(!!fields.expiry_date, 25);
  bump(!!fields.issue_date, 10);

  if (document_type === "inspection") {
    bump(!!fields.station, 15);
    bump(!!fields.result, 15);
    max += 15;
    if (fields.note && fields.note.includes("KM")) score += 15;
  } else {
    bump(!!fields.policy_number, 20);
    bump(!!fields.insurer, 10);
    bump(fields.premium_amount != null, 10);
    max += 10;
  }

  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function matchVehicle(plateText) {
  const vehicles = db.prepare("SELECT * FROM vehicles").all();
  const map = buildVehiclePlateMap(vehicles);
  const vehicle = plateText ? findVehicleByPlate(plateText, map) : null;
  return {
    matched: !!vehicle,
    vehicleId: vehicle?.id || null,
    plate: vehicle?.plate || null,
    plateNormalized: plateText ? normalizePlate(plateText) : null,
    vehicles,
  };
}

function findDuplicate({ vehicle_id, document_type, policy_number, expiry_date }) {
  if (!vehicle_id || !document_type) {
    return { isDuplicate: false, existingDocumentId: null, reason: null };
  }

  if (policy_number) {
    const row = db
      .prepare(
        `SELECT id FROM vehicle_documents
         WHERE vehicle_id = ? AND document_type = ? AND policy_number = ?`
      )
      .get(vehicle_id, document_type, policy_number);
    if (row) {
      return { isDuplicate: true, existingDocumentId: row.id, reason: "same_policy" };
    }
  }

  if (expiry_date) {
    const row = db
      .prepare(
        `SELECT id FROM vehicle_documents
         WHERE vehicle_id = ? AND document_type = ? AND expiry_date = ?`
      )
      .get(vehicle_id, document_type, expiry_date);
    if (row) {
      return { isDuplicate: true, existingDocumentId: row.id, reason: "same_expiry" };
    }
  }

  return { isDuplicate: false, existingDocumentId: null, reason: null };
}

function stagingDir(token) {
  return path.join(getUploadRoot(), "staging", token);
}

function stagePreview(buffer, originalName, preview) {
  const token = crypto.randomUUID();
  const dir = stagingDir(token);
  ensureDir(dir);
  const fileHash = hashBuffer(buffer);
  fs.writeFileSync(path.join(dir, "source.pdf"), buffer);
  fs.writeFileSync(
    path.join(dir, "preview.json"),
    JSON.stringify({
      ...preview,
      previewToken: token,
      originalName,
      fileHash,
      createdAt: Date.now(),
    })
  );
  return token;
}

function getStagedPreview(token) {
  if (!token) return null;
  const jsonPath = path.join(stagingDir(token), "preview.json");
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return null;
  }
}

function discardStaging(token) {
  if (!token) return;
  const dir = stagingDir(token);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function assertReadableText(text) {
  const count = meaningfulCharCount(text);
  if (count < MIN_TEXT_CHARS) {
    const err = new Error(OCR_REQUIRED_MSG);
    err.code = "OCR_REQUIRED";
    err.charCount = count;
    throw err;
  }
  return count;
}

function parseComplianceText(text, { originalName = "", typeHint = "" } = {}) {
  const normalized = normalizePdfText(text);
  const charCount = assertReadableText(normalized);
  const warnings = [];

  const detection = detectDocumentType(normalized, typeHint);
  let document_type = detection.type;
  if (!document_type) {
    throw new Error("Belge türü otomatik tespit edilemedi. Tür ipucu seçin veya manuel girin.");
  }
  if (!IMPORTABLE_TYPES.has(document_type)) {
    throw new Error("Bu belge türü için PDF içe aktarma henüz desteklenmiyor.");
  }

  let fields;
  if (document_type === "inspection") {
    fields = parseInspectionText(normalized);
  } else {
    fields = parseInsuranceText(normalized, document_type);
  }

  warnings.push(...(fields.warnings || []));
  delete fields.warnings;

  const vehicleMatch = matchVehicle(fields.plate);
  if (!vehicleMatch.matched && fields.plate) {
    warnings.push(`Plaka filoda bulunamadı: ${fields.plate}`);
  }

  const duplicate = findDuplicate({
    vehicle_id: vehicleMatch.vehicleId,
    document_type: fields.document_type,
    policy_number: fields.policy_number,
    expiry_date: fields.expiry_date,
  });
  if (duplicate.isDuplicate) {
    warnings.push(
      duplicate.reason === "same_policy"
        ? "Aynı poliçe numarasıyla kayıt mevcut."
        : "Aynı bitiş tarihli kayıt mevcut."
    );
  }

  const overallConfidence = computeConfidence(fields, document_type);

  return {
    ok: true,
    filename: originalName,
    charCount,
    detectedType: document_type,
    typeConfidence: detection.confidence,
    overallConfidence,
    fields,
    vehicleMatch: {
      matched: vehicleMatch.matched,
      vehicleId: vehicleMatch.vehicleId,
      plate: vehicleMatch.plate,
      plateDetected: fields.plate,
    },
    duplicate,
    warnings,
    errors: [],
  };
}

async function parsePdfBuffer(buffer, originalName = "", typeHint = "") {
  const text = await extractPdfText(buffer);
  return parseComplianceText(text, { originalName, typeHint });
}

async function createPreviewFromBuffer(buffer, originalName, typeHint = "") {
  const preview = await parsePdfBuffer(buffer, originalName, typeHint);
  const token = stagePreview(buffer, originalName, preview);
  return { ...preview, previewToken: token };
}

function sanitizeFilename(name) {
  return String(name || "belge.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function movePdfToVehicleDir(buffer, vehicleId, originalName, documentId) {
  const root = getUploadRoot();
  const vehicleDir = path.join(root, String(vehicleId));
  ensureDir(vehicleDir);
  const base = sanitizeFilename(originalName).replace(/\.pdf$/i, "");
  const filename = `${documentId}_${base}.pdf`;
  const absPath = path.join(vehicleDir, filename);
  fs.writeFileSync(absPath, buffer);
  return `compliance/${vehicleId}/${filename}`;
}

function confirmImport(token, corrections = {}, { allowDuplicate = false } = {}) {
  const staged = getStagedPreview(token);
  if (!staged) throw new Error("Önizleme süresi doldu veya geçersiz. PDF'i yeniden yükleyin.");

  const pdfPath = path.join(stagingDir(token), "source.pdf");
  if (!fs.existsSync(pdfPath)) throw new Error("Kaynak PDF bulunamadı.");

  const vehicle_id = Number(corrections.vehicle_id || staged.vehicleMatch?.vehicleId);
  if (!vehicle_id) throw new Error("Araç seçilmeli veya plaka eşleşmeli.");

  const document_type = corrections.document_type || staged.fields?.document_type;
  if (!IMPORTABLE_TYPES.has(document_type)) {
    throw new Error("Geçersiz evrak türü.");
  }

  const payload = {
    vehicle_id,
    document_type,
    issue_date: corrections.issue_date ?? staged.fields?.issue_date ?? "",
    expiry_date: corrections.expiry_date ?? staged.fields?.expiry_date ?? "",
    policy_number: corrections.policy_number ?? staged.fields?.policy_number ?? "",
    insurer: corrections.insurer ?? staged.fields?.insurer ?? "",
    premium_amount: corrections.premium_amount ?? staged.fields?.premium_amount ?? "",
    station: corrections.station ?? staged.fields?.station ?? "",
    result: corrections.result ?? staged.fields?.result ?? "",
    note: corrections.note ?? staged.fields?.note ?? "",
    file_name: staged.originalName || "belge.pdf",
  };

  let expiryForDup = null;
  if (payload.expiry_date) {
    try {
      expiryForDup = documentService.parseExpiryField(payload.expiry_date);
    } catch (_) {
      expiryForDup = String(payload.expiry_date).slice(0, 10);
    }
  }

  const duplicate = findDuplicate({
    vehicle_id,
    document_type,
    policy_number: payload.policy_number ? String(payload.policy_number).trim() : null,
    expiry_date: expiryForDup,
  });

  if (duplicate.isDuplicate && !allowDuplicate) {
    const msg =
      duplicate.reason === "same_policy"
        ? "Bu araç için aynı poliçe numarası zaten kayıtlı."
        : "Bu araç için aynı tür ve bitiş tarihli kayıt zaten var.";
    const err = new Error(msg);
    err.code = "DUPLICATE";
    err.duplicate = duplicate;
    throw err;
  }

  const buffer = fs.readFileSync(pdfPath);
  const created = documentService.create({
    ...payload,
    file_path: null,
    file_name: payload.file_name,
  });

  const relPath = movePdfToVehicleDir(buffer, vehicle_id, payload.file_name, created.id);
  const updated = documentService.update(created.id, { file_path: relPath, file_name: payload.file_name });

  discardStaging(token);

  return {
    ok: true,
    document: updated,
    duplicate,
    message: "Uygunluk belgesi kaydedildi.",
  };
}

module.exports = {
  OCR_REQUIRED_MSG,
  MIN_TEXT_CHARS,
  IMPORTABLE_TYPES,
  getUploadRoot,
  normalizePdfText,
  meaningfulCharCount,
  parseTrDate,
  detectDocumentType,
  parseInspectionText,
  parseInsuranceText,
  parseComplianceText,
  parsePdfBuffer,
  createPreviewFromBuffer,
  getStagedPreview,
  discardStaging,
  findDuplicate,
  matchVehicle,
  confirmImport,
  stagePreview,
  computeConfidence,
};
