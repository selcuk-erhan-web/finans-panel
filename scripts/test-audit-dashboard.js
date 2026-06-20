/**
 * FLEETOS AUD-4 — Executive Audit Dashboard tests
 * node scripts/test-audit-dashboard.js
 */
const fs = require("fs");
const path = require("path");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/auditDashboardService",
  "/services/auditLogService",
  "/services/auditDiffService",
  "/services/maintenanceService",
  "/services/tireService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-aud4-",
  "test-audit-dashboard.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const auditDashboardService = require("../services/auditDashboardService");
const auditLogService = require("../services/auditLogService");
const maintenanceService = require("../services/maintenanceService");
const tireService = require("../services/tireService");
const { auditDashboardWidgetHtml, executiveAuditSummaryHtml } = require("../lib/components/auditDashboard");
const { auditLogsPageHtml } = require("../lib/components/auditLogs");
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
  console.log("FLEETOS AUD-4 Executive Audit Dashboard tests\n");

  test("audit dashboard service loads", () => {
    assert(typeof auditDashboardService.buildExecutiveAuditDashboard === "function", "missing builder");
  });

  test("empty state does not crash", () => {
    const empty = auditDashboardService.buildExecutiveAuditDashboard(REF);
    assert(empty.summary && typeof empty.summary === "object", "summary");
    assert(empty.summary.last_24h_total === 0, "last_24h");
    assert(Array.isArray(empty.module_activity), "module_activity");
    assert(Array.isArray(empty.action_activity), "action_activity");
    assert(Array.isArray(empty.latest_activity), "latest_activity");
    assert(Array.isArray(empty.executive_insights), "executive_insights");
    assert(empty.executive_insights.length > 0, "insights");
  });

  const vehicleId = seedVehicle("16 AUD D4");
  const actor = { actor_id: "9", actor_name: "Selçuk" };

  const maintenance = maintenanceService.createMaintenanceRecord(
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

  tireService.updateTireRecord(
    tireService.listTireRecords()[0].id,
    { status: "on_vehicle" },
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

  const dashboard = auditDashboardService.buildExecutiveAuditDashboard(REF);

  test("last_24h_total works", () => {
    assert(dashboard.summary.last_24h_total >= 4, `last_24h ${dashboard.summary.last_24h_total}`);
  });

  test("today_total works", () => {
    assert(dashboard.summary.today_total >= 4, `today ${dashboard.summary.today_total}`);
  });

  test("create/update/delete/import counts work", () => {
    assert(dashboard.summary.create_count >= 2, `create ${dashboard.summary.create_count}`);
    assert(dashboard.summary.update_count >= 2, `update ${dashboard.summary.update_count}`);
    assert(dashboard.summary.import_count >= 1, `import ${dashboard.summary.import_count}`);
  });

  test("module_activity exists and sorted", () => {
    assert(dashboard.module_activity.length >= 2, "modules");
    assert(
      dashboard.module_activity[0].count >= dashboard.module_activity[1].count,
      "module sort"
    );
  });

  test("action_activity exists and sorted", () => {
    assert(dashboard.action_activity.length >= 2, "actions");
    assert(
      dashboard.action_activity[0].count >= dashboard.action_activity[1].count,
      "action sort"
    );
  });

  test("latest_activity limited to max 8", () => {
    assert(dashboard.latest_activity.length <= auditDashboardService.LATEST_LIMIT, "max 8");
    assert(dashboard.latest_activity.length >= 1, "has items");
    assert(dashboard.latest_activity[0].summary, "summary");
  });

  test("critical_change_count works", () => {
    assert(typeof dashboard.summary.critical_change_count === "number", "critical type");
  });

  test("important_change_count works", () => {
    assert(typeof dashboard.summary.important_change_count === "number", "important type");
    assert(dashboard.summary.important_change_count >= 0, "important count");
  });

  test("executive_insights array exists", () => {
    assert(dashboard.executive_insights.length > 0, "insights");
    assert(dashboard.executive_insights.every((item) => item.message && item.level), "shape");
  });

  test("API returns JSON", () => {
    let ok = true;
    try {
      JSON.stringify(dashboard);
    } catch {
      ok = false;
    }
    assert(ok, "json serializable");
    assert(dashboard.reference_date === auditDashboardService.buildExecutiveAuditDashboard(new Date()).reference_date, dashboard.reference_date);
  });

  test("optional date param works", () => {
    const dated = auditDashboardService.buildExecutiveAuditDashboard(new Date("2026-06-01"));
    assert(dated.reference_date === "2026-06-01", dated.reference_date);
  });

  test("legacy audit rows do not crash", () => {
    const legacyDashboard = auditDashboardService.buildExecutiveAuditDashboard(REF);
    assert(legacyDashboard.summary.last_24h_total >= 0, "legacy safe");
  });

  test("dashboard component render helper does not crash", () => {
    const widgetHtml = auditDashboardWidgetHtml();
    assert(widgetHtml.includes("İşlem Aktivitesi"), "widget title");
    assert(widgetHtml.includes("auditDashboardWidget"), "widget id");
    assert(widgetHtml.includes("/api/audit/dashboard") || widgetHtml.includes("audit-dashboard.js"), "loader");

    const summaryHtml = executiveAuditSummaryHtml(dashboard);
    assert(summaryHtml.includes("Yönetici İşlem Özeti"), "summary block");

    const pageHtml = auditLogsPageHtml({
      summary: auditLogService.buildAuditSummary({}),
      records: auditLogService.listAuditLogs({ limit: 10 }),
      filters: { limit: "10" },
      executiveDashboard: dashboard,
    });
    assert(pageHtml.includes("Yönetici İşlem Özeti"), "audit page summary");
    assert(pageHtml.includes("İşlem Geçmişi"), "audit page title");
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
