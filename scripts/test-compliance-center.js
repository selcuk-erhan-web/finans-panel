/**
 * FLEETOS CC-1 — Compliance Center data model tests (isolated temp DB)
 * node scripts/test-compliance-center.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/alertService",
  "/services/vehicleCenterService",
];

const { tmpDir, testDbPath } = prepareIsolatedTestDatabase(
  "fleetos-cc1-",
  "test-compliance-center.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const documentService = require("../services/documentService");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function columnNames() {
  return db.prepare("PRAGMA table_info(vehicle_documents)").all().map((c) => c.name);
}

function runMigrationTwice() {
  purgeDbFromRequireCache(CACHE_PATTERNS);
  delete require.cache[require.resolve("../lib/db")];
  require("../lib/db");
}

function main() {
  console.log("1) Migration columns present…");
  const cols = columnNames();
  const required = [
    "issue_date",
    "policy_number",
    "insurer",
    "premium_amount",
    "file_path",
    "file_name",
    "station",
    "result",
    "reminder_days",
  ];
  required.forEach((c) => assert(cols.includes(c), `missing column ${c}`));

  console.log("2) Migration idempotent…");
  runMigrationTwice();
  const cols2 = columnNames();
  required.forEach((c) => assert(cols2.includes(c), `column lost after re-migrate ${c}`));

  console.log("3) Old-style document create still works…");
  const vehicleId = seedVehicle("16 SYV 16");
  const legacy = documentService.create({
    vehicle_id: vehicleId,
    document_type: "inspection",
    expiry_date: "2026-06-06",
    note: "Muayene test",
  });
  assert(legacy.id, "legacy create id");
  assert(legacy.issue_date == null, "legacy issue_date null");
  assert(legacy.premium_amount == null, "legacy premium null");

  console.log("4) Insurance document with CC fields…");
  const insurance = documentService.create({
    vehicle_id: vehicleId,
    document_type: "traffic_insurance",
    expiry_date: "2027-01-15",
    issue_date: "15.01.2026",
    policy_number: "POL-12345",
    insurer: "Anadolu Sigorta",
    premium_amount: "12.500,00",
    reminder_days: 45,
  });
  assert(insurance.policy_number === "POL-12345", "policy_number");
  assert(insurance.insurer === "Anadolu Sigorta", "insurer");
  assert(insurance.premium_amount === 12500, `premium ${insurance.premium_amount}`);
  assert(insurance.issue_date === "2026-01-15", `issue_date ${insurance.issue_date}`);
  assert(insurance.reminder_days === 45, "reminder_days");

  console.log("5) Emission document with station and result…");
  const emission = documentService.create({
    vehicle_id: vehicleId,
    document_type: "emission",
    expiry_date: "2026-12-01",
    station: "TÜVTÜRK Bursa",
    result: "geçti",
  });
  assert(emission.document_type === "emission", "emission type");
  assert(emission.station === "TÜVTÜRK Bursa", "station");
  assert(emission.result === "passed", "result normalized");

  console.log("6) license_note legacy displays as Ruhsat…");
  const licenseLegacy = documentService.create({
    vehicle_id: vehicleId,
    document_type: "license_note",
    note: "Eski ruhsat kaydı",
  });
  assert(licenseLegacy.type_label === "Ruhsat", `license_note label ${licenseLegacy.type_label}`);
  assert(documentService.isComplianceType("license_note") === false, "license_note not CC type");

  console.log("7) src_psychotechnic legacy listing…");
  const src = documentService.create({
    vehicle_id: vehicleId,
    document_type: "src_psychotechnic",
    expiry_date: "2026-08-01",
    note: "SRC notu",
  });
  const all = documentService.listAll({}, REF);
  const srcRow = all.find((r) => r.id === src.id);
  assert(srcRow, "src row listed");
  assert(srcRow.type_label.includes("SRC"), `src label ${srcRow.type_label}`);
  assert(documentService.isComplianceType("src_psychotechnic") === false, "src not CC type");

  console.log("8) computeStatus unchanged…");
  assert(documentService.computeStatus("2026-05-20", REF) === "expired", "expired");
  assert(documentService.computeStatus("2026-06-06", REF) === "critical", "critical");
  assert(documentService.computeStatus("2026-06-20", REF) === "warning", "warning");
  assert(documentService.computeStatus("2026-07-15", REF) === "upcoming", "upcoming");
  assert(documentService.computeStatus("2027-01-01", REF) === "ok", "ok");
  assert(documentService.computeStatus(null, REF) === "no_date", "no_date");

  console.log("9) New fields round-trip listAll/listByVehicle…");
  const byVehicle = documentService.listByVehicle(vehicleId, REF);
  const ins = byVehicle.find((r) => r.id === insurance.id);
  assert(ins.policy_number === "POL-12345", "listByVehicle policy");
  assert(ins.premium_amount === 12500, "listByVehicle premium");

  const updated = documentService.update(insurance.id, {
    file_path: "compliance/5/policy.pdf",
    file_name: "trafik-sigortasi.pdf",
  });
  assert(updated.file_path === "compliance/5/policy.pdf", "file_path update");
  assert(updated.file_name === "trafik-sigortasi.pdf", "file_name update");

  const listed = documentService.listAll({ vehicle_id: vehicleId }, REF);
  const upd = listed.find((r) => r.id === insurance.id);
  assert(upd.file_path === "compliance/5/policy.pdf", "listAll file_path");

  console.log("10) COMPLIANCE_TYPES covers approved set…");
  const ccKeys = Object.keys(documentService.COMPLIANCE_TYPES);
  assert(ccKeys.length === 7, `cc types ${ccKeys.length}`);
  assert(documentService.isComplianceType("license"), "license is compliance");
  assert(documentService.isComplianceType("emission"), "emission is compliance");
  assert(documentService.INSURANCE_TYPES.has("casco"), "insurance set");
  assert(documentService.TECHNICAL_TYPES.has("inspection"), "technical set");

  console.log("\n✓ FLEETOS CC-1 compliance center tests passed");
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  process.exit(1);
} finally {
  cleanupTestDatabase(tmpDir);
}
