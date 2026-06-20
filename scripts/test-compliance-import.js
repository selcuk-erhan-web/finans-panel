/**
 * FLEETOS CC-2B — Compliance PDF import tests
 * node scripts/test-compliance-import.js
 */
const fs = require("fs");
const path = require("path");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const FIXTURES = path.join(__dirname, "fixtures", "compliance");
const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/complianceImportService",
  "/lib/db.js",
];

const { tmpDir, testDbPath } = prepareIsolatedTestDatabase(
  "fleetos-cc-import-",
  "test-compliance-import.js",
  CACHE_PATTERNS
);

const uploadRoot = path.join(tmpDir, "compliance-uploads");
process.env.FLEETOS_COMPLIANCE_UPLOAD_DIR = uploadRoot;

const db = require("../lib/db");
const documentService = require("../services/documentService");
const complianceImportService = require("../services/complianceImportService");
const { normalizePlate } = require("../utils/plate");
const { complianceImportUploadHtml, compliancePreviewHtml } = require("../lib/components/complianceImport");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8");
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function docCount() {
  return db.prepare("SELECT COUNT(*) AS c FROM vehicle_documents").get().c;
}

function main() {
  console.log("1) Trafik parser…");
  const trafik = complianceImportService.parseComplianceText(readFixture("trafik.txt"), {
    originalName: "trafik.pdf",
  });
  assert(trafik.fields.document_type === "traffic_insurance", "trafik type");
  assert(trafik.fields.plate === "16SYV16", `trafik plate ${trafik.fields.plate}`);
  assert(trafik.fields.policy_number === "496213067", `policy ${trafik.fields.policy_number}`);
  assert(trafik.fields.expiry_date === "2026-07-20", `expiry ${trafik.fields.expiry_date}`);

  console.log("1b) Unico trafik regression…");
  const unicoVehicleId = seedVehicle("16 SYV 16");
  const unico = complianceImportService.parseComplianceText(readFixture("trafik-unico-16syv16.txt"), {
    originalName: "16SYV16 TRAFİK SİGORTA.pdf",
  });
  assert(unico.fields.document_type === "traffic_insurance", "unico type");
  assert(unico.fields.plate === "16SYV16", `unico plate ${unico.fields.plate}`);
  assert(unico.vehicleMatch.matched === true, "unico vehicle match");
  assert(unico.vehicleMatch.plate === "16 SYV 16", `unico matched plate ${unico.vehicleMatch.plate}`);
  assert(unico.vehicleMatch.vehicleId === unicoVehicleId, "unico vehicle id");
  assert(unico.fields.policy_number === "179137511", `unico policy ${unico.fields.policy_number}`);
  assert(unico.fields.policy_number !== "KAZA", "policy not KAZA");
  assert(unico.fields.insurer && /unico/i.test(unico.fields.insurer), `unico insurer ${unico.fields.insurer}`);
  assert(!/ESKİ POLİÇE/i.test(unico.fields.insurer || ""), "insurer not ESKİ POLİÇE");
  assert(unico.fields.issue_date === "2025-07-20", `unico issue ${unico.fields.issue_date}`);
  assert(unico.fields.expiry_date === "2026-07-20", `unico expiry ${unico.fields.expiry_date}`);
  assert(
    unico.fields.premium_amount === 19881 || unico.fields.premium_amount === 19880.99,
    `unico premium ${unico.fields.premium_amount}`
  );

  console.log("2) Kasko parser spaced plate…");
  const kasko = complianceImportService.parseComplianceText(readFixture("kasko.txt"), {
    originalName: "kasko.pdf",
  });
  assert(kasko.fields.document_type === "casco", "casco type");
  assert(normalizePlate(kasko.fields.plate) === "16SYV16", `kasko plate ${kasko.fields.plate}`);
  assert(kasko.vehicleMatch.matched === true, "kasko vehicle match");
  assert(kasko.fields.expiry_date === "2026-08-01", `kasko expiry ${kasko.fields.expiry_date}`);

  console.log("3) Koltuk parser…");
  const koltuk = complianceImportService.parseComplianceText(readFixture("koltuk.txt"), {
    originalName: "koltuk.pdf",
  });
  assert(koltuk.fields.document_type === "seat_insurance", "koltuk type");
  assert(koltuk.fields.policy_number === "6692923", "koltuk policy");

  console.log("4) TÜVTÜRK parser…");
  seedVehicle("16 S 4275");
  const tuv = complianceImportService.parseComplianceText(readFixture("tuvturk.txt"), {
    originalName: "tuv.pdf",
  });
  assert(tuv.fields.document_type === "inspection", "inspection type");
  assert(tuv.fields.station === "BURSA", `station ${tuv.fields.station}`);
  assert(tuv.fields.result === "passed", `result ${tuv.fields.result}`);
  assert(tuv.fields.expiry_date === "2026-07-14", `tuv expiry ${tuv.fields.expiry_date}`);
  assert(tuv.fields.note.includes("127370"), "km in note");
  assert(tuv.vehicleMatch.matched === true, "tuv vehicle match");

  console.log("5) Scanned PDF text → OCR error…");
  let ocrThrown = false;
  try {
    complianceImportService.parseComplianceText(readFixture("ruhsat-scanned.txt"), {
      originalName: "ruhsat.pdf",
    });
  } catch (e) {
    ocrThrown = e.code === "OCR_REQUIRED";
  }
  assert(ocrThrown, "OCR_REQUIRED");

  console.log("6) Preview staging does not create documents…");
  const before = docCount();
  const buffer = Buffer.from("%PDF-1.4 mock");
  const preview = complianceImportService.parseComplianceText(readFixture("trafik.txt"), {
    originalName: "trafik.pdf",
  });
  const token = complianceImportService.stagePreview(buffer, "trafik.pdf", preview);
  assert(docCount() === before, "no doc on stage");
  assert(fs.existsSync(path.join(uploadRoot, "staging", token, "source.pdf")), "staged pdf");

  console.log("7) Confirm creates document with file_path…");
  const vehicleId = seedVehicle("16 TEST 99");
  const confirmPreview = complianceImportService.parseComplianceText(readFixture("trafik.txt"), {
    originalName: "trafik-import.pdf",
    typeHint: "traffic_insurance",
  });
  confirmPreview.vehicleMatch = { vehicleId, matched: true, plate: "16 TEST 99" };
  confirmPreview.fields.plate = "16TEST99";
  const token2 = complianceImportService.stagePreview(buffer, "trafik-import.pdf", confirmPreview);
  const result = complianceImportService.confirmImport(token2, {
    preview_token: token2,
    vehicle_id: vehicleId,
    document_type: "traffic_insurance",
    issue_date: confirmPreview.fields.issue_date,
    expiry_date: "2027-01-01",
    policy_number: "TEST-POL-999",
    insurer: "Test Sigorta",
    premium_amount: "1000",
  });
  assert(result.ok, "confirm ok");
  assert(result.document.file_path?.startsWith(`compliance/${vehicleId}/`), `path ${result.document.file_path}`);
  assert(result.document.file_name === "trafik-import.pdf", "file_name");
  assert(docCount() === before + 1, "one doc created");

  console.log("8) Duplicate detection blocks confirm…");
  const dupPreview = complianceImportService.parseComplianceText(readFixture("trafik.txt"), {
    originalName: "dup.pdf",
    typeHint: "traffic_insurance",
  });
  const token3 = complianceImportService.stagePreview(buffer, "dup.pdf", dupPreview);
  let dupBlocked = false;
  try {
    complianceImportService.confirmImport(token3, {
      preview_token: token3,
      vehicle_id: vehicleId,
      document_type: "traffic_insurance",
      expiry_date: "2027-01-01",
      policy_number: "TEST-POL-999",
    });
  } catch (e) {
    dupBlocked = e.code === "DUPLICATE";
  }
  assert(dupBlocked, "duplicate blocked");

  console.log("9) UI smoke…");
  const uploadHtml = complianceImportUploadHtml();
  assert(uploadHtml.includes("/documents/import/preview"), "preview route");
  assert(uploadHtml.includes("compliancePdfFileInput"), "file input");
  assert(uploadHtml.includes("PDF'den Otomatik Evrak Aktar"), "import title");
  assert(uploadHtml.includes('enctype="multipart/form-data"'), "multipart form");

  const { documentsPageHtml } = require("../lib/components/documents");
  const pageHtml = documentsPageHtml({
    kpi: { expired: 0, within7: 0, within30: 0, within60: 0 },
    upcoming: [],
    rows: [],
    vehicles: [{ id: 1, plate: "16 SYV 16" }],
    filters: {},
  });
  assert(pageHtml.includes("PDF'den Otomatik Evrak Aktar"), "page import title");
  assert(pageHtml.includes("Manuel Evrak Kaydı"), "manual form title");
  assert(pageHtml.includes('enctype="multipart/form-data"'), "page multipart");
  assert(pageHtml.includes("/documents/import/preview"), "page preview route");
  assert(pageHtml.includes("documents-hub__left-stack"), "left stack layout");

  const previewHtml = compliancePreviewHtml(
    { ...tuv, previewToken: "test-token", fields: tuv.fields },
    [{ id: 1, plate: "16 S 4275" }]
  );
  assert(previewHtml.includes("preview_token"), "confirm token");
  assert(previewHtml.includes('name="station"'), "station field");
  assert(previewHtml.includes("/documents/import/confirm"), "confirm route");
  assert(previewHtml.includes(">Kaydet<"), "Kaydet button");
  assert(previewHtml.includes("compliance-preview-actions"), "preview action area");
  assert(
    previewHtml.indexOf("compliance-preview-actions") < previewHtml.indexOf("</section>"),
    "actions inside preview card"
  );

  console.log("\n✓ FLEETOS CC-2B compliance import tests passed");
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  process.exit(1);
} finally {
  cleanupTestDatabase(tmpDir);
}
