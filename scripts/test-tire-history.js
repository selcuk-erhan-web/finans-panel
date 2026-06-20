/**
 * FLEETOS TYR-2 — Tire Change History tests (isolated temp DB)
 * node scripts/test-tire-history.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
  purgeDbFromRequireCache,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/tireHistoryService",
  "/services/tireService",
  "/services/vehicleCenterService",
];

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-tyr2-", "test-tire-history.js", CACHE_PATTERNS);

const db = require("../lib/db");
const tireHistoryService = require("../services/tireHistoryService");
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
  console.log("FLEETOS TYR-2 Tire Change History tests\n");

  test("migration creates tire_change_history table", () => {
    const cols = db.prepare("PRAGMA table_info(tire_change_history)").all().map((c) => c.name);
    assert(cols.includes("vehicle_id"), "missing vehicle_id");
    assert(cols.includes("change_type"), "missing change_type");
    assert(cols.includes("change_date"), "missing change_date");
    assert(cols.includes("tire_id"), "missing tire_id");
    assert(cols.includes("updated_at"), "missing updated_at");
  });

  test("migration idempotent", () => {
    runMigrationTwice();
    const cols = db.prepare("PRAGMA table_info(tire_change_history)").all().map((c) => c.name);
    assert(cols.includes("quantity"), "quantity lost after re-migrate");
  });

  const vehicleA = seedVehicle("16 THS 01");
  const vehicleB = seedVehicle("34 THS 99");

  const tireA = tireService.createTireRecord({
    vehicle_id: vehicleA,
    season: "summer",
    brand: "Michelin",
    quantity: 4,
    status: "on_vehicle",
  });

  let createdId;

  test("create tire history record", () => {
    const record = tireHistoryService.createTireChangeRecord({
      vehicle_id: vehicleA,
      tire_id: tireA.id,
      change_type: "installed",
      change_date: "2026-04-10",
      odometer_km: 120000,
      season: "summer",
      position: "full_set",
      quantity: 4,
      cost: "8.500,00",
      vendor: "Lastik Servis",
      notes: "Yaz seti takıldı",
    });
    createdId = record.id;
    assert(record.id, "id missing");
    assert(record.plate === "16 THS 01", `plate ${record.plate}`);
    assert(record.change_type === "installed", "change_type");
    assert(record.tire_id === tireA.id, "tire_id");
    assert(record.cost === 8500, `cost ${record.cost}`);
  });

  test("get tire history record", () => {
    const record = tireHistoryService.getTireChangeRecord(createdId);
    assert(record, "record missing");
    assert(record.notes === "Yaz seti takıldı", "notes");
  });

  test("update tire history record", () => {
    const updated = tireHistoryService.updateTireChangeRecord(createdId, {
      change_type: "seasonal_swap",
      season: "winter",
      quantity: 4,
      cost: 9500,
      notes: "Kış setine geçildi",
    });
    assert(updated.change_type === "seasonal_swap", "updated change_type");
    assert(updated.season === "winter", "updated season");
    assert(updated.cost === 9500, "updated cost");
  });

  test("list tire history records", () => {
    tireHistoryService.createTireChangeRecord({
      vehicle_id: vehicleB,
      change_type: "storage_move",
      change_date: "2026-05-01",
      season: "summer",
      quantity: 4,
      cost: 0,
      vendor: "Depo",
    });

    tireHistoryService.createTireChangeRecord({
      vehicle_id: vehicleA,
      change_type: "removed",
      change_date: "2026-06-01",
      odometer_km: 125000,
      quantity: 2,
      cost: 500,
    });

    const rows = tireHistoryService.listTireChangeRecords();
    assert(rows.length === 3, `expected 3 rows, got ${rows.length}`);
  });

  test("vehicle filter works", () => {
    const rows = tireHistoryService.listTireChangeRecords({ vehicle_id: vehicleA });
    assert(rows.length === 2, `expected 2 rows for vehicle A, got ${rows.length}`);
    assert(rows.every((r) => r.vehicle_id === String(vehicleA)), "vehicle filter id");
  });

  test("change_type filter works", () => {
    const rows = tireHistoryService.listTireChangeRecords({ change_type: "storage_move" });
    assert(rows.length === 1, `expected 1 storage_move row, got ${rows.length}`);
    assert(rows[0].change_type === "storage_move", "change_type filter value");
  });

  test("season filter works", () => {
    const rows = tireHistoryService.listTireChangeRecords({ season: "winter" });
    assert(rows.length === 1, `expected 1 winter row, got ${rows.length}`);
    assert(rows[0].season === "winter", "season filter value");
  });

  test("date range filter works", () => {
    const rows = tireHistoryService.listTireChangeRecords({
      date_from: "2026-05-01",
      date_to: "2026-06-01",
    });
    assert(rows.length === 2, `expected 2 rows in range, got ${rows.length}`);
    assert(rows[0].change_date === "2026-06-01", "newest date first");
  });

  test("summary total quantity works", () => {
    const summary = tireHistoryService.getTireHistorySummary();
    assert(summary.total_records === 3, "total records");
    assert(summary.total_quantity === 10, `total quantity ${summary.total_quantity}`);
    assert(summary.seasonal_swap === 4, "seasonal_swap qty");
    assert(summary.storage_move === 4, "storage_move qty");
    assert(summary.removed === 2, "removed qty");
  });

  test("summary total cost works", () => {
    const summary = tireHistoryService.getTireHistorySummary();
    assert(summary.total_cost === 9500 + 500, `total cost ${summary.total_cost}`);
    assert(summary.installed === 0, "installed after update");
  });

  test("invalid input handling", () => {
    let threw = false;
    try {
      tireHistoryService.createTireChangeRecord({
        vehicle_id: vehicleA,
        change_type: "invalid",
        change_date: "2026-01-01",
        quantity: 4,
      });
    } catch (err) {
      threw = true;
      assert(/İşlem türü/i.test(err.message), err.message);
    }
    assert(threw, "invalid change_type should throw");

    threw = false;
    try {
      tireHistoryService.createTireChangeRecord({
        vehicle_id: 99999,
        change_type: "installed",
        change_date: "2026-01-01",
        quantity: 4,
      });
    } catch (err) {
      threw = true;
      assert(/Araç/i.test(err.message), err.message);
    }
    assert(threw, "missing vehicle should throw");

    threw = false;
    try {
      tireHistoryService.createTireChangeRecord({
        vehicle_id: vehicleA,
        change_type: "installed",
        change_date: "bad-date",
        quantity: 4,
      });
    } catch (err) {
      threw = true;
      assert(/tarih/i.test(err.message), err.message);
    }
    assert(threw, "invalid date should throw");

    threw = false;
    try {
      tireHistoryService.createTireChangeRecord({
        vehicle_id: vehicleA,
        change_type: "installed",
        change_date: "2026-01-01",
        quantity: 0,
      });
    } catch (err) {
      threw = true;
      assert(/Adet/i.test(err.message), err.message);
    }
    assert(threw, "invalid quantity should throw");
  });

  test("empty state handling", () => {
    const emptyVehicle = seedVehicle("06 THS 00");
    const rows = tireHistoryService.listTireChangeRecords({ vehicle_id: emptyVehicle });
    assert(Array.isArray(rows), "rows array");
    assert(rows.length === 0, "empty vehicle filter");

    const summary = tireHistoryService.getTireHistorySummary({ vehicle_id: emptyVehicle });
    assert(summary.total_records === 0, "empty summary records");
    assert(summary.total_quantity === 0, "empty summary quantity");
    assert(summary.total_cost === 0, "empty summary cost");
  });

  test("delete tire history record", () => {
    const deleted = tireHistoryService.deleteTireChangeRecord(createdId);
    assert(deleted.id === createdId, "deleted id");
    assert(!tireHistoryService.getTireChangeRecord(createdId), "record removed");

    let threw = false;
    try {
      tireHistoryService.deleteTireChangeRecord(createdId);
    } catch (err) {
      threw = true;
    }
    assert(threw, "delete missing record should throw");
  });

  test("vehicle integration helper does not crash", () => {
    const history = tireHistoryService.getVehicleTireHistory(vehicleB);
    assert(history.vehicle_id === String(vehicleB), "vehicle id");
    assert(Array.isArray(history.records), "records array");
    assert(history.records.length === 1, "one record for vehicle B");
    assert(history.summary.total_records === 1, "summary in vehicle history");

    const bundle = vehicleCenterService.getVehicleCenterBundle(vehicleB);
    assert(bundle, "vehicle bundle");
    assert(bundle.tireChangeHistory, "tireChangeHistory in bundle");
    assert(Array.isArray(bundle.tireChangeHistory.records), "bundle history records");

    let threw = false;
    try {
      tireHistoryService.getVehicleTireHistory(99999);
    } catch (err) {
      threw = true;
      assert(/Araç/i.test(err.message), err.message);
    }
    assert(threw, "invalid vehicle should throw");
  });

  test("TYR-1 tire center still works", () => {
    const tires = tireService.listTireRecords({ vehicle_id: vehicleA });
    assert(tires.length === 1, "TYR-1 tire record still listed");
    const tireSummary = tireService.getTireSummary();
    assert(tireSummary.total_records >= 1, "TYR-1 summary still works");
    const tireStatus = tireService.getVehicleTireStatus(vehicleA);
    assert(Array.isArray(tireStatus.records), "TYR-1 vehicle tire status");
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
