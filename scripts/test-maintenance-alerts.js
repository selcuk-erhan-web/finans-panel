/**
 * FLEETOS MNT-4 — Maintenance Alerts tests (isolated temp DB)
 * node scripts/test-maintenance-alerts.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/maintenanceService",
  "/services/maintenanceSchedulerService",
  "/services/maintenanceAlertService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-mnt4-",
  "test-maintenance-alerts.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const maintenanceService = require("../services/maintenanceService");
const maintenanceAlertService = require("../services/maintenanceAlertService");
const { maintenanceAlertsPageHtml } = require("../lib/components/maintenanceAlerts");
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

function countBySeverity(severity) {
  return db.prepare("SELECT COUNT(*) AS c FROM maintenance_alerts WHERE severity = ?").get(severity).c;
}

function main() {
  console.log("FLEETOS MNT-4 Maintenance Alerts tests\n");

  const vehicleOk = seedVehicle("16 OK 01", 47000);
  const vehicleUpcoming = seedVehicle("34 UPC 02", 109500);
  const vehicleDue = seedVehicle("06 DUE 03", 110000);
  const vehicleOverdue = seedVehicle("35 OVD 04", 112000);
  const vehicleUnknown = seedVehicle("41 UNK 05", 80000);

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
    maintenance_type: "periodic_maintenance",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 3500,
    vendor: "Servis C",
    description: "Due test",
  });

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleOverdue,
    maintenance_type: "oil_filter",
    maintenance_date: "2025-07-02",
    odometer_km: 100000,
    cost: 900,
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

  test("upcoming alert creation", () => {
    const first = maintenanceAlertService.generateMaintenanceAlerts(REF);
    assert(countBySeverity("upcoming") >= 1, `upcoming ${countBySeverity("upcoming")}`);
    assert(first.created >= 3, `created ${first.created}`);
  });

  test("due alert creation", () => {
    assert(countBySeverity("due") >= 1, `due ${countBySeverity("due")}`);
  });

  test("overdue alert creation", () => {
    assert(countBySeverity("overdue") >= 1, `overdue ${countBySeverity("overdue")}`);
  });

  test("ok does not create alert", () => {
    const okAlerts = db
      .prepare("SELECT COUNT(*) AS c FROM maintenance_alerts WHERE vehicle_id = ?")
      .get(vehicleOk).c;
    assert(okAlerts === 0, `ok vehicle alerts ${okAlerts}`);
  });

  test("unknown does not create alert", () => {
    const unknownAlerts = db
      .prepare("SELECT COUNT(*) AS c FROM maintenance_alerts WHERE vehicle_id = ?")
      .get(vehicleUnknown).c;
    assert(unknownAlerts === 0, `unknown vehicle alerts ${unknownAlerts}`);
  });

  test("duplicate prevention", () => {
    const second = maintenanceAlertService.generateMaintenanceAlerts(REF);
    assert(second.created === 0, `duplicate created ${second.created}`);
    const total = db.prepare("SELECT COUNT(*) AS c FROM maintenance_alerts").get().c;
    assert(total === countBySeverity("upcoming") + countBySeverity("due") + countBySeverity("overdue"), "stable total");
  });

  test("unread count", () => {
    const count = maintenanceAlertService.getUnreadMaintenanceAlertCount();
    assert(count >= 3, `unread ${count}`);
  });

  test("mark read", () => {
    const row = db.prepare("SELECT id FROM maintenance_alerts WHERE status = 'unread' LIMIT 1").get();
    assert(row, "unread row exists");
    const before = maintenanceAlertService.getUnreadMaintenanceAlertCount();
    const updated = maintenanceAlertService.markMaintenanceAlertRead(row.id);
    assert(updated.status === "read", "marked read");
    assert(maintenanceAlertService.getUnreadMaintenanceAlertCount() === before - 1, "unread decreased");
  });

  test("API payload shape", () => {
    const payload = maintenanceAlertService.buildMaintenanceAlertPayload({ filter: "all" }, REF);
    assert(typeof payload.unread_count === "number", "unread_count number");
    assert(Array.isArray(payload.alerts), "alerts array");
    assert(payload.alerts[0].id, "alert id");
    assert(payload.alerts[0].severity, "alert severity");
    assert(payload.alerts[0].message, "alert message");
    assert(payload.alerts[0].source_key, "alert source_key");
  });

  test("empty state does not crash", () => {
    const emptyVehicle = seedVehicle("99 EMPTY 00", 10000);
    const payload = maintenanceAlertService.buildMaintenanceAlertPayload(
      { filter: "all", vehicle_id: emptyVehicle },
      REF
    );
    assert(Array.isArray(payload.alerts), "empty alerts array");
    assert(payload.alerts.length === 0, "no alerts for empty vehicle");

    const html = maintenanceAlertsPageHtml({
      alerts: [],
      unreadCount: 0,
      filter: "all",
    });
    assert(html.includes("Aktif bakım uyarısı bulunmuyor"), "empty page message");
  });

  test("repeated generator runs do not duplicate", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM maintenance_alerts").get().c;
    maintenanceAlertService.generateMaintenanceAlerts(REF);
    maintenanceAlertService.generateMaintenanceAlerts(REF);
    maintenanceAlertService.buildMaintenanceAlertPayload({ filter: "all" }, REF);
    const after = db.prepare("SELECT COUNT(*) AS c FROM maintenance_alerts").get().c;
    assert(before === after, `duplicates inserted before=${before} after=${after}`);
  });

  test("source_key uniqueness enforced", () => {
    const sample = maintenanceAlertService.listMaintenanceAlerts({ filter: "all" })[0];
    assert(sample.source_key.includes("-"), `source_key format ${sample.source_key}`);
    let threw = false;
    try {
      db.prepare(
        `INSERT INTO maintenance_alerts (vehicle_id, plate, maintenance_type, severity, message, status, source_key)
         VALUES (?, ?, ?, ?, ?, 'unread', ?)`
      ).run(
        sample.vehicle_id,
        sample.plate,
        sample.maintenance_type,
        sample.severity,
        "duplicate",
        sample.source_key
      );
    } catch (err) {
      threw = true;
      assert(String(err.message).includes("UNIQUE"), err.message);
    }
    assert(threw, "unique source_key enforced");
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
