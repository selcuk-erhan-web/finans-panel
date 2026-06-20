/**
 * FLEETOS MNT-5 — Maintenance Analytics tests
 * node scripts/test-maintenance-analytics.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/maintenanceService",
  "/services/maintenanceSchedulerService",
  "/services/maintenanceAnalyticsService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-mnt5-",
  "test-maintenance-analytics.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const maintenanceService = require("../services/maintenanceService");
const maintenanceAnalyticsService = require("../services/maintenanceAnalyticsService");
const { maintenanceAnalyticsPageHtml } = require("../lib/components/maintenanceAnalytics");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");
const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, error: err.message || String(err) });
  console.error(`✗ ${name}: ${err.message || err}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

function seedVehicle(plate, km) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type, current_km) VALUES (?, ?, 'Servis', ?)")
    .run(plate, norm, km).lastInsertRowid;
}

function main() {
  console.log("FLEETOS MNT-5 Maintenance Analytics tests\n");

  test("analytics service loads", () => {
    assert(typeof maintenanceAnalyticsService.buildMaintenanceAnalytics === "function", "missing builder");
  });

  test("empty state does not crash", () => {
    const empty = maintenanceAnalyticsService.buildMaintenanceAnalytics(REF);
    assert(empty.health && typeof empty.health === "object", "missing health");
    assert(empty.health.total_records === 0, "records");
    assert(empty.health.maintenance_health_score === null, "score");
    assert(empty.health.maintenance_health_status === "unknown", empty.health.maintenance_health_status);
    assert(Array.isArray(empty.vehicle_cost_ranking), "ranking");
    assert(Array.isArray(empty.maintenance_type_distribution), "distribution");
    assert(Array.isArray(empty.monthly_cost_trend), "trend");
    assert(empty.risk_summary && typeof empty.risk_summary === "object", "risk_summary");
    assert(Array.isArray(empty.insights), "insights");
    assert(empty.insights.length > 0, "insights empty");
  });

  const vehicleA = seedVehicle("16 MNT A", 47000);
  const vehicleB = seedVehicle("34 MNT B", 112000);
  const vehicleC = seedVehicle("06 MNT C", 110000);

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "engine_oil",
    maintenance_date: "2026-01-10",
    odometer_km: 40000,
    cost: 2500,
    vendor: "Servis A",
    description: "Yağ bakımı",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "periodic_maintenance",
    maintenance_date: "2026-03-15",
    odometer_km: 45000,
    cost: 8500,
    vendor: "Servis A",
    description: "Periyodik bakım",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleB,
    maintenance_type: "engine_oil",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 1200,
    vendor: "Servis B",
    description: "Overdue vehicle",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleC,
    maintenance_type: "periodic_maintenance",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 4200,
    vendor: "Servis C",
    description: "Due vehicle",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleC,
    maintenance_type: "air_filter",
    maintenance_date: "2026-02-01",
    odometer_km: 105000,
    cost: 900,
    vendor: "Servis C",
    description: "Extra filter",
  });

  const analytics = maintenanceAnalyticsService.buildMaintenanceAnalytics(REF);

  test("health object exists", () => {
    assert(analytics.health.total_records === 5, `records ${analytics.health.total_records}`);
    assert(analytics.health.vehicles_with_maintenance === 3, `vehicles ${analytics.health.vehicles_with_maintenance}`);
  });

  test("total cost calculation works", () => {
    assert(analytics.health.total_cost === 2500 + 8500 + 1200 + 4200 + 900, `cost ${analytics.health.total_cost}`);
  });

  test("average cost calculation works", () => {
    assert(analytics.health.average_cost_per_record === Math.round(analytics.health.total_cost / 5), "average");
  });

  test("vehicle_cost_ranking exists", () => {
    assert(analytics.vehicle_cost_ranking.length === 3, `ranking ${analytics.vehicle_cost_ranking.length}`);
  });

  test("vehicle ranking sorted correctly", () => {
    const ranking = analytics.vehicle_cost_ranking;
    assert(ranking[0].total_cost >= ranking[1].total_cost, "cost sort");
    assert(ranking[0].plate === "16 MNT A", `top vehicle ${ranking[0].plate}`);
  });

  test("maintenance_type_distribution exists", () => {
    assert(analytics.maintenance_type_distribution.length >= 3, "distribution");
  });

  test("type distribution sorted correctly", () => {
    const types = analytics.maintenance_type_distribution;
    assert(types[0].total_cost >= types[1].total_cost, "type cost sort");
    assert(types[0].maintenance_type === "periodic_maintenance", `top type ${types[0].maintenance_type}`);
  });

  test("monthly_cost_trend exists", () => {
    assert(analytics.monthly_cost_trend.length >= 2, `trend ${analytics.monthly_cost_trend.length}`);
    assert(analytics.monthly_cost_trend[0].month >= analytics.monthly_cost_trend[1].month, "newest first");
  });

  test("risk_summary exists", () => {
    assert(typeof analytics.risk_summary.ok === "number", "ok");
    assert(analytics.risk_summary.overdue >= 1, `overdue ${analytics.risk_summary.overdue}`);
    assert(analytics.risk_summary.due >= 1, `due ${analytics.risk_summary.due}`);
  });

  test("health score penalty calculation works", () => {
    const score = maintenanceAnalyticsService.computeMaintenanceHealthScore(analytics.risk_summary);
    assert(score != null && score < 100, `score ${score}`);
    assert(analytics.health.maintenance_health_score === score, "health score synced");
    assert(["healthy", "watch", "risk", "critical"].includes(analytics.health.maintenance_health_status), "status");
  });

  test("insights array exists", () => {
    assert(analytics.insights.length > 0, "insights");
    assert(analytics.insights.every((item) => item.message && item.level), "insight shape");
  });

  test("API returns JSON", () => {
    let ok = true;
    try {
      JSON.stringify(analytics);
    } catch {
      ok = false;
    }
    assert(ok, "json serializable");
  });

  test("optional date param works if route supports it", () => {
    const dated = maintenanceAnalyticsService.buildMaintenanceAnalytics(new Date("2026-06-01"));
    assert(dated.reference_date === "2026-06-01", dated.reference_date);
  });

  test("UI page renders", () => {
    const html = maintenanceAnalyticsPageHtml(analytics);
    assert(html.includes("Bakım Analitiği"), "title");
    assert(html.includes("Bakım Sağlık Skoru"), "health");
    assert(html.includes("Araç Maliyet Sıralaması"), "ranking");
    assert(html.includes("Bakım Türü Dağılımı"), "distribution");
    assert(html.includes("Aylık Maliyet Trendi"), "trend");
    assert(html.includes("Yönetici Öngörüleri"), "insights");
  });

  console.log("\n--- PASS/FAIL SUMMARY ---");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`PASS: ${passed}/${results.length}`);
  if (failed.length) {
    console.log(`FAIL: ${failed.length}`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    cleanupTestDatabase(tmpDir);
    process.exit(1);
  }
  console.log("ALL TESTS PASSED");
  cleanupTestDatabase(tmpDir);
}

main();
