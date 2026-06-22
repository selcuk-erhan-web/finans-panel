/**
 * FLEETOS VI-5 — Executive Vehicle Intelligence Dashboard tests
 * node scripts/test-executive-vehicle-dashboard.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/executiveVehicleDashboardService",
  "/services/vehicleProfitRiskService",
  "/services/vehicleHealthService",
  "/services/vehicleIntelligenceService",
  "/services/vehicleTimelineService",
  "/services/vehicleCenterService",
  "/services/complianceStatusService",
  "/services/maintenanceService",
  "/services/maintenanceSchedulerService",
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/tireSeasonalSchedulerService",
  "/services/tireAlertService",
  "/services/auditLogService",
  "/services/profitService",
  "/lib/components/executiveVehicleDashboard",
  "/lib/components/vehicleProfitRisk",
  "/lib/components/vehicleHealth",
  "/lib/components/vehicleIntelligence",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-vi5-",
  "test-executive-vehicle-dashboard.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const executiveVehicleDashboardService = require("../services/executiveVehicleDashboardService");
const vehicleProfitRiskService = require("../services/vehicleProfitRiskService");
const vehicleHealthService = require("../services/vehicleHealthService");
const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const {
  executiveVehicleDashboardPageHtml,
  executiveVehicleDashboardWidgetHtml,
  executiveVehicleDashboardCrossLinkHtml,
} = require("../lib/components/executiveVehicleDashboard");
const { vehicleCenterPageHtml } = require("../lib/components/vehicleCenter");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
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

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type, current_km) VALUES (?, ?, 'Servis', ?)")
    .run(plate, norm, 100000).lastInsertRowid;
}

let vehicleA;
let vehicleB;
let vehicleC;

function seedData() {
  vehicleA = seedVehicle("16 EVD 01");
  vehicleB = seedVehicle("34 EVD 02");
  vehicleC = seedVehicle("06 EVD 03");

  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-15', 'gelir')"
  ).run(vehicleA, 300000);
  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'expense', 'fuel', 'Yakıt', ?, '2026-05-16', 'gider')"
  ).run(vehicleA, 100000);

  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-10', 'gelir')"
  ).run(vehicleB, 80000);
  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'expense', 'fuel', 'Yakıt', ?, '2026-05-11', 'gider')"
  ).run(vehicleB, 150000);

  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-12', 'gelir')"
  ).run(vehicleC, 120000);
  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'expense', 'fuel', 'Yakıt', ?, '2026-05-13', 'gider')"
  ).run(vehicleC, 90000);
}

function main() {
  console.log("FLEETOS VI-5 Executive Vehicle Intelligence Dashboard tests\n");
  seedData();

  test("service loads", () => {
    assert(typeof executiveVehicleDashboardService.buildExecutiveVehicleDashboard === "function", "dashboard");
    assert(typeof executiveVehicleDashboardService.buildTopPerformers === "function", "top");
    assert(typeof executiveVehicleDashboardService.buildHighestRisk === "function", "risk");
  });

  test("dashboard summary exists", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    assert(dashboard.summary, "summary");
    assert(typeof dashboard.summary.total_vehicles === "number", "total vehicles");
    assert(typeof dashboard.summary.net_profit === "number", "net profit");
    assert(dashboard.reference_date, "reference date");
  });

  test("top_performers sorted correctly", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const top = dashboard.top_performers || [];
    assert(top.length > 0, "has performers");
    for (let i = 1; i < top.length; i += 1) {
      assert(top[i - 1].net_profit >= top[i].net_profit, "profit desc");
    }
    assert(top[0].net_profit >= top[top.length - 1].net_profit, "sorted");
  });

  test("highest_risk sorted correctly", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const risk = dashboard.highest_risk || [];
    if (risk.length > 1) {
      for (let i = 1; i < risk.length; i += 1) {
        const aOrder = executiveVehicleDashboardService.ACTION_PRIORITY_ORDER[risk[i - 1].priority] ?? 99;
        const bOrder = executiveVehicleDashboardService.ACTION_PRIORITY_ORDER[risk[i].priority] ?? 99;
        assert(aOrder <= bOrder, "priority order");
      }
    }
    risk.forEach((row) => {
      assert(row.priority === "urgent" || row.priority === "high", row.priority);
    });
  });

  test("action_priorities exists", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const actions = dashboard.action_priorities || [];
    assert(Array.isArray(actions), "actions array");
    assert(actions.length <= 8, "max 8");
    actions.forEach((row) => {
      assert(row.decision_label, "decision label");
      assert(row.recommended_action, "recommended action");
      assert(Array.isArray(row.drivers), "drivers");
    });
  });

  test("fleet_distribution exists", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    assert(dashboard.fleet_distribution.health, "health dist");
    assert(dashboard.fleet_distribution.profit_risk, "profit risk dist");
    assert(typeof dashboard.fleet_distribution.health.healthy === "number", "healthy count");
    assert(typeof dashboard.fleet_distribution.profit_risk.star === "number", "star count");
  });

  test("executive_insights exists", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    assert(Array.isArray(dashboard.executive_insights), "insights");
    assert(dashboard.executive_insights.length > 0, "has insights");
    dashboard.executive_insights.forEach((insight) => {
      assert(insight.level, "level");
      assert(insight.message, "message");
    });
  });

  test("empty state safe", () => {
    const empty = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({
      referenceDate: REF,
    });
    const html = executiveVehicleDashboardPageHtml({
      summary: { total_vehicles: 0 },
      top_performers: [],
      highest_risk: [],
      action_priorities: [],
      fleet_distribution: { health: {}, profit_risk: {} },
      executive_insights: [{ level: "info", message: "Veri yok." }],
    });
    assert(empty.summary.total_vehicles >= 0, "safe total");
    assert(html.includes("Yönetici Araç Zekâsı"), "page title");
    assert(html.includes("Kârlı araç verisi bulunmuyor") || html.includes("Acil/yüksek riskli araç bulunmuyor"), "empty");
  });

  test("API returns JSON", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(dashboard));
    assert(payload.summary, "api summary");
    assert(Array.isArray(payload.top_performers), "api top");
    assert(Array.isArray(payload.highest_risk), "api risk");
  });

  test("page renders", () => {
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const html = executiveVehicleDashboardPageHtml(dashboard);
    assert(html.includes("Yönetici Araç Zekâsı"), "title");
    assert(html.includes("En İyi Performans"), "top performers");
    assert(html.includes("En Yüksek Risk"), "highest risk");
    assert(html.includes("Müdahale Öncelikleri"), "actions");
    assert(html.includes("Yönetici İçgörüleri"), "insights");
    assert(html.includes("/vehicle-profit-risk"), "link");
  });

  test("main dashboard widget render helper does not crash", () => {
    const widget = executiveVehicleDashboardWidgetHtml();
    assert(widget.includes("executiveVehicleDashboardWidget"), "widget id");
    assert(widget.includes("executive-vehicle-dashboard.js"), "script");
  });

  test("VI-1/VI-2/VI-3/VI-4 integration remains compatible", () => {
    const intelligence = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const health = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    const profitRisk = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const dashboard = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });

    assert(intelligence.vehicles.length === 3, "vi1");
    assert(health.summary.total_vehicles === 3, "vi2");
    assert(profitRisk.summary.total_vehicles === 3, "vi4");
    assert(dashboard.summary.total_vehicles === 3, "vi5");

    const bundle = getVehicleCenterBundle(vehicleA);
    const pageHtml = vehicleCenterPageHtml(bundle);
    assert(pageHtml.includes("Yönetici Araç Zekâsı ekranında gör"), "vehicle cross-link");
    assert(executiveVehicleDashboardCrossLinkHtml().includes("/executive-vehicle-dashboard"), "cross link");
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
