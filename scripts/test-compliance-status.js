/**
 * FLEETOS CC-3 — Compliance expiration engine tests
 * node scripts/test-compliance-status.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/complianceStatusService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-cc3-",
  "test-compliance-status.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const documentService = require("../services/documentService");
const complianceStatusService = require("../services/complianceStatusService");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  PASS  ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, err: err.message });
  console.log(`  FAIL  ${name}: ${err.message}`);
}

function assert(name, cond, msg) {
  if (cond) pass(name);
  else fail(name, new Error(msg));
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function seedDocument(vehicleId, expiryDate, suffix) {
  return documentService.create({
    vehicle_id: vehicleId,
    document_type: "traffic_insurance",
    expiry_date: expiryDate,
    policy_number: `CC3-${suffix}`,
  });
}

function main() {
  console.log("FLEETOS CC-3 Compliance Expiration Engine\n");

  console.log("1) Status thresholds");
  assert(
    "active document (90 days ahead)",
    complianceStatusService.calculateComplianceStatus(addDays(REF, 90), REF) === "active",
    `got ${complianceStatusService.calculateComplianceStatus(addDays(REF, 90), REF)}`
  );
  assert(
    "warning document (45 days ahead)",
    complianceStatusService.calculateComplianceStatus(addDays(REF, 45), REF) === "warning",
    `got ${complianceStatusService.calculateComplianceStatus(addDays(REF, 45), REF)}`
  );
  assert(
    "critical document (15 days ahead)",
    complianceStatusService.calculateComplianceStatus(addDays(REF, 15), REF) === "critical",
    `got ${complianceStatusService.calculateComplianceStatus(addDays(REF, 15), REF)}`
  );
  assert(
    "expired document (yesterday)",
    complianceStatusService.calculateComplianceStatus(addDays(REF, -1), REF) === "expired",
    `got ${complianceStatusService.calculateComplianceStatus(addDays(REF, -1), REF)}`
  );

  console.log("\n2) Days remaining");
  assert(
    "days_remaining for 15 days ahead",
    complianceStatusService.calculateDaysRemaining(addDays(REF, 15), REF) === 15,
    `got ${complianceStatusService.calculateDaysRemaining(addDays(REF, 15), REF)}`
  );
  assert(
    "days_remaining for yesterday",
    complianceStatusService.calculateDaysRemaining(addDays(REF, -1), REF) === -1,
    `got ${complianceStatusService.calculateDaysRemaining(addDays(REF, -1), REF)}`
  );

  console.log("\n3) Score calculation");
  const mixedRecords = [
    { expiry_date: addDays(REF, 90) },
    { expiry_date: addDays(REF, 45) },
  ];
  assert(
    "mixed record score average",
    complianceStatusService.calculateComplianceScore(mixedRecords, REF) === 88,
    `expected 88 got ${complianceStatusService.calculateComplianceScore(mixedRecords, REF)}`
  );
  assert(
    "empty records score is null",
    complianceStatusService.calculateComplianceScore([], REF) === null,
    "expected null"
  );
  assert(
    "undated records score is null",
    complianceStatusService.calculateComplianceScore([{ expiry_date: null }], REF) === null,
    "expected null"
  );

  console.log("\n4) API report payload");
  const vehicleWithDocs = seedVehicle("16 CC3 01");
  const emptyVehicleId = seedVehicle("16 CC3 EMPTY");

  seedDocument(vehicleWithDocs, addDays(REF, 90), "active");
  seedDocument(vehicleWithDocs, addDays(REF, 45), "warning");
  seedDocument(vehicleWithDocs, addDays(REF, 15), "critical");
  seedDocument(vehicleWithDocs, addDays(REF, -1), "expired");

  const report = complianceStatusService.buildStatusReport(REF);

  assert("summary.active", report.summary.active === 1, `got ${report.summary.active}`);
  assert("summary.warning", report.summary.warning === 1, `got ${report.summary.warning}`);
  assert("summary.critical", report.summary.critical === 1, `got ${report.summary.critical}`);
  assert("summary.expired", report.summary.expired === 1, `got ${report.summary.expired}`);
  assert("records enriched", report.records.length === 4, `got ${report.records.length}`);
  assert(
    "record has days_remaining",
    report.records.every((row) => typeof row.days_remaining === "number"),
    "missing days_remaining"
  );
  assert(
    "record has risk_level",
    report.records.every((row) => row.risk_level && row.risk_level !== "unknown"),
    "missing risk_level"
  );

  const scoredVehicle = report.vehicle_scores.find((row) => row.vehicle_id === vehicleWithDocs);
  const emptyVehicle = report.vehicle_scores.find((row) => row.vehicle_id === emptyVehicleId);

  assert(
    "vehicle score from mixed records",
    scoredVehicle?.score === 54,
    `expected 54 got ${scoredVehicle?.score}`
  );
  assert(
    "vehicle status uses worst case",
    scoredVehicle?.status === "expired",
    `expected expired got ${scoredVehicle?.status}`
  );
  assert(
    "no-record vehicle score is null",
    emptyVehicle?.score === null,
    `expected null got ${emptyVehicle?.score}`
  );
  assert(
    "no-record vehicle status is unknown",
    emptyVehicle?.status === "unknown",
    `expected unknown got ${emptyVehicle?.status}`
  );

  const failed = results.filter((row) => !row.ok);
  console.log("\n" + "=".repeat(48));
  if (failed.length) {
    console.log(`RESULT: FAIL (${failed.length}/${results.length} checks failed)`);
    process.exitCode = 1;
  } else {
    console.log(`RESULT: PASS (${results.length}/${results.length} checks passed)`);
  }
}

try {
  main();
} catch (err) {
  console.error("\nUnexpected error:", err.message);
  process.exit(1);
} finally {
  cleanupTestDatabase(tmpDir);
}
