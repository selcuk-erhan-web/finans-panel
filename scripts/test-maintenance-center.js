/**
 * FLEETOS MNT-1 — Maintenance Center Foundation tests (isolated temp DB)
 * node scripts/test-maintenance-center.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = ["/services/maintenanceService", "/services/vehicleCenterService"];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-mnt1-",
  "test-maintenance-center.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const maintenanceService = require("../services/maintenanceService");
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

function runMigrationTwice() {
  purgeDbFromRequireCache(CACHE_PATTERNS);
  delete require.cache[require.resolve("../lib/db")];
  require("../lib/db");
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
  console.log("FLEETOS MNT-1 Maintenance Center tests\n");

  test("migration columns present", () => {
    const cols = db.prepare("PRAGMA table_info(maintenance_records)").all().map((c) => c.name);
    assert(cols.includes("vendor"), "missing vendor");
    assert(cols.includes("updated_at"), "missing updated_at");
  });

  test("migration idempotent", () => {
    runMigrationTwice();
    const cols = db.prepare("PRAGMA table_info(maintenance_records)").all().map((c) => c.name);
    assert(cols.includes("vendor"), "vendor lost after re-migrate");
    assert(cols.includes("updated_at"), "updated_at lost after re-migrate");
  });

  const vehicleA = seedVehicle("16 ABC 01");
  const vehicleB = seedVehicle("34 XYZ 99");

  let createdId;

  test("create record", () => {
    const record = maintenanceService.createMaintenanceRecord({
      vehicle_id: vehicleA,
      maintenance_type: "engine_oil",
      maintenance_date: "2026-05-10",
      odometer_km: 125000,
      cost: "1.250,50",
      vendor: "Oto Servis A",
      description: "Motor yağı değişimi",
    });
    createdId = record.id;
    assert(record.id, "id missing");
    assert(record.plate === "16 ABC 01", `plate ${record.plate}`);
    assert(record.maintenance_type === "engine_oil", "type");
    assert(record.maintenance_date === "2026-05-10", "date");
    assert(record.odometer_km === 125000, "km");
    assert(record.cost === 1251, `cost ${record.cost}`);
    assert(record.vendor === "Oto Servis A", "vendor");
  });

  test("get record", () => {
    const record = maintenanceService.getMaintenanceRecord(createdId);
    assert(record, "record missing");
    assert(record.description.includes("Motor yağı"), "description");
  });

  test("update record", () => {
    const updated = maintenanceService.updateMaintenanceRecord(createdId, {
      maintenance_type: "brake_pads",
      cost: 4200,
      vendor: "Fren Servis",
      description: "Ön fren balatası",
    });
    assert(updated.maintenance_type === "brake_pads", "updated type");
    assert(updated.cost === 4200, "updated cost");
    assert(updated.vendor === "Fren Servis", "updated vendor");
  });

  test("list records", () => {
    maintenanceService.createMaintenanceRecord({
      vehicle_id: vehicleB,
      maintenance_type: "inspection",
      maintenance_date: "2026-06-01",
      odometer_km: 88000,
      cost: 950,
      vendor: "TÜVTÜRK",
      description: "Periyodik muayene",
    });

    const rows = maintenanceService.listMaintenanceRecords();
    assert(rows.length === 2, `expected 2 rows, got ${rows.length}`);
  });

  test("vehicle filter", () => {
    const rows = maintenanceService.listMaintenanceRecords({ vehicle_id: vehicleA });
    assert(rows.length === 1, `expected 1 row for vehicle A, got ${rows.length}`);
    assert(rows[0].vehicle_id === String(vehicleA), "vehicle filter id");
  });

  test("date sorting newest first", () => {
    const rows = maintenanceService.listMaintenanceRecords();
    assert(rows[0].maintenance_date === "2026-06-01", `newest first ${rows[0].maintenance_date}`);
    assert(rows[1].maintenance_date === "2026-05-10", "second row date");
  });

  test("summary totals", () => {
    const summary = maintenanceService.getSummary();
    assert(summary.total_records === 2, "total records");
    assert(summary.total_cost === 4200 + 950, `total cost ${summary.total_cost}`);
    assert(summary.vehicles_with_maintenance === 2, "vehicles with maintenance");
  });

  test("invalid input handling", () => {
    let threw = false;
    try {
      maintenanceService.createMaintenanceRecord({
        vehicle_id: vehicleA,
        maintenance_type: "invalid_type",
        maintenance_date: "2026-01-01",
      });
    } catch (err) {
      threw = true;
      assert(/türü geçersiz/i.test(err.message), err.message);
    }
    assert(threw, "invalid type should throw");

    threw = false;
    try {
      maintenanceService.createMaintenanceRecord({
        vehicle_id: 99999,
        maintenance_type: "engine_oil",
        maintenance_date: "2026-01-01",
      });
    } catch (err) {
      threw = true;
      assert(/Araç/i.test(err.message), err.message);
    }
    assert(threw, "missing vehicle should throw");

    threw = false;
    try {
      maintenanceService.createMaintenanceRecord({
        vehicle_id: vehicleA,
        maintenance_type: "engine_oil",
        maintenance_date: "bad-date",
      });
    } catch (err) {
      threw = true;
      assert(/tarih/i.test(err.message), err.message);
    }
    assert(threw, "invalid date should throw");
  });

  test("empty state handling", () => {
    const emptyVehicle = seedVehicle("06 EMPTY 00");
    const rows = maintenanceService.listMaintenanceRecords({ vehicle_id: emptyVehicle });
    assert(Array.isArray(rows), "rows array");
    assert(rows.length === 0, "empty vehicle filter");

    const summary = maintenanceService.getSummary({ vehicle_id: emptyVehicle });
    assert(summary.total_records === 0, "empty summary records");
    assert(summary.total_cost === 0, "empty summary cost");
    assert(summary.vehicles_with_maintenance === 0, "empty summary vehicles");
  });

  test("delete record", () => {
    const deleted = maintenanceService.deleteMaintenanceRecord(createdId);
    assert(deleted.id === createdId, "deleted id");
    assert(!maintenanceService.getMaintenanceRecord(createdId), "record removed");

    let threw = false;
    try {
      maintenanceService.deleteMaintenanceRecord(createdId);
    } catch (err) {
      threw = true;
    }
    assert(threw, "delete missing record should throw");
  });

  test("legacy listAll still works", () => {
    const legacy = maintenanceService.listAll({ vehicle_id: vehicleB });
    assert(Array.isArray(legacy), "legacy list array");
    assert(legacy.length >= 1, "legacy list has rows");
    assert(legacy[0].type_label, "legacy type label");
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
