/**
 * FLEETOS MNT-2 — Maintenance History tests (isolated temp DB)
 * node scripts/test-maintenance-history.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/maintenanceService",
  "/services/vehicleCenterService",
  "/lib/components/maintenanceCenter",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-mnt2-",
  "test-maintenance-history.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const maintenanceService = require("../services/maintenanceService");
const vehicleCenterService = require("../services/vehicleCenterService");
const { maintenanceHistoryRowsHtml, maintenanceHistorySummaryHtml } = require("../lib/components/maintenanceCenter");
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
  console.log("FLEETOS MNT-2 Maintenance History tests\n");

  const vehicleA = seedVehicle("16 MNT 01");
  const vehicleB = seedVehicle("34 MNT 99");
  const emptyVehicle = seedVehicle("06 EMPTY 00");

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "engine_oil",
    maintenance_date: "2026-04-01",
    odometer_km: 120000,
    cost: 1500,
    vendor: "Servis A",
    description: "Eski yağ bakımı",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "brake_pads",
    maintenance_date: "2026-06-01",
    odometer_km: 122000,
    cost: 4200,
    vendor: "Fren Servis",
    description: "Ön fren",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "air_filter",
    maintenance_date: "2026-06-01",
    odometer_km: 123500,
    cost: 650,
    vendor: "Servis A",
    description: "Hava filtresi aynı gün",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleB,
    maintenance_type: "inspection",
    maintenance_date: "2026-05-15",
    odometer_km: 88000,
    cost: 900,
    vendor: "TÜVTÜRK",
    description: "Muayene",
  });

  test("vehicle-specific history returns correct records", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.vehicle_id === String(vehicleA), "vehicle id");
    assert(history.plate === "16 MNT 01", "plate");
    assert(history.records.length === 3, `expected 3 records, got ${history.records.length}`);
    assert(history.records.every((r) => r.vehicle_id === String(vehicleA)), "all records belong to vehicle");
  });

  test("records sorted newest first by maintenance_date", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.records[0].maintenance_date === "2026-06-01", "newest date first");
    assert(history.records[2].maintenance_date === "2026-04-01", "oldest last");
  });

  test("same date sorted by highest odometer first", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.records[0].odometer_km === 123500, "higher km first on same date");
    assert(history.records[1].odometer_km === 122000, "lower km second on same date");
  });

  test("summary total records works", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.summary.total_records === 3, "total records");
  });

  test("summary total cost works", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.summary.total_cost === 1500 + 4200 + 650, `total cost ${history.summary.total_cost}`);
  });

  test("last maintenance date works", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.summary.last_maintenance_date === "2026-06-01", "last date");
  });

  test("last odometer km works", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(vehicleA);
    assert(history.summary.last_odometer_km === 123500, "last km from newest record");
  });

  test("empty vehicle history does not crash", () => {
    const history = maintenanceService.getVehicleMaintenanceHistory(emptyVehicle);
    assert(history.records.length === 0, "empty records");
    assert(history.summary.total_records === 0, "empty total records");
    assert(history.summary.total_cost === 0, "empty total cost");
    assert(history.summary.last_maintenance_date == null, "empty last date");
    assert(history.summary.last_odometer_km == null, "empty last km");

    const html = maintenanceHistoryRowsHtml(history.records);
    assert(html.includes("Bu araç için bakım kaydı bulunmuyor"), "empty html state");
    const summaryHtml = maintenanceHistorySummaryHtml(history.summary);
    assert(summaryHtml.includes("Toplam Kayıt"), "summary html renders");
  });

  test("vehicle filter query shape via listMaintenanceRecords", () => {
    const rows = maintenanceService.listMaintenanceRecords({ vehicle_id: vehicleB });
    const summary = maintenanceService.getSummary({ vehicle_id: vehicleB });
    assert(rows.length === 1, "filtered rows");
    assert(summary.total_records === 1, "filtered summary records");
    assert(summary.total_cost === 900, "filtered summary cost");
    assert(summary.last_maintenance_date === "2026-05-15", "filtered last date");
  });

  test("vehicle center bundle includes maintenance history", () => {
    const bundle = vehicleCenterService.getVehicleCenterBundle(vehicleA);
    assert(bundle.maintenanceHistory, "bundle history");
    assert(bundle.maintenanceHistory.records.length === 3, "bundle record count");
    assert(bundle.maintenanceHistory.summary.total_cost === 6350, "bundle summary cost");
    assert(bundle.maintenance.length === 3, "operations preview rows");
  });

  test("missing vehicle history throws safely", () => {
    let threw = false;
    try {
      maintenanceService.getVehicleMaintenanceHistory(99999);
    } catch (err) {
      threw = true;
      assert(/bulunamad/i.test(err.message), err.message);
    }
    assert(threw, "missing vehicle throws");
  });

  test("existing MNT-1 CRUD still works", () => {
    const created = maintenanceService.createMaintenanceRecord({
      vehicle_id: emptyVehicle,
      maintenance_type: "battery",
      maintenance_date: "2026-06-10",
      odometer_km: 5000,
      cost: 3200,
      vendor: "Akü Servis",
      description: "Akü değişimi",
    });
    assert(created.id, "create id");

    const updated = maintenanceService.updateMaintenanceRecord(created.id, {
      cost: 3500,
      vendor: "Güncel Servis",
    });
    assert(updated.cost === 3500, "update cost");

    const listed = maintenanceService.listMaintenanceRecords({ vehicle_id: emptyVehicle });
    assert(listed.length === 1, "list after create");

    maintenanceService.deleteMaintenanceRecord(created.id);
    assert(!maintenanceService.getMaintenanceRecord(created.id), "deleted");
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
