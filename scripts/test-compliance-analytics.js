/**
 * FLEETOS CC-6 — Compliance analytics tests
 * node scripts/test-compliance-analytics.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/complianceStatusService",
  "/services/complianceAnalyticsService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-cc6-",
  "test-compliance-analytics.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const documentService = require("../services/documentService");
const complianceAnalyticsService = require("../services/complianceAnalyticsService");
const { complianceAnalyticsPageHtml } = require("../lib/components/complianceAnalytics");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");
const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  PASS  ${name}`);
}

function fail(name, msg) {
  results.push({ name, ok: false, err: msg });
  console.log(`  FAIL  ${name}: ${msg}`);
}

function assert(name, cond, msg) {
  if (cond) pass(name);
  else fail(name, msg);
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

function seedDoc(vehicleId, expiryDate, suffix, type = "traffic_insurance") {
  return documentService.create({
    vehicle_id: vehicleId,
    document_type: type,
    expiry_date: expiryDate,
    policy_number: `CC6-${suffix}`,
  });
}

function main() {
  console.log("FLEETOS CC-6 Compliance Analytics\n");

  console.log("1) Empty state");
  const empty = complianceAnalyticsService.buildComplianceAnalytics(REF);
  assert("health object exists", empty.health && typeof empty.health === "object", "missing health");
  assert("empty fleet score null", empty.health.fleet_health_score === null, `score ${empty.health.fleet_health_score}`);
  assert("empty health status unknown", empty.health.fleet_health_status === "unknown", empty.health.fleet_health_status);
  assert("vehicle ranking array", Array.isArray(empty.vehicle_risk_ranking), "missing ranking");
  assert("type distribution array", Array.isArray(empty.document_type_distribution), "missing distribution");
  assert("upcoming renewals array", Array.isArray(empty.upcoming_renewals), "missing renewals");
  assert("insights array", Array.isArray(empty.insights) && empty.insights.length > 0, "missing insights");

  console.log("\n2) Populated analytics");
  const vehicleA = seedVehicle("16 CC6 A");
  const vehicleB = seedVehicle("16 CC6 B");
  seedDoc(vehicleA, addDays(REF, 90), "active", "traffic_insurance");
  seedDoc(vehicleA, addDays(REF, 45), "warning", "casco");
  seedDoc(vehicleB, addDays(REF, 15), "critical", "traffic_insurance");
  seedDoc(vehicleB, addDays(REF, -1), "expired", "inspection");

  const analytics = complianceAnalyticsService.buildComplianceAnalytics(REF);
  assert("total documents counted", analytics.health.total_documents === 4, `got ${analytics.health.total_documents}`);
  assert("summary counts", analytics.health.warning === 1 && analytics.health.critical === 1 && analytics.health.expired === 1, "summary mismatch");
  assert(
    "fleet health score calculated",
    analytics.health.fleet_health_score != null && Number.isFinite(analytics.health.fleet_health_score),
    `score ${analytics.health.fleet_health_score}`
  );
  assert(
    "fleet health status mapped",
    ["healthy", "watch", "risk", "critical"].includes(analytics.health.fleet_health_status),
    analytics.health.fleet_health_status
  );
  assert("vehicle ranking populated", analytics.vehicle_risk_ranking.length === 2, `got ${analytics.vehicle_risk_ranking.length}`);
  assert(
    "vehicle ranking sorted by risk",
    analytics.vehicle_risk_ranking[0].expired_count >= analytics.vehicle_risk_ranking[1].expired_count,
    "sort order wrong"
  );
  assert("document type distribution populated", analytics.document_type_distribution.length >= 3, "distribution empty");
  assert("upcoming renewals populated", analytics.upcoming_renewals.length === 3, `got ${analytics.upcoming_renewals.length}`);
  assert("renewals max 20", analytics.upcoming_renewals.length <= 20, "too many renewals");
  assert("insights populated", analytics.insights.length > 0, "no insights");

  console.log("\n3) Optional date param / API shape");
  const dated = complianceAnalyticsService.buildComplianceAnalytics(new Date("2026-06-01"));
  assert("reference_date present", dated.reference_date === "2026-06-01", dated.reference_date);
  let jsonOk = true;
  try {
    JSON.stringify(dated);
  } catch {
    jsonOk = false;
  }
  assert("API JSON serializable", jsonOk, "json failed");

  console.log("\n4) UI page render");
  const html = complianceAnalyticsPageHtml(analytics);
  assert("page title", html.includes("Uygunluk Analitiği"), "missing title");
  assert("health section", html.includes("Filo Sağlık Skoru"), "missing health");
  assert("vehicle ranking section", html.includes("Vehicle Risk Ranking"), "missing ranking");
  assert("distribution section", html.includes("Document Type Distribution"), "missing distribution");
  assert("renewals section", html.includes("Upcoming Renewals"), "missing renewals");
  assert("insights section", html.includes("Executive Insights"), "missing insights");

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
