/**
 * FLEETOS VI-4 — Vehicle Profit / Risk Fusion tests
 * node scripts/test-vehicle-profit-risk.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
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
  "/lib/components/vehicleProfitRisk",
  "/lib/components/vehicleHealth",
  "/lib/components/vehicleIntelligence",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-vi4-",
  "test-vehicle-profit-risk.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const vehicleProfitRiskService = require("../services/vehicleProfitRiskService");
const vehicleHealthService = require("../services/vehicleHealthService");
const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const {
  vehicleProfitRiskPageHtml,
  vehicleProfitRiskSummaryHtml,
  vehicleProfitRiskDashboardWidgetHtml,
} = require("../lib/components/vehicleProfitRisk");
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

function baseIntelligence(overrides = {}) {
  return {
    vehicle_id: "1",
    plate: "16 VPR 01",
    compliance: { status: "active", active: 1, warning: 0, critical: 0, expired: 0 },
    maintenance: { status: "ok", total_records: 1, overdue: 0, due: 0, upcoming: 0 },
    tire: { seasonal_status: "ready", total_records: 1 },
    finance: { total_income: 100000, total_expense: 50000, net_profit: 50000 },
    signals: [],
    ...overrides,
  };
}

function baseHealth(overrides = {}) {
  return {
    health_score: 88,
    risk_level: "low",
    status: "healthy",
    breakdown: { data_quality: { penalty: 0 } },
    ...overrides,
  };
}

function baseTimeline(overrides = {}) {
  return {
    summary: { critical_events: 0, warning_events: 0, total_events: 1 },
    events: [],
    ...overrides,
  };
}

function buildFrom(intelligence, health, timeline) {
  return vehicleProfitRiskService.buildVehicleProfitRiskFromContext(
    intelligence.vehicle_id,
    intelligence.plate,
    intelligence,
    health,
    timeline
  );
}

let vehicleA;
let vehicleB;

function seedData() {
  vehicleA = seedVehicle("16 VPR 01");
  vehicleB = seedVehicle("34 VPR 02");

  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-15', 'gelir')"
  ).run(vehicleA, 200000);
  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'expense', 'fuel', 'Yakıt', ?, '2026-05-16', 'gider')"
  ).run(vehicleA, 80000);

  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-10', 'gelir')"
  ).run(vehicleB, 50000);
  db.prepare(
    "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'expense', 'fuel', 'Yakıt', ?, '2026-05-11', 'gider')"
  ).run(vehicleB, 90000);
}

function main() {
  console.log("FLEETOS VI-4 Vehicle Profit / Risk Fusion tests\n");
  seedData();

  test("service loads", () => {
    assert(typeof vehicleProfitRiskService.buildVehicleProfitRisk === "function", "single");
    assert(typeof vehicleProfitRiskService.buildFleetVehicleProfitRisk === "function", "fleet");
    assert(typeof vehicleProfitRiskService.computeProfitMargin === "function", "margin");
  });

  test("profitability calculation works", () => {
    const p = vehicleProfitRiskService.buildProfitability({
      finance: { total_income: 100000, total_expense: 70000, net_profit: 30000 },
    });
    assert(p.total_income === 100000, "income");
    assert(p.total_expense === 70000, "expense");
    assert(p.net_profit === 30000, "net");
    assert(p.profit_status === "profitable", p.profit_status);
  });

  test("profit margin calculation works", () => {
    assert(vehicleProfitRiskService.computeProfitMargin(100000, 30000) === 30, "30%");
    assert(vehicleProfitRiskService.computeProfitMargin(0, 0) === null, "null margin");
    assert(vehicleProfitRiskService.computeProfitStatus({ total_income: 0, total_expense: 0 }) === "unknown", "unknown");
    assert(vehicleProfitRiskService.computeProfitStatus({ total_income: 100, total_expense: 100, net_profit: 0 }) === "break_even", "break_even");
  });

  test("star category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 100000, total_expense: 40000, net_profit: 60000 } }),
      baseHealth({ risk_level: "low", health_score: 90 }),
      baseTimeline()
    );
    assert(row.fusion.category === "star", row.fusion.category);
    assert(row.fusion.priority === "low", row.fusion.priority);
  });

  test("profitable_risk category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 100000, total_expense: 40000, net_profit: 60000 } }),
      baseHealth({ risk_level: "critical", health_score: 35 }),
      baseTimeline({ summary: { critical_events: 2, warning_events: 1, total_events: 3 } })
    );
    assert(row.fusion.category === "profitable_risk", row.fusion.category);
    assert(row.fusion.priority === "urgent", row.fusion.priority);
  });

  test("loss_low_risk category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 50000, total_expense: 90000, net_profit: -40000 } }),
      baseHealth({ risk_level: "low", health_score: 85 }),
      baseTimeline()
    );
    assert(row.fusion.category === "loss_low_risk", row.fusion.category);
    assert(row.fusion.priority === "high", row.fusion.priority);
  });

  test("loss_high_risk category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 50000, total_expense: 90000, net_profit: -40000 } }),
      baseHealth({ risk_level: "high", health_score: 45 }),
      baseTimeline({ summary: { critical_events: 1, warning_events: 0, total_events: 1 } })
    );
    assert(row.fusion.category === "loss_high_risk", row.fusion.category);
    assert(row.fusion.priority === "urgent", row.fusion.priority);
  });

  test("neutral category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 100000, total_expense: 100000, net_profit: 0 } }),
      baseHealth({ risk_level: "low", health_score: 80 }),
      baseTimeline()
    );
    assert(row.fusion.category === "neutral", row.fusion.category);
    assert(row.fusion.priority === "medium", row.fusion.priority);
  });

  test("unknown category works", () => {
    const row = buildFrom(
      baseIntelligence({ finance: { total_income: 0, total_expense: 0, net_profit: 0 } }),
      baseHealth({ risk_level: "unknown", health_score: null }),
      baseTimeline({ summary: { critical_events: 0, warning_events: 0, total_events: 0 } })
    );
    assert(row.fusion.category === "unknown", row.fusion.category);
    assert(row.fusion.priority === "unknown", row.fusion.priority);
  });

  test("priority mapping works", () => {
    assert(vehicleProfitRiskService.determinePriority("loss_high_risk", "high") === "urgent", "loss_high_risk");
    assert(vehicleProfitRiskService.determinePriority("profitable_risk", "medium") === "high", "profitable_risk");
    assert(vehicleProfitRiskService.determinePriority("star", "low") === "low", "star");
    assert(vehicleProfitRiskService.determinePriority("unknown", "unknown") === "unknown", "unknown");
  });

  test("drivers generated", () => {
    const row = buildFrom(
      baseIntelligence({
        finance: { total_income: 50000, total_expense: 90000, net_profit: -40000 },
        signals: [{ level: "critical", message: "test" }],
      }),
      baseHealth({ risk_level: "high", health_score: 40 }),
      baseTimeline({ summary: { critical_events: 1, warning_events: 0, total_events: 1 } })
    );
    assert(Array.isArray(row.drivers) && row.drivers.length > 0, "drivers");
    assert(row.drivers.some((d) => d.message.includes("zarar")), "loss driver");
  });

  test("fleet summary counts work", () => {
    const fleet = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    assert(fleet.summary.total_vehicles === 2, fleet.summary.total_vehicles);
    assert(typeof fleet.summary.net_profit === "number", "net profit");
    assert(typeof fleet.summary.urgent_count === "number", "urgent");
    assert(Array.isArray(fleet.vehicles) && fleet.vehicles.length === 2, "vehicles");
  });

  test("sorting works", () => {
    const fleet = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const priorities = fleet.vehicles.map((v) => v.fusion.priority);
    const order = priorities.map((p) => vehicleProfitRiskService.PRIORITY_ORDER[p]);
    for (let i = 1; i < order.length; i += 1) {
      assert(order[i] >= order[i - 1], `sort order ${priorities.join(",")}`);
    }
  });

  test("API fleet endpoint returns JSON", () => {
    const fleet = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(fleet));
    assert(payload.summary.total_vehicles === 2, "fleet api");
    assert(payload.vehicles.length === 2, "vehicles api");
  });

  test("API single endpoint returns JSON", () => {
    const report = vehicleProfitRiskService.buildVehicleProfitRisk(vehicleA, { referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(report));
    assert(payload.vehicle_id === String(vehicleA), "vehicle api");
    assert(payload.profitability, "profitability api");
    assert(payload.fusion, "fusion api");
  });

  test("page renders", () => {
    const fleet = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const html = vehicleProfitRiskPageHtml(fleet);
    assert(html.includes("Araç Kâr / Risk Analizi"), "title");
    assert(html.includes("Karar Matrisi"), "matrix");
    assert(html.includes("Toplam Araç"), "summary");
  });

  test("vehicle detail integration helper does not crash", () => {
    const report = vehicleProfitRiskService.buildVehicleProfitRisk(vehicleA, { referenceDate: REF });
    const html = vehicleProfitRiskSummaryHtml(report);
    assert(html.includes("Kâr / Risk Özeti"), "summary title");
    assert(html.includes("/vehicle-profit-risk"), "link");
    const emptyHtml = vehicleProfitRiskSummaryHtml(null);
    assert(emptyHtml.includes("Kâr / Risk Özeti"), "empty summary");

    const bundle = getVehicleCenterBundle(vehicleA);
    const pageHtml = vehicleCenterPageHtml(bundle);
    assert(pageHtml.includes("Kâr / Risk Özeti"), "vehicle center block");
  });

  test("dashboard widget html safe", () => {
    const widget = vehicleProfitRiskDashboardWidgetHtml();
    assert(widget.includes("vehicleProfitRiskDashboardWidget"), "widget id");
    assert(widget.includes("vehicle-profit-risk-dashboard.js"), "script");
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
