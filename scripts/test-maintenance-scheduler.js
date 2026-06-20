/**
 * FLEETOS MNT-3 — Maintenance Scheduler tests (isolated temp DB)
 * node scripts/test-maintenance-scheduler.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/maintenanceService",
  "/services/maintenanceSchedulerService",
  "/services/vehicleCenterService",
  "/lib/components/maintenanceSchedule",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-mnt3-",
  "test-maintenance-scheduler.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const maintenanceService = require("../services/maintenanceService");
const scheduler = require("../services/maintenanceSchedulerService");
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
  console.log("FLEETOS MNT-3 Maintenance Scheduler tests\n");

  test("default templates exist", () => {
    assert(scheduler.DEFAULT_SCHEDULE_TEMPLATES.engine_oil.interval_km === 10000, "engine oil km");
    assert(scheduler.DEFAULT_SCHEDULE_TEMPLATES.engine_oil.interval_days === 365, "engine oil days");
    assert(scheduler.DEFAULT_SCHEDULE_TEMPLATES.brake_pads.interval_km == null, "brake pads km null");
    assert(scheduler.DEFAULT_SCHEDULE_TEMPLATES.general_repair.interval_days == null, "general repair days null");
  });

  const vehicleOk = seedVehicle("16 OK 01", 47000);
  const vehicleUpcoming = seedVehicle("34 UPC 02", 109500);
  const vehicleDue = seedVehicle("06 DUE 03", 110000);
  const vehicleOverdue = seedVehicle("35 OVD 04", 112000);
  const vehicleUnknown = seedVehicle("41 UNK 05", 80000);
  const emptyVehicle = seedVehicle("99 EMPTY 00", 10000);

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleOk,
    maintenance_type: "engine_oil",
    maintenance_date: "2025-07-02",
    odometer_km: 40000,
    cost: 1200,
    vendor: "Servis A",
    description: "OK test",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleUpcoming,
    maintenance_type: "engine_oil",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 1200,
    vendor: "Servis B",
    description: "Upcoming test",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleDue,
    maintenance_type: "engine_oil",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 1200,
    vendor: "Servis C",
    description: "Due test",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleOverdue,
    maintenance_type: "engine_oil",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 1200,
    vendor: "Servis D",
    description: "Overdue test",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleUnknown,
    maintenance_type: "brake_pads",
    maintenance_date: "2026-01-15",
    odometer_km: 75000,
    cost: 5000,
    vendor: "Fren Servis",
    description: "Unknown interval type",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleOk,
    maintenance_type: "air_filter",
    maintenance_date: "2025-07-15",
    odometer_km: 30000,
    cost: 800,
    vendor: "Servis A",
    description: "Date upcoming test",
  });

  test("next_due_km calculation works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleOk, "engine_oil", { referenceDate: REF });
    assert(calc.next_due_km === 50000, `next_due_km ${calc.next_due_km}`);
  });

  test("next_due_date calculation works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleOk, "engine_oil", { referenceDate: REF });
    assert(calc.next_due_date === "2026-07-02", `next_due_date ${calc.next_due_date}`);
  });

  test("ok status works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleOk, "engine_oil", {
      referenceDate: REF,
      currentOdometerKm: 48000,
    });
    assert(calc.status === "ok", `status ${calc.status}`);
    assert(calc.remaining_km === 2000, `remaining_km ${calc.remaining_km}`);
  });

  test("upcoming status works", () => {
    const kmUpcoming = scheduler.calculateNextDueFromHistory(vehicleUpcoming, "engine_oil", {
      referenceDate: REF,
      currentOdometerKm: 109500,
    });
    assert(kmUpcoming.status === "upcoming", `km upcoming ${kmUpcoming.status}`);

    const dateUpcoming = scheduler.calculateNextDueFromHistory(vehicleOk, "air_filter", {
      referenceDate: new Date("2026-06-20T12:00:00"),
      currentOdometerKm: 48000,
    });
    assert(dateUpcoming.status === "upcoming", `date upcoming ${dateUpcoming.status}`);
  });

  test("due status works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleDue, "engine_oil", {
      referenceDate: REF,
      currentOdometerKm: 110000,
    });
    assert(calc.status === "due", `status ${calc.status}`);
  });

  test("overdue status works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleOverdue, "engine_oil", {
      referenceDate: REF,
      currentOdometerKm: 112000,
    });
    assert(calc.status === "overdue", `status ${calc.status}`);

    const dateOverdue = scheduler.calculateScheduleStatus(
      { next_due_km: null, next_due_date: "2026-05-01" },
      null,
      REF
    );
    assert(dateOverdue.status === "overdue", `date overdue ${dateOverdue.status}`);
  });

  test("unknown status works", () => {
    const calc = scheduler.calculateNextDueFromHistory(vehicleUnknown, "brake_pads", {
      referenceDate: REF,
      currentOdometerKm: 80000,
    });
    assert(calc.next_due_km == null && calc.next_due_date == null, "no due targets");
    assert(calc.status === "unknown", `status ${calc.status}`);
  });

  test("combined worst-status wins", () => {
    const status = scheduler.calculateScheduleStatus(
      { next_due_km: 120000, next_due_date: "2026-05-01" },
      50000,
      REF
    );
    assert(status.status === "overdue", `worst status ${status.status}`);
    assert(status.remaining_km === 70000, "km remaining preserved");
    assert(status.days_remaining < 0, "days remaining preserved");
  });

  test("report summary counts", () => {
    const report = scheduler.buildMaintenanceScheduleReport(REF);
    assert(report.summary.total >= 5, `total ${report.summary.total}`);
    assert(report.summary.ok >= 1, `ok ${report.summary.ok}`);
    assert(report.summary.upcoming >= 1, `upcoming ${report.summary.upcoming}`);
    assert(report.summary.due >= 1, `due ${report.summary.due}`);
    assert(report.summary.overdue >= 1, `overdue ${report.summary.overdue}`);
    assert(report.summary.unknown >= 1, `unknown ${report.summary.unknown}`);
    assert(
      report.summary.ok +
        report.summary.upcoming +
        report.summary.due +
        report.summary.overdue +
        report.summary.unknown ===
        report.summary.total,
      "summary adds up"
    );
  });

  test("vehicle filter works", () => {
    const report = scheduler.buildMaintenanceScheduleReport(REF, { vehicle_id: vehicleDue });
    assert(report.schedules.length === 1, "single vehicle schedules");
    assert(report.schedules[0].vehicle_id === String(vehicleDue), "vehicle id");
    assert(report.summary.total === 1, "filtered total");
  });

  test("empty state does not crash", () => {
    const report = scheduler.buildMaintenanceScheduleReport(REF, { vehicle_id: emptyVehicle });
    assert(Array.isArray(report.schedules), "schedules array");
    assert(report.schedules.length === 0, "empty schedules");
    assert(report.summary.total === 0, "empty total");
    assert(report.summary.ok === 0, "empty ok count");

    const preview = scheduler.getVehicleSchedulePreview(emptyVehicle, 5, REF);
    assert(preview.items.length === 0, "empty preview");
  });

  test("schedule rule CRUD works", () => {
    const rule = scheduler.createScheduleRule({
      vehicle_id: vehicleUnknown,
      maintenance_type: "brake_pads",
      interval_km: 30000,
      interval_days: 180,
    });
    assert(rule.id, "rule id");

    const calc = scheduler.calculateNextDueFromHistory(vehicleUnknown, "brake_pads", {
      referenceDate: REF,
      currentOdometerKm: 110000,
    });
    assert(calc.next_due_km === 105000, `custom rule km ${calc.next_due_km}`);
    assert(calc.status === "overdue", `custom rule status ${calc.status}`);

    const updated = scheduler.updateScheduleRule(rule.id, { interval_km: 40000 });
    assert(updated.interval_km === 40000, "updated interval");

    scheduler.deleteScheduleRule(rule.id);
    const afterDelete = scheduler.calculateNextDueFromHistory(vehicleUnknown, "brake_pads", {
      referenceDate: REF,
      currentOdometerKm: 80000,
    });
    assert(afterDelete.status === "unknown", "reverted to unknown after delete");
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
