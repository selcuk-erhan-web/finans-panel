/**
 * FLEETOS VI-2 — Vehicle Health Score tests
 * node scripts/test-vehicle-health.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/vehicleHealthService",
  "/services/vehicleIntelligenceService",
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
  "/lib/components/vehicleHealth",
  "/lib/components/vehicleIntelligence",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-vi2-",
  "test-vehicle-health.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const vehicleHealthService = require("../services/vehicleHealthService");
const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const {
  vehicleHealthPageHtml,
  vehicleHealthSummaryHtml,
  vehicleHealthDashboardWidgetHtml,
} = require("../lib/components/vehicleHealth");
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
    plate: "16 VH 01",
    compliance: {
      status: "active",
      active: 1,
      warning: 0,
      critical: 0,
      expired: 0,
    },
    maintenance: {
      status: "ok",
      total_records: 1,
      overdue: 0,
      due: 0,
      upcoming: 0,
    },
    tire: {
      seasonal_status: "ready",
      total_records: 1,
    },
    finance: {
      total_income: 100000,
      total_expense: 50000,
      net_profit: 50000,
    },
    signals: [],
    ...overrides,
  };
}

function main() {
  console.log("FLEETOS VI-2 Vehicle Health Score tests\n");

  test("service loads", () => {
    assert(typeof vehicleHealthService.calculateVehicleHealth === "function", "calculate");
    assert(typeof vehicleHealthService.buildFleetVehicleHealthReport === "function", "fleet");
    assert(typeof vehicleHealthService.buildVehicleHealthReport === "function", "single");
  });

  test("calculateVehicleHealth returns score", () => {
    const health = vehicleHealthService.calculateVehicleHealth(baseIntelligence());
    assert(health.health_score != null, "score");
    assert(health.health_score >= 90, health.health_score);
    assert(health.breakdown.compliance.weight === 25, "compliance weight");
    assert(health.recommendation, "recommendation");
  });

  test("expired compliance penalty works", () => {
    const health = vehicleHealthService.calculateVehicleHealth(
      baseIntelligence({
        compliance: { status: "expired", expired: 1, active: 0, warning: 0, critical: 0 },
      })
    );
    assert(health.breakdown.compliance.penalty === 25, health.breakdown.compliance.penalty);
    assert(health.health_score <= 75, health.health_score);
  });

  test("overdue maintenance penalty works", () => {
    const health = vehicleHealthService.calculateVehicleHealth(
      baseIntelligence({
        maintenance: { status: "overdue", overdue: 1, due: 0, upcoming: 0, total_records: 1 },
      })
    );
    assert(health.breakdown.maintenance.penalty === 25, health.breakdown.maintenance.penalty);
  });

  test("tire mismatch penalty works", () => {
    const health = vehicleHealthService.calculateVehicleHealth(
      baseIntelligence({
        tire: { seasonal_status: "mismatch", total_records: 1 },
      })
    );
    assert(health.breakdown.tire.penalty === 20, health.breakdown.tire.penalty);
  });

  test("negative profit penalty works", () => {
    const health = vehicleHealthService.calculateVehicleHealth(
      baseIntelligence({
        finance: { total_income: 10000, total_expense: 50000, net_profit: -40000 },
      })
    );
    assert(health.breakdown.finance.penalty === 20, health.breakdown.finance.penalty);
    assert(health.health_score === 80, health.health_score);
    assert(health.health_status === "watch", health.health_status);
  });

  test("data quality penalty works", () => {
    const health = vehicleHealthService.calculateVehicleHealth({
      vehicle_id: "9",
      plate: "99 EMPTY 00",
      compliance: { status: "unknown", active: 0, warning: 0, critical: 0, expired: 0 },
      maintenance: { status: "unknown", total_records: 0, overdue: 0, due: 0, upcoming: 0 },
      tire: { seasonal_status: "unknown", total_records: 0 },
      finance: { total_income: 0, total_expense: 0, net_profit: 0 },
      signals: [],
    });
    assert(health.health_score == null, "null score for empty vehicle");
    assert(health.health_status === "unknown", health.health_status);
    assert(health.breakdown.data_quality.penalty >= 6, health.breakdown.data_quality.penalty);
  });

  test("status mapping works", () => {
    assert(vehicleHealthService.mapHealthStatus(95) === "healthy", "healthy");
    assert(vehicleHealthService.mapHealthStatus(80) === "watch", "watch");
    assert(vehicleHealthService.mapHealthStatus(55) === "risk", "risk");
    assert(vehicleHealthService.mapHealthStatus(20) === "critical", "critical");
    assert(vehicleHealthService.mapHealthStatus(null) === "unknown", "unknown");
  });

  test("risk mapping works", () => {
    assert(vehicleHealthService.mapRiskLevel("healthy") === "low", "low");
    assert(vehicleHealthService.mapRiskLevel("watch") === "medium", "medium");
    assert(vehicleHealthService.mapRiskLevel("risk") === "high", "high");
    assert(vehicleHealthService.mapRiskLevel("critical") === "critical", "critical");
  });

  test("recommendations generated", () => {
    const expired = vehicleHealthService.calculateVehicleHealth(
      baseIntelligence({
        compliance: { status: "expired", expired: 1, active: 0, warning: 0, critical: 0 },
      })
    );
    assert(expired.recommendation.includes("süresi geçmiş"), expired.recommendation);

    const healthy = vehicleHealthService.calculateVehicleHealth(baseIntelligence());
    assert(healthy.recommendation.includes("sağlıklı"), healthy.recommendation);
  });

  const vehicleHealthy = seedVehicle("16 VH OK");
  const vehicleRisk = seedVehicle("34 VH RS");

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis', 'servis', 50000, 'income', '2026-05-15')`
  ).run(vehicleHealthy);

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'Yakıt', 'yakit', 120000, 'fuel', '2026-05-16')`
  ).run(vehicleRisk);
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis', 'servis', 10000, 'income', '2026-05-15')`
  ).run(vehicleRisk);

  test("fleet summary average works", () => {
    const fleet = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    assert(fleet.summary.total_vehicles === 2, fleet.summary.total_vehicles);
    assert(fleet.summary.average_health_score != null, "average");
    assert(Array.isArray(fleet.vehicles) && fleet.vehicles.length === 2, "vehicles");
  });

  test("highest risk vehicle works", () => {
    const fleet = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    assert(fleet.summary.highest_risk_vehicle, "highest risk");
    assert(fleet.summary.highest_risk_vehicle.plate, "plate");
  });

  test("best health vehicle works", () => {
    const fleet = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    assert(fleet.summary.best_health_vehicle, "best health");
    assert(fleet.summary.best_health_vehicle.health_score != null, "score");
  });

  test("API fleet endpoint returns JSON", () => {
    const fleet = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(fleet));
    assert(payload.summary.total_vehicles === 2, "fleet api");
    assert(payload.vehicles[0].health_status, "status");
  });

  test("API single endpoint returns JSON", () => {
    const report = vehicleHealthService.buildVehicleHealthReport(vehicleHealthy, { referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(report));
    assert(payload.vehicle_id === String(vehicleHealthy), "vehicle api");
    assert(payload.breakdown.maintenance, "breakdown");
  });

  test("page renders", () => {
    const fleet = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    const html = vehicleHealthPageHtml(fleet);
    assert(html.includes("Araç Sağlık Skoru"), "title");
    assert(html.includes("Ortalama Skor"), "summary");
    assert(html.includes("Araç Zekâsı"), "link");
    assert(html.includes("Öneri"), "recommendation column");
  });

  test("vehicle detail integration helper does not crash", () => {
    const intelligence = vehicleIntelligenceService.buildVehicleIntelligence(vehicleHealthy, {
      referenceDate: REF,
    });
    const health = vehicleHealthService.calculateVehicleHealth(intelligence);
    const html = vehicleHealthSummaryHtml(health);
    assert(html.includes("Araç Sağlık Skoru"), "summary title");
    assert(html.includes("/vehicle-health"), "link");
    const widget = vehicleHealthDashboardWidgetHtml();
    assert(widget.includes("Filo Sağlığı"), "dashboard widget");
    assert(widget.includes("/js/vehicle-health-dashboard.js"), "widget script");
    const emptyHtml = vehicleHealthSummaryHtml(null);
    assert(emptyHtml.includes("Araç Sağlık Skoru"), "empty summary");
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
