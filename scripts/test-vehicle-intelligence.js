/**
 * FLEETOS VI-1 — Vehicle Intelligence Foundation tests
 * node scripts/test-vehicle-intelligence.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
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
  "/lib/components/vehicleIntelligence",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-vi1-",
  "test-vehicle-intelligence.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const {
  vehicleIntelligencePageHtml,
  vehicleIntelligenceSummaryHtml,
} = require("../lib/components/vehicleIntelligence");
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

function assertVehicleShape(row) {
  assert(row.vehicle_id, "vehicle_id");
  assert(row.plate, "plate");
  assert(row.vehicle && typeof row.vehicle === "object", "vehicle");
  assert(row.compliance && typeof row.compliance.status === "string", "compliance");
  assert(row.maintenance && typeof row.maintenance.status === "string", "maintenance");
  assert(row.tire && typeof row.tire.seasonal_status === "string", "tire");
  assert(row.audit && typeof row.audit.events_30d === "number", "audit");
  assert(row.finance && typeof row.finance.net_profit === "number", "finance");
  assert(Array.isArray(row.signals), "signals");
}

function main() {
  console.log("FLEETOS VI-1 Vehicle Intelligence Foundation tests\n");

  test("service loads", () => {
    assert(typeof vehicleIntelligenceService.buildVehicleIntelligence === "function", "single");
    assert(typeof vehicleIntelligenceService.buildFleetVehicleIntelligence === "function", "fleet");
    assert(typeof vehicleIntelligenceService.generateSignals === "function", "signals");
  });

  const vehicleA = seedVehicle("16 VI 01");
  const vehicleB = seedVehicle("34 VI 02");

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis', 'servis', 50000, 'test income', '2026-05-15')`
  ).run(vehicleA);

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'Yakıt', 'yakit', 80000, 'test fuel', '2026-05-16')`
  ).run(vehicleA);

  db.prepare(
    `INSERT INTO audit_logs (
      module, entity_type, entity_id, action, actor_id, actor_name, summary, metadata, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "maintenance",
    "maintenance_record",
    "1",
    "create",
    "system",
    "System",
    "Bakım kaydı oluşturuldu",
    JSON.stringify({ vehicle_id: vehicleA, plate: "16 VI 01" }),
    "Bakım kaydı oluşturuldu",
    "2026-05-20 10:00:00"
  );

  test("fleet intelligence returns summary", () => {
    const fleet = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    assert(fleet.summary, "summary");
    assert(fleet.summary.total_vehicles === 2, fleet.summary.total_vehicles);
    assert(typeof fleet.summary.net_profit === "number", "net_profit");
    assert(Array.isArray(fleet.vehicles) && fleet.vehicles.length === 2, "vehicles");
  });

  test("vehicle intelligence object shape exists", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    assert(row, "row");
    assertVehicleShape(row);
  });

  test("compliance aggregation safe", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    assert(["active", "warning", "critical", "expired", "unknown"].includes(row.compliance.status), row.compliance.status);
    assert(row.compliance.score == null || typeof row.compliance.score === "number", "score");
    assert(row.compliance.active >= 0, "active");
  });

  test("maintenance aggregation safe", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleB, { referenceDate: REF });
    assert(["ok", "upcoming", "due", "overdue", "unknown"].includes(row.maintenance.status), row.maintenance.status);
    assert(row.maintenance.total_records >= 0, "records");
    assert(row.maintenance.total_cost >= 0, "cost");
  });

  test("tire aggregation safe", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleB, { referenceDate: REF });
    assert(["ready", "attention", "mismatch", "unknown"].includes(row.tire.seasonal_status), row.tire.seasonal_status);
    assert(row.tire.total_records >= 0, "records");
    assert(row.tire.alert_count >= 0, "alerts");
  });

  test("audit aggregation safe", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    assert(row.audit.events_30d >= 1, "events");
    assert(row.audit.latest_activity_summary, "summary");
  });

  test("finance aggregation safe even if partial", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    assert(row.finance.total_income === 50000, row.finance.total_income);
    assert(row.finance.total_expense >= 80000, row.finance.total_expense);
    assert(row.finance.net_profit < 0, "negative net");
    const empty = vehicleIntelligenceService.buildVehicleIntelligence(vehicleB, { referenceDate: REF });
    assert(empty.finance.total_income === 0, "empty income");
    assert(empty.finance.net_profit === 0, "empty net");
  });

  test("signals array exists", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    assert(row.signals.length > 0, "signals");
    assert(row.signals.every((s) => s.level && s.message), "signal shape");
  });

  test("critical/warning signal generation works", () => {
    const compliance = { expired: 1, critical: 0, warning: 0, status: "expired" };
    const maintenance = { overdue: 1, due: 0, upcoming: 0, status: "overdue" };
    const tire = { seasonal_status: "mismatch" };
    const finance = { net_profit: -1000, total_income: 1000, total_expense: 2000 };
    const signals = vehicleIntelligenceService.generateSignals("16 TEST 01", compliance, maintenance, tire, finance);
    assert(signals.some((s) => s.level === "critical"), "critical signals");
    assert(signals.some((s) => s.message.includes("süresi geçmiş")), "compliance tr");
    assert(signals.some((s) => s.message.includes("bakım gecikmiş")), "maintenance tr");
    assert(signals.some((s) => s.message.includes("lastik sezon")), "tire tr");
  });

  test("sorting works", () => {
    const fleet = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const first = fleet.vehicles[0];
    assert(first.plate === "16 VI 01", "critical/loss vehicle first");
    const manual = vehicleIntelligenceService.sortVehicleIntelligence([
      { plate: "B", signals: [], finance: { net_profit: 0 } },
      { plate: "A", signals: [{ level: "critical", message: "x" }], finance: { net_profit: 0 } },
    ]);
    assert(manual[0].plate === "A", "critical first");
  });

  test("API fleet endpoint returns JSON", () => {
    const fleet = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(fleet));
    assert(payload.summary.total_vehicles === 2, "fleet api");
    assert(payload.vehicles.length === 2, "vehicles api");
  });

  test("API single vehicle endpoint returns JSON", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(row));
    assert(payload.vehicle_id === String(vehicleA), "vehicle api");
    assertVehicleShape(payload);
  });

  test("page renders", () => {
    const fleet = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const html = vehicleIntelligencePageHtml(fleet);
    assert(html.includes("Araç Zekâsı"), "title");
    assert(html.includes("Toplam Araç"), "summary");
    assert(html.includes("Uygunluk"), "table header");
    assert(html.includes("Sinyaller"), "signals column");
    assert(html.includes("16 VI 01") || html.includes("16VI01"), "vehicle row");
  });

  test("vehicle detail integration helper does not crash", () => {
    const row = vehicleIntelligenceService.buildVehicleIntelligence(vehicleA, { referenceDate: REF });
    const html = vehicleIntelligenceSummaryHtml(row);
    assert(html.includes("Araç Zekâsı Özeti"), "summary title");
    assert(html.includes("/vehicle-intelligence"), "link");
    const emptyHtml = vehicleIntelligenceSummaryHtml(null);
    assert(emptyHtml.includes("Araç Zekâsı Özeti"), "empty summary");
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
