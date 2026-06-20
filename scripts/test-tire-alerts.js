/**
 * FLEETOS TYR-4 — Tire Alerts tests (isolated temp DB)
 * node scripts/test-tire-alerts.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/tireSeasonalSchedulerService",
  "/services/tireAlertService",
  "/services/vehicleCenterService",
];

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-tyr4-", "test-tire-alerts.js", CACHE_PATTERNS);

const db = require("../lib/db");
const tireService = require("../services/tireService");
const tireSeasonalSchedulerService = require("../services/tireSeasonalSchedulerService");
const tireAlertService = require("../services/tireAlertService");
const tireHistoryService = require("../services/tireHistoryService");
const { tireAlertsPageHtml } = require("../lib/components/tireAlerts");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-02-01T12:00:00");
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

function countBySeverity(severity) {
  return db.prepare("SELECT COUNT(*) AS c FROM tire_alerts WHERE severity = ?").get(severity).c;
}

function main() {
  console.log("FLEETOS TYR-4 Tire Alerts tests\n");

  const vehicleReady = seedVehicle("16 TYR R01");
  const vehicleMismatch = seedVehicle("34 TYR M99");
  const vehicleAttention = seedVehicle("06 TYR A77");
  const vehicleUnknown = seedVehicle("41 TYR U00");

  tireService.createTireRecord({
    vehicle_id: vehicleReady,
    season: "winter",
    brand: "Pirelli",
    quantity: 4,
    status: "on_vehicle",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleMismatch,
    season: "summer",
    brand: "Michelin",
    quantity: 4,
    status: "on_vehicle",
  });

  tireService.createTireRecord({
    vehicle_id: vehicleAttention,
    season: "summer",
    brand: "Continental",
    quantity: 4,
    status: "on_vehicle",
  });
  tireService.createTireRecord({
    vehicle_id: vehicleAttention,
    season: "winter",
    brand: "Continental",
    quantity: 4,
    status: "in_storage",
  });

  test("attention alert creation", () => {
    const first = tireAlertService.generateTireAlerts(REF);
    assert(countBySeverity("attention") >= 1, `attention ${countBySeverity("attention")}`);
    assert(first.created >= 2, `created ${first.created}`);
  });

  test("mismatch alert creation", () => {
    assert(countBySeverity("mismatch") >= 1, `mismatch ${countBySeverity("mismatch")}`);
  });

  test("unknown alert creation", () => {
    assert(countBySeverity("unknown") >= 1, `unknown ${countBySeverity("unknown")}`);
  });

  test("ready does not create alert", () => {
    const readyAlerts = db
      .prepare("SELECT COUNT(*) AS c FROM tire_alerts WHERE vehicle_id = ?")
      .get(vehicleReady).c;
    assert(readyAlerts === 0, `ready vehicle alerts ${readyAlerts}`);
  });

  test("duplicate prevention", () => {
    const second = tireAlertService.generateTireAlerts(REF);
    assert(second.created === 0, `duplicate created ${second.created}`);
    const total = db.prepare("SELECT COUNT(*) AS c FROM tire_alerts").get().c;
    assert(
      total === countBySeverity("attention") + countBySeverity("mismatch") + countBySeverity("unknown"),
      "stable total"
    );
  });

  test("unread count", () => {
    const count = tireAlertService.getUnreadTireAlertCount();
    assert(count >= 3, `unread ${count}`);
  });

  test("mark read", () => {
    const row = db.prepare("SELECT id FROM tire_alerts WHERE status = 'unread' LIMIT 1").get();
    assert(row, "unread row exists");
    const before = tireAlertService.getUnreadTireAlertCount();
    const updated = tireAlertService.markTireAlertRead(row.id);
    assert(updated.status === "read", "marked read");
    assert(tireAlertService.getUnreadTireAlertCount() === before - 1, "unread decreased");
  });

  test("API payload shape", () => {
    const payload = tireAlertService.buildTireAlertPayload({ filter: "all" }, REF);
    assert(typeof payload.unread_count === "number", "unread_count number");
    assert(Array.isArray(payload.alerts), "alerts array");
    assert(payload.alerts[0].id, "alert id");
    assert(payload.alerts[0].severity, "alert severity");
    assert(payload.alerts[0].message, "alert message");
    assert(payload.alerts[0].source_key, "alert source_key");
    assert(payload.alerts[0].current_season, "alert current_season");
    assert(payload.alerts[0].required_tire_season != null, "required_tire_season");
  });

  test("empty state does not crash", () => {
    const emptyVehicle = seedVehicle("99 TYR E00");
    const payload = tireAlertService.buildTireAlertPayload({ filter: "all", vehicle_id: emptyVehicle }, REF);
    assert(Array.isArray(payload.alerts), "empty alerts array");
    assert(payload.alerts.length === 1, "unknown alert for vehicle without tires");

    const html = tireAlertsPageHtml({
      alerts: [],
      unreadCount: 0,
      filter: "all",
    });
    assert(html.includes("Aktif lastik uyarısı bulunmuyor"), "empty page message");
  });

  test("repeated generator runs do not duplicate", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM tire_alerts").get().c;
    tireAlertService.generateTireAlerts(REF);
    tireAlertService.generateTireAlerts(REF);
    tireAlertService.buildTireAlertPayload({ filter: "all" }, REF);
    const after = db.prepare("SELECT COUNT(*) AS c FROM tire_alerts").get().c;
    assert(before === after, `duplicates inserted before=${before} after=${after}`);
  });

  test("seasonal scheduler integration remains unchanged", () => {
    const before = tireSeasonalSchedulerService.buildTireSeasonalSchedule(REF);
    assert(before.current_season === "winter", "scheduler season unchanged");
    const readyRow = before.vehicles.find((v) => v.vehicle_id === String(vehicleReady));
    assert(readyRow.status === "ready", "ready status unchanged");
    const mismatchRow = before.vehicles.find((v) => v.vehicle_id === String(vehicleMismatch));
    assert(mismatchRow.status === "mismatch", "mismatch status unchanged");
  });

  test("TYR-1 / TYR-2 / TYR-3 still work", () => {
    const tires = tireService.listTireRecords({ vehicle_id: vehicleReady });
    assert(tires.length === 1, "TYR-1 list works");

    tireHistoryService.createTireChangeRecord({
      vehicle_id: vehicleReady,
      change_type: "installed",
      change_date: "2026-01-10",
      quantity: 4,
    });
    const history = tireHistoryService.getVehicleTireHistory(vehicleReady);
    assert(history.records.length >= 1, "TYR-2 history works");

    const schedule = tireSeasonalSchedulerService.buildTireSeasonalSchedule(REF, {
      vehicle_id: vehicleAttention,
    });
    assert(schedule.vehicles[0].status === "attention", "TYR-3 attention unchanged");

    let threw = false;
    try {
      db.prepare(
        `INSERT INTO tire_alerts (vehicle_id, plate, severity, current_season, required_tire_season, current_tire_season, message, status, source_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)`
      ).run(
        vehicleMismatch,
        "34 TYR M99",
        "mismatch",
        "winter",
        "winter",
        "summer",
        "duplicate",
        tireAlertService.buildSourceKey({
          plate: "34 TYR M99",
          current_required_season: "winter",
          status: "mismatch",
        })
      );
    } catch (err) {
      threw = true;
      assert(String(err.message).includes("UNIQUE"), err.message);
    }
    assert(threw, "source_key uniqueness enforced");
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
