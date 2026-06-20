/**
 * FLEETOS TYR-3 — Tire Seasonal Scheduler tests (isolated temp DB)
 * node scripts/test-tire-seasonal-scheduler.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/tireSeasonalSchedulerService",
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/vehicleCenterService",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-tyr3-",
  "test-tire-seasonal-scheduler.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const tireSeasonalSchedulerService = require("../services/tireSeasonalSchedulerService");
const tireService = require("../services/tireService");
const tireHistoryService = require("../services/tireHistoryService");
const vehicleCenterService = require("../services/vehicleCenterService");
const { normalizePlate } = require("../utils/plate");

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

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function test(name, fn) {
  try {
    fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

function main() {
  console.log("FLEETOS TYR-3 Tire Seasonal Scheduler tests\n");

  const vehicleWinterReady = seedVehicle("16 TYR W01");
  const vehicleSummerMismatch = seedVehicle("34 TYR S99");
  const vehicleAllSeason = seedVehicle("06 TYR A55");
  const vehicleStorage = seedVehicle("41 TYR D77");
  const vehicleEmpty = seedVehicle("07 TYR E00");

  tireService.createTireRecord({
    vehicle_id: vehicleWinterReady,
    season: "winter",
    brand: "Pirelli",
    quantity: 4,
    status: "on_vehicle",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleSummerMismatch,
    season: "summer",
    brand: "Michelin",
    quantity: 4,
    status: "on_vehicle",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleAllSeason,
    season: "all_season",
    brand: "Bridgestone",
    quantity: 4,
    status: "on_vehicle",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleStorage,
    season: "summer",
    brand: "Continental",
    quantity: 4,
    status: "on_vehicle",
  });
  tireService.createTireRecord({
    vehicle_id: vehicleStorage,
    season: "winter",
    brand: "Continental",
    quantity: 4,
    status: "in_storage",
  });

  tireHistoryService.createTireChangeRecord({
    vehicle_id: vehicleStorage,
    change_type: "seasonal_swap",
    change_date: "2026-01-15",
    season: "summer",
    quantity: 4,
  });

  test("winter period detects winter season", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-01-20"));
    assert(report.current_season === "winter", `expected winter, got ${report.current_season}`);
    assert(report.reference_date === "2026-01-20", "reference_date");
  });

  test("summer period detects summer season", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-07-10"));
    assert(report.current_season === "summer", `expected summer, got ${report.current_season}`);
  });

  test("transition period detects transition", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-04-05"));
    assert(report.current_season === "transition", `expected transition, got ${report.current_season}`);
  });

  test("winter tire in winter = ready", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    const row = report.vehicles.find((v) => v.vehicle_id === String(vehicleWinterReady));
    assert(row, "vehicle row missing");
    assert(row.status === "ready", `expected ready, got ${row.status}`);
  });

  test("summer tire in winter = mismatch", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    const row = report.vehicles.find((v) => v.vehicle_id === String(vehicleSummerMismatch));
    assert(row, "vehicle row missing");
    assert(row.status === "mismatch", `expected mismatch, got ${row.status}`);
  });

  test("all-season tire = ready", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    const row = report.vehicles.find((v) => v.vehicle_id === String(vehicleAllSeason));
    assert(row, "vehicle row missing");
    assert(row.status === "ready", `expected ready, got ${row.status}`);
    assert(row.current_tire_season === "all_season", "all_season on vehicle");
  });

  test("suitable tire in storage = attention", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    const row = report.vehicles.find((v) => v.vehicle_id === String(vehicleStorage));
    assert(row, "vehicle row missing");
    assert(row.status === "attention", `expected attention, got ${row.status}`);
    assert(row.storage_quantity_for_required_season >= 4, "winter tires in storage");
  });

  test("no tire data = unknown", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    const row = report.vehicles.find((v) => v.vehicle_id === String(vehicleEmpty));
    assert(row, "vehicle row missing");
    assert(row.status === "unknown", `expected unknown, got ${row.status}`);
  });

  test("summary counts work", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    assert(report.summary.total_vehicles === 5, `total vehicles ${report.summary.total_vehicles}`);
    assert(report.summary.ready >= 2, "ready count");
    assert(report.summary.mismatch >= 1, "mismatch count");
    assert(report.summary.attention >= 1, "attention count");
    assert(report.summary.unknown >= 1, "unknown count");
    assert(
      report.summary.ready + report.summary.attention + report.summary.mismatch + report.summary.unknown ===
        report.summary.total_vehicles,
      "summary totals match"
    );
  });

  test("vehicle filter works", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"), {
      vehicle_id: vehicleWinterReady,
    });
    assert(report.vehicles.length === 1, "single vehicle in filter");
    assert(report.vehicles[0].vehicle_id === String(vehicleWinterReady), "filtered vehicle id");
    assert(report.summary.total_vehicles === 1, "filtered summary total");
  });

  test("API payload shape works", () => {
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    assert(report.reference_date, "reference_date");
    assert(report.current_season, "current_season");
    assert(report.summary, "summary");
    assert(Array.isArray(report.vehicles), "vehicles array");
    const row = report.vehicles[0];
    assert(row.vehicle_id, "vehicle_id");
    assert(row.plate, "plate");
    assert(row.status, "status");
    assert(row.message, "message");
    assert(typeof row.on_vehicle_quantity === "number", "on_vehicle_quantity");
    assert(typeof row.storage_quantity_for_required_season === "number", "storage qty");
  });

  test("empty state does not crash", () => {
    db.prepare("DELETE FROM tires").run();
    db.prepare("DELETE FROM tire_change_history").run();
    const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date("2026-02-01"));
    assert(report.vehicles.length >= 1, "vehicles still listed");
    assert(report.vehicles.every((v) => v.status === "unknown"), "all unknown without tire data");
    assert(report.summary.unknown === report.summary.total_vehicles, "all unknown in summary");
  });

  test("TYR-1 and TYR-2 integrations still work", () => {
    tireService.createTireRecord({
      vehicle_id: vehicleWinterReady,
      season: "winter",
      brand: "Test",
      quantity: 4,
      status: "on_vehicle",
    });
    const tires = tireService.listTireRecords({ vehicle_id: vehicleWinterReady });
    assert(tires.length >= 1, "TYR-1 list works");

    tireHistoryService.createTireChangeRecord({
      vehicle_id: vehicleWinterReady,
      change_type: "installed",
      change_date: "2026-01-01",
      quantity: 4,
    });
    const history = tireHistoryService.getVehicleTireHistory(vehicleWinterReady);
    assert(history.records.length >= 1, "TYR-2 history works");

    const preview = tireSeasonalSchedulerService.getVehicleSeasonalPreview(vehicleWinterReady, new Date("2026-02-01"));
    assert(preview, "vehicle seasonal preview");
    assert(preview.status === "ready", "preview ready in winter");

    const bundle = vehicleCenterService.getVehicleCenterBundle(vehicleWinterReady);
    assert(bundle.tireStatus, "bundle tireStatus");
    assert(bundle.tireChangeHistory, "bundle tireChangeHistory");
    assert(bundle.tireSeasonalStatus, "bundle tireSeasonalStatus");
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
