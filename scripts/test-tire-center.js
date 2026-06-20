/**
 * FLEETOS TYR-1 — Tire Center Foundation tests (isolated temp DB)
 * node scripts/test-tire-center.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = ["/services/tireService", "/services/vehicleCenterService"];

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-tyr1-", "test-tire-center.js", CACHE_PATTERNS);

const db = require("../lib/db");
const tireService = require("../services/tireService");
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
  console.log("FLEETOS TYR-1 Tire Center tests\n");

  test("migration creates tires table", () => {
    const cols = db.prepare("PRAGMA table_info(tires)").all().map((c) => c.name);
    assert(cols.includes("vehicle_id"), "missing vehicle_id");
    assert(cols.includes("season"), "missing season");
    assert(cols.includes("status"), "missing status");
    assert(cols.includes("quantity"), "missing quantity");
    assert(cols.includes("updated_at"), "missing updated_at");
  });

  test("migration idempotent", () => {
    runMigrationTwice();
    const cols = db.prepare("PRAGMA table_info(tires)").all().map((c) => c.name);
    assert(cols.includes("brand"), "brand lost after re-migrate");
  });

  const vehicleA = seedVehicle("16 TYR 01");
  const vehicleB = seedVehicle("34 TYR 99");

  let createdId;

  test("create tire record", () => {
    const record = tireService.createTireRecord({
      vehicle_id: vehicleA,
      season: "summer",
      brand: "Michelin",
      model: "Pilot Sport",
      size: "205/55 R16",
      dot: "0124",
      tread_depth_mm: 6.5,
      quantity: 4,
      status: "on_vehicle",
      position: "full_set",
      purchase_date: "2026-03-10",
      cost: "12.500,00",
      vendor: "Lastik Servis A",
      notes: "Yaz seti",
    });
    createdId = record.id;
    assert(record.id, "id missing");
    assert(record.plate === "16 TYR 01", `plate ${record.plate}`);
    assert(record.season === "summer", "season");
    assert(record.quantity === 4, "quantity");
    assert(record.cost === 12500, `cost ${record.cost}`);
    assert(record.status === "on_vehicle", "status");
  });

  test("get tire record", () => {
    const record = tireService.getTireRecord(createdId);
    assert(record, "record missing");
    assert(record.brand === "Michelin", "brand");
    assert(record.notes === "Yaz seti", "notes");
  });

  test("update tire record", () => {
    const updated = tireService.updateTireRecord(createdId, {
      season: "winter",
      brand: "Pirelli",
      quantity: 2,
      status: "in_storage",
      cost: 8000,
    });
    assert(updated.season === "winter", "updated season");
    assert(updated.brand === "Pirelli", "updated brand");
    assert(updated.quantity === 2, "updated quantity");
    assert(updated.status === "in_storage", "updated status");
    assert(updated.cost === 8000, "updated cost");
  });

  test("list tire records", () => {
    tireService.createTireRecord({
      vehicle_id: vehicleB,
      season: "all_season",
      brand: "Bridgestone",
      model: "Turanza",
      quantity: 4,
      status: "on_vehicle",
      cost: 9500,
    });

    const rows = tireService.listTireRecords();
    assert(rows.length === 2, `expected 2 rows, got ${rows.length}`);
  });

  test("vehicle filter works", () => {
    const rows = tireService.listTireRecords({ vehicle_id: vehicleA });
    assert(rows.length === 1, `expected 1 row for vehicle A, got ${rows.length}`);
    assert(rows[0].vehicle_id === String(vehicleA), "vehicle filter id");
  });

  test("season filter works", () => {
    const rows = tireService.listTireRecords({ season: "all_season" });
    assert(rows.length === 1, `expected 1 all_season row, got ${rows.length}`);
    assert(rows[0].season === "all_season", "season filter value");
  });

  test("status filter works", () => {
    const rows = tireService.listTireRecords({ status: "in_storage" });
    assert(rows.length === 1, `expected 1 in_storage row, got ${rows.length}`);
    assert(rows[0].status === "in_storage", "status filter value");
  });

  test("summary total quantity works", () => {
    const summary = tireService.getTireSummary();
    assert(summary.total_records === 2, "total records");
    assert(summary.total_quantity === 6, `total quantity ${summary.total_quantity}`);
    assert(summary.in_storage === 2, "in_storage qty");
    assert(summary.on_vehicle === 4, "on_vehicle qty");
  });

  test("summary total cost works", () => {
    const summary = tireService.getTireSummary();
    assert(summary.total_cost === 8000 + 9500, `total cost ${summary.total_cost}`);
    assert(summary.winter === 2, "winter qty in summary");
    assert(summary.all_season === 4, "all_season qty in summary");
  });

  test("invalid input handling", () => {
    let threw = false;
    try {
      tireService.createTireRecord({
        vehicle_id: vehicleA,
        season: "invalid",
        status: "on_vehicle",
        quantity: 4,
      });
    } catch (err) {
      threw = true;
      assert(/Sezon/i.test(err.message), err.message);
    }
    assert(threw, "invalid season should throw");

    threw = false;
    try {
      tireService.createTireRecord({
        vehicle_id: 99999,
        season: "summer",
        status: "on_vehicle",
        quantity: 4,
      });
    } catch (err) {
      threw = true;
      assert(/Araç/i.test(err.message), err.message);
    }
    assert(threw, "missing vehicle should throw");

    threw = false;
    try {
      tireService.createTireRecord({
        vehicle_id: vehicleA,
        season: "summer",
        status: "on_vehicle",
        quantity: 0,
      });
    } catch (err) {
      threw = true;
      assert(/Adet/i.test(err.message), err.message);
    }
    assert(threw, "invalid quantity should throw");

    threw = false;
    try {
      tireService.createTireRecord({
        vehicle_id: vehicleA,
        season: "summer",
        status: "on_vehicle",
        quantity: 4,
        tread_depth_mm: "bad",
      });
    } catch (err) {
      threw = true;
      assert(/Diş/i.test(err.message), err.message);
    }
    assert(threw, "invalid tread depth should throw");
  });

  test("empty state handling", () => {
    const emptyVehicle = seedVehicle("06 TYR 00");
    const rows = tireService.listTireRecords({ vehicle_id: emptyVehicle });
    assert(Array.isArray(rows), "rows array");
    assert(rows.length === 0, "empty vehicle filter");

    const summary = tireService.getTireSummary({ vehicle_id: emptyVehicle });
    assert(summary.total_records === 0, "empty summary records");
    assert(summary.total_quantity === 0, "empty summary quantity");
    assert(summary.total_cost === 0, "empty summary cost");
  });

  test("delete tire record", () => {
    const deleted = tireService.deleteTireRecord(createdId);
    assert(deleted.id === createdId, "deleted id");
    assert(!tireService.getTireRecord(createdId), "record removed");

    let threw = false;
    try {
      tireService.deleteTireRecord(createdId);
    } catch (err) {
      threw = true;
    }
    assert(threw, "delete missing record should throw");
  });

  test("vehicle integration helper does not crash", () => {
    const status = tireService.getVehicleTireStatus(vehicleB);
    assert(status.vehicle_id === String(vehicleB), "vehicle id");
    assert(Array.isArray(status.records), "records array");
    assert(status.records.length === 1, "on_vehicle record for vehicle B");

    const bundle = vehicleCenterService.getVehicleCenterBundle(vehicleB);
    assert(bundle, "vehicle bundle");
    assert(bundle.tireStatus, "tireStatus in bundle");
    assert(Array.isArray(bundle.tireStatus.records), "bundle tire records");

    let threw = false;
    try {
      tireService.getVehicleTireStatus(99999);
    } catch (err) {
      threw = true;
      assert(/Araç/i.test(err.message), err.message);
    }
    assert(threw, "invalid vehicle should throw");
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
