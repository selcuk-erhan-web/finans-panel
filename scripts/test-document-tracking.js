/**
 * FLEETOS-MAINTENANCE-02 — evrak takip testleri (temp DB)
 * node scripts/test-document-tracking.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = ["/services/documentService", "/services/alertService", "/services/profitService"];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-doc-test-",
  "test-document-tracking.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const documentService = require("../services/documentService");
const alertService = require("../services/alertService");
const { normalizePlate } = require("../utils/plate");
const { parseDateInput } = require("../utils/date");

const REF = new Date("2026-06-01T12:00:00");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  cleanupTestDatabase(tmpDir);
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function addDoc(vehicleId, type, expiry, note = "") {
  return documentService.create({
    vehicle_id: vehicleId,
    document_type: type,
    expiry_date: expiry,
    note,
  });
}

function main() {
  console.log("1) Evrak kaydı ekleme…");
  const vehicleId = seedVehicle("16 SYV 16");
  const created = addDoc(vehicleId, "inspection", "2026-06-06", "Muayene test");
  assert(created.id, "create id");
  assert(created.vehicle_id === vehicleId, "vehicle");
  assert(created.document_type === "inspection", "type");
  assert(created.expiry_date === "2026-06-06", "expiry");

  console.log("2) Durum hesaplama…");
  assert(documentService.computeStatus("2026-05-20", REF) === "expired", "expired");
  assert(documentService.computeStatus("2026-06-06", REF) === "critical", "critical");
  assert(documentService.computeStatus("2026-06-20", REF) === "warning", "warning");
  assert(documentService.computeStatus("2026-07-15", REF) === "upcoming", "upcoming");
  assert(documentService.computeStatus("2027-01-01", REF) === "ok", "ok");
  assert(documentService.computeStatus(null, REF) === "no_date", "no_date");

  console.log("3) Türkçe tarih parse…");
  assert(parseDateInput("15.07.2026") === "2026-07-15", "dd.mm.yyyy");
  assert(parseDateInput("2026-07-15") === "2026-07-15", "iso");

  console.log("4) Araç bazlı listeleme…");
  addDoc(vehicleId, "casco", "2026-07-01", "Kasko");
  const byVehicle = documentService.listByVehicle(vehicleId, REF);
  assert(byVehicle.length === 2, `vehicle list ${byVehicle.length}`);

  console.log("5) Filo yaklaşan evraklar…");
  const v2 = seedVehicle("34 ABC 99");
  addDoc(v2, "traffic_insurance", "2026-05-10");
  addDoc(v2, "seat_insurance", "2026-07-20");
  addDoc(vehicleId, "license_note", null, "Ruhsat notu");

  const upcoming = documentService.listUpcoming(REF);
  assert(upcoming.length >= 3, `upcoming ${upcoming.length}`);
  assert(upcoming.every((d) => d.expiry_date), "upcoming dated");
  assert(upcoming[0].daysLeft <= upcoming[1].daysLeft, "sorted by daysLeft");

  const kpi = documentService.getKpiSummary(REF);
  assert(kpi.expired >= 1, "kpi expired");
  assert(kpi.within7 >= 1, "kpi within7");

  console.log("6) DOCUMENT_EXPIRY alert üretimi…");
  const docAlerts = alertService.detectDocumentExpiryAlerts(REF);
  assert(docAlerts.length >= 3, `doc alerts ${docAlerts.length}`);
  const critical = docAlerts.find(
    (a) => a.type === "DOCUMENT_EXPIRY" && a.plate === "16 SYV 16" && a.daysLeft === 5
  );
  assert(critical, "critical doc alert");
  assert(critical.severity === "critical", "severity critical");
  assert(critical.message.includes("5 gün"), critical.message);

  const expiredAlert = docAlerts.find((a) => a.plate === "34 ABC 99" && a.daysLeft < 0);
  assert(expiredAlert?.severity === "critical", "expired alert critical");

  console.log("8) Compliance UI smoke…");
  const { documentsPageHtml } = require("../lib/components/documents");
  const ui = documentsPageHtml({
    kpi,
    upcoming,
    rows: documentService.listAll({}, REF),
    vehicles: [{ id: vehicleId, plate: "16 SYV 16" }, { id: v2, plate: "34 ABC 99" }],
    filters: {},
  });
  assert(ui.includes("Uygunluk Merkezi"), "compliance page title");
  assert(ui.includes("PDF'den Otomatik Evrak Aktar"), "import panel title");
  assert(ui.includes("Manuel Evrak Kaydı"), "manual form title");
  assert(ui.includes('enctype="multipart/form-data"'), "import multipart form");
  assert(ui.includes("/documents/import/preview"), "import preview route");
  assert(ui.includes('name="issue_date"'), "issue_date in form");

  console.log("9) Boş veri — hata yok…");
  const { tmpDir: emptyDir } = prepareIsolatedTestDatabase(
    "fleetos-doc-empty-",
    "test-document-tracking-empty",
    CACHE_PATTERNS
  );
  const docSvc = require("../services/documentService");
  const alertSvc = require("../services/alertService");
  assert(docSvc.listAll().length === 0, "empty list");
  assert(alertSvc.detectDocumentExpiryAlerts().length === 0, "empty alerts");
  cleanupTestDatabase(emptyDir);

  console.log("\n✓ FLEETOS-MAINTENANCE-02 tests passed");
  cleanup();
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  cleanup();
  process.exit(1);
}
