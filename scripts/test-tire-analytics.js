/**
 * FLEETOS TYR-5 — Tire Analytics tests
 * node scripts/test-tire-analytics.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/tireSeasonalSchedulerService",
  "/services/tireAlertService",
  "/services/tireAnalyticsService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-tyr5-",
  "test-tire-analytics.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const tireService = require("../services/tireService");
const tireHistoryService = require("../services/tireHistoryService");
const tireAlertService = require("../services/tireAlertService");
const tireAnalyticsService = require("../services/tireAnalyticsService");
const { tireAnalyticsPageHtml } = require("../lib/components/tireAnalytics");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-02-01T12:00:00");
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

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function main() {
  console.log("FLEETOS TYR-5 Tire Analytics tests\n");

  test("analytics service loads", () => {
    assert(typeof tireAnalyticsService.buildTireAnalytics === "function", "missing builder");
  });

  test("empty state does not crash", () => {
    const empty = tireAnalyticsService.buildTireAnalytics(REF);
    assert(empty.health && typeof empty.health === "object", "missing health");
    assert(empty.health.total_tire_records === 0, "records");
    assert(empty.health.tire_health_score === null, "score");
    assert(empty.health.tire_health_status === "unknown", empty.health.tire_health_status);
    assert(Array.isArray(empty.vehicle_tire_ranking), "ranking");
    assert(Array.isArray(empty.season_distribution), "season_distribution");
    assert(Array.isArray(empty.status_distribution), "status_distribution");
    assert(Array.isArray(empty.monthly_tire_cost_trend), "monthly_tire_cost_trend");
    assert(empty.seasonal_risk_summary && typeof empty.seasonal_risk_summary === "object", "seasonal_risk_summary");
    assert(Array.isArray(empty.insights), "insights");
    assert(empty.insights.length > 0, "insights empty");
  });

  const vehicleReady = seedVehicle("16 TYR R01");
  const vehicleMismatch = seedVehicle("34 TYR M99");
  const vehicleAttentionLow = seedVehicle("06 TYR A01");
  const vehicleAttentionHigh = seedVehicle("41 TYR A88");
  const vehicleUnknown = seedVehicle("07 TYR U00");

  tireService.createTireRecord({
    vehicle_id: vehicleReady,
    season: "winter",
    brand: "Pirelli",
    quantity: 4,
    status: "on_vehicle",
    cost: 12000,
    purchase_date: "2025-11-10",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleMismatch,
    season: "summer",
    brand: "Michelin",
    quantity: 4,
    status: "on_vehicle",
    cost: 5000,
    purchase_date: "2025-06-01",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleAttentionLow,
    season: "summer",
    brand: "Continental",
    quantity: 4,
    status: "on_vehicle",
    cost: 1000,
    purchase_date: "2025-05-01",
  });
  tireService.createTireRecord({
    vehicle_id: vehicleAttentionLow,
    season: "winter",
    brand: "Continental",
    quantity: 4,
    status: "in_storage",
    cost: 1000,
    purchase_date: "2025-11-01",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleAttentionHigh,
    season: "summer",
    brand: "Bridgestone",
    quantity: 4,
    status: "on_vehicle",
    cost: 8000,
    purchase_date: "2025-05-15",
  });
  tireService.createTireRecord({
    vehicle_id: vehicleAttentionHigh,
    season: "winter",
    brand: "Bridgestone",
    quantity: 4,
    status: "in_storage",
    cost: 8000,
    purchase_date: "2025-11-15",
  });

  tireHistoryService.createTireChangeRecord({
    vehicle_id: vehicleMismatch,
    change_type: "seasonal_swap",
    change_date: "2025-10-20",
    season: "summer",
    quantity: 4,
    cost: 1500,
  });

  tireHistoryService.createTireChangeRecord({
    vehicle_id: vehicleAttentionHigh,
    change_type: "seasonal_swap",
    change_date: "2026-01-05",
    season: "winter",
    quantity: 4,
    cost: 900,
  });

  tireAlertService.generateTireAlerts(REF);

  const analytics = tireAnalyticsService.buildTireAnalytics(REF);

  test("health object exists", () => {
    assert(analytics.health.total_tire_records === 6, `records ${analytics.health.total_tire_records}`);
    assert(analytics.health.vehicles_with_tires === 4, `vehicles ${analytics.health.vehicles_with_tires}`);
  });

  test("total quantity calculation works", () => {
    assert(analytics.health.total_quantity === 24, `quantity ${analytics.health.total_quantity}`);
  });

  test("total cost calculation works", () => {
    assert(
      analytics.health.total_cost === 12000 + 5000 + 1000 + 1000 + 8000 + 8000,
      `cost ${analytics.health.total_cost}`
    );
  });

  test("vehicle_tire_ranking exists", () => {
    assert(analytics.vehicle_tire_ranking.length >= 4, `ranking ${analytics.vehicle_tire_ranking.length}`);
  });

  test("ranking sort works", () => {
    const ranking = analytics.vehicle_tire_ranking;
    assert(ranking[0].seasonal_status === "mismatch", `first ${ranking[0].seasonal_status}`);
    assert(ranking[1].seasonal_status === "attention", `second ${ranking[1].seasonal_status}`);
    assert(ranking[2].seasonal_status === "attention", "third attention");
    assert(ranking[2].total_cost >= ranking[3].total_cost || ranking[3].seasonal_status !== "attention", "attention cost sort");
    const attentionRows = ranking.filter((row) => row.seasonal_status === "attention");
    if (attentionRows.length >= 2) {
      assert(attentionRows[0].total_cost >= attentionRows[1].total_cost, "attention cost descending");
    }
  });

  test("season_distribution exists", () => {
    assert(analytics.season_distribution.length >= 2, "season_distribution");
    assert(analytics.season_distribution[0].quantity >= analytics.season_distribution[1].quantity, "season qty sort");
  });

  test("status_distribution exists", () => {
    assert(analytics.status_distribution.length >= 2, "status_distribution");
    assert(analytics.status_distribution[0].quantity >= analytics.status_distribution[1].quantity, "status qty sort");
  });

  test("monthly_tire_cost_trend exists", () => {
    assert(analytics.monthly_tire_cost_trend.length >= 1, `trend ${analytics.monthly_tire_cost_trend.length}`);
    if (analytics.monthly_tire_cost_trend.length >= 2) {
      assert(
        analytics.monthly_tire_cost_trend[0].month >= analytics.monthly_tire_cost_trend[1].month,
        "newest first"
      );
    }
  });

  test("seasonal_risk_summary exists", () => {
    assert(typeof analytics.seasonal_risk_summary.ready === "number", "ready");
    assert(analytics.seasonal_risk_summary.mismatch >= 1, `mismatch ${analytics.seasonal_risk_summary.mismatch}`);
    assert(analytics.seasonal_risk_summary.attention >= 2, `attention ${analytics.seasonal_risk_summary.attention}`);
  });

  test("health score penalty calculation works", () => {
    const score = tireAnalyticsService.computeTireHealthScore(
      {
        season_mismatch_count: analytics.health.season_mismatch_count,
        attention_count: analytics.health.attention_count,
        unknown_count: analytics.health.unknown_count,
        unread_alert_count: analytics.health.unread_alert_count,
      },
      true
    );
    assert(score != null && score < 100, `score ${score}`);
    assert(analytics.health.tire_health_score === score, "health score synced");
    assert(["healthy", "watch", "risk", "critical"].includes(analytics.health.tire_health_status), "status");
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

  test("optional date param works", () => {
    const dated = tireAnalyticsService.buildTireAnalytics(new Date("2026-06-01"));
    assert(dated.reference_date === "2026-06-01", dated.reference_date);
  });

  test("UI page renders", () => {
    const html = tireAnalyticsPageHtml(analytics);
    assert(html.includes("Lastik Analitiği"), "title");
    assert(html.includes("Lastik Sağlık Skoru"), "health");
    assert(html.includes("Araç Lastik Sıralaması"), "ranking");
    assert(html.includes("Sezon Dağılımı"), "season");
    assert(html.includes("Durum Dağılımı"), "status");
    assert(html.includes("Aylık Lastik Maliyet Trendi"), "trend");
    assert(html.includes("Yönetici Öngörüleri"), "insights");
  });

  test("TYR-1/2/3/4 regression remains compatible", () => {
    assert(typeof tireService.listTireRecords === "function", "tire service");
    assert(typeof tireHistoryService.listTireChangeRecords === "function", "history service");
    assert(typeof tireAlertService.buildTireAlertPayload === "function", "alert service");
    assert(tireService.listTireRecords().length === 6, "tire records intact");
    assert(tireHistoryService.listTireChangeRecords().length === 2, "history intact");
    const payload = tireAlertService.buildTireAlertPayload({}, REF);
    assert(Array.isArray(payload.alerts), "alerts payload");
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
