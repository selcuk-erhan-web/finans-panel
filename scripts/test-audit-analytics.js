/**
 * FLEETOS AUD-5 — Audit Analytics tests
 * node scripts/test-audit-analytics.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/auditAnalyticsService",
  "/services/auditDashboardService",
  "/services/auditLogService",
  "/services/auditDiffService",
  "/services/maintenanceService",
  "/services/tireService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-aud5-",
  "test-audit-analytics.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const auditAnalyticsService = require("../services/auditAnalyticsService");
const auditLogService = require("../services/auditLogService");
const maintenanceService = require("../services/maintenanceService");
const tireService = require("../services/tireService");
const { auditAnalyticsPageHtml } = require("../lib/components/auditAnalytics");
const { normalizePlate } = require("../utils/plate");

const REF = new Date();
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
  console.log("FLEETOS AUD-5 Audit Analytics tests\n");

  test("audit analytics service loads", () => {
    assert(typeof auditAnalyticsService.buildAuditAnalytics === "function", "missing builder");
  });

  test("empty state does not crash", () => {
    const empty = auditAnalyticsService.buildAuditAnalytics(REF);
    assert(empty.health && typeof empty.health === "object", "health");
    assert(empty.health.total_logs === 0, "total_logs");
    assert(empty.health.audit_health_score === null, "score");
    assert(empty.health.audit_health_status === "unknown", empty.health.audit_health_status);
    assert(Array.isArray(empty.module_distribution), "module_distribution");
    assert(Array.isArray(empty.action_distribution), "action_distribution");
    assert(Array.isArray(empty.actor_activity), "actor_activity");
    assert(Array.isArray(empty.entity_type_distribution), "entity_type_distribution");
    assert(Array.isArray(empty.daily_activity_trend), "daily_activity_trend");
    assert(Array.isArray(empty.critical_changes), "critical_changes");
    assert(Array.isArray(empty.insights), "insights");
    assert(empty.insights.length > 0, "insights empty");
    assert(empty.daily_activity_trend.length === auditAnalyticsService.TREND_DAYS, "trend days");
  });

  const vehicleId = seedVehicle("16 AUD A5");
  const actor = { actor_id: "9", actor_name: "Selçuk" };

  maintenanceService.createMaintenanceRecord(
    {
      vehicle_id: vehicleId,
      maintenance_type: "engine_oil",
      maintenance_date: "2026-06-18",
      odometer_km: 245000,
      cost: 8500,
      vendor: "Servis",
    },
    actor
  );

  const maintenance = maintenanceService.listMaintenanceRecords()[0];
  maintenanceService.updateMaintenanceRecord(
    maintenance.id,
    { odometer_km: 255000, cost: 9000 },
    actor
  );

  tireService.createTireRecord(
    {
      vehicle_id: vehicleId,
      season: "summer",
      brand: "Michelin",
      quantity: 4,
      status: "in_storage",
      cost: 12000,
    },
    actor
  );

  auditLogService.createAuditLog({
    module: "compliance",
    entity_type: "vehicle_document",
    entity_id: "doc-1",
    action: "import",
    actor_id: "system",
    actor_name: "System",
    summary: "PDF import edildi.",
    metadata: { file_name: "belge.pdf" },
  });

  db.prepare(
    `INSERT INTO audit_logs (action, entity_type, entity_id, note, created_at)
     VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`
  ).run("maintenance_delete", "maintenance_record", "legacy-old", "Eski kayıt silindi");

  const analytics = auditAnalyticsService.buildAuditAnalytics(REF);

  test("health object exists", () => {
    assert(analytics.health.total_logs >= 4, `total ${analytics.health.total_logs}`);
    assert(typeof analytics.health.today_total === "number", "today");
    assert(typeof analytics.health.last_7_days_total === "number", "last7");
  });

  test("total logs calculation works", () => {
    assert(analytics.health.total_logs >= 4, analytics.health.total_logs);
  });

  test("today_total works", () => {
    assert(analytics.health.today_total >= 3, analytics.health.today_total);
  });

  test("last_7_days_total works", () => {
    assert(analytics.health.last_7_days_total >= 4, analytics.health.last_7_days_total);
  });

  test("module_distribution exists and sorted", () => {
    assert(analytics.module_distribution.length >= 2, "modules");
    assert(
      analytics.module_distribution[0].count >= analytics.module_distribution[1].count,
      "module sort"
    );
  });

  test("action_distribution exists and sorted", () => {
    assert(analytics.action_distribution.length >= 2, "actions");
    assert(
      analytics.action_distribution[0].count >= analytics.action_distribution[1].count,
      "action sort"
    );
  });

  test("actor_activity exists and sorted", () => {
    assert(analytics.actor_activity.length >= 1, "actors");
    assert(analytics.actor_activity[0].count >= 1, "actor count");
    if (analytics.actor_activity.length > 1) {
      assert(
        analytics.actor_activity[0].count >= analytics.actor_activity[1].count,
        "actor sort"
      );
    }
  });

  test("entity_type_distribution exists", () => {
    assert(analytics.entity_type_distribution.length >= 1, "entity types");
  });

  test("daily_activity_trend exists", () => {
    assert(analytics.daily_activity_trend.length === auditAnalyticsService.TREND_DAYS, "days");
    assert(analytics.daily_activity_trend[0].date >= analytics.daily_activity_trend[1].date, "sort");
  });

  test("critical_changes exists", () => {
    assert(Array.isArray(analytics.critical_changes), "critical_changes");
  });

  test("health score penalty works", () => {
    const score = auditAnalyticsService.computeAuditHealthScore(2, 3, 1, true);
    assert(score === 100 - 20 - 6 - 5, `score ${score}`);
    const emptyScore = auditAnalyticsService.computeAuditHealthScore(0, 0, 0, false);
    assert(emptyScore === null, "empty score");
    assert(analytics.health.audit_health_score != null, "populated score");
    assert(analytics.health.audit_health_score >= 0 && analytics.health.audit_health_score <= 100, "clamp");
  });

  test("insights array exists", () => {
    assert(analytics.insights.length > 0, "insights");
    assert(analytics.insights.some((item) => item.message), "message");
  });

  test("filters work", () => {
    const filtered = auditAnalyticsService.buildAuditAnalytics(REF, { module: "maintenance" });
    assert(filtered.health.total_logs >= 1, "maintenance filter");
    assert(
      filtered.module_distribution.every((row) => row.module === "maintenance"),
      "only maintenance"
    );
  });

  test("API returns JSON", () => {
    let ok = true;
    try {
      JSON.stringify(analytics);
    } catch {
      ok = false;
    }
    assert(ok, "serializable");
    assert(analytics.reference_date, "reference_date");
  });

  test("optional date/date range works", () => {
    const ranged = auditAnalyticsService.buildAuditAnalytics(new Date("2026-06-01"), {
      date_from: "2026-05-20",
      date_to: "2026-06-01",
    });
    assert(ranged.reference_date === "2026-06-01", ranged.reference_date);
    assert(ranged.filters.date_from === "2026-05-20", ranged.filters.date_from);
  });

  test("legacy rows do not crash", () => {
    const legacy = auditAnalyticsService.buildAuditAnalytics(REF);
    assert(legacy.health.total_logs >= 0, "legacy safe");
  });

  test("UI page renders", () => {
    const html = auditAnalyticsPageHtml(analytics, analytics.filters || {});
    assert(html.includes("Denetim Analitiği"), "title");
    assert(html.includes("Audit Health Score"), "health");
    assert(html.includes("Modül Dağılımı"), "modules");
    assert(html.includes("Kritik Değişiklikler"), "critical");
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
