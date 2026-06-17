/**
 * FLEETOS-ALERT-01 — kurumsal uyarı motoru testleri (temp DB)
 * node scripts/test-alert-engine.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-alert-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/profitService") ||
      key.includes("/services/alertService")
    ) {
      delete require.cache[key];
    }
  });
}

clearModuleCache();

const db = require("../lib/db");
const alertService = require("../services/alertService");
const { normalizePlate } = require("../utils/plate");

const REF_DATE = new Date("2026-06-15T12:00:00");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    fs.rmdirSync(tmpDir);
  } catch (e) {}
}

function seedVehicle(plate, type = "Servis") {
  const norm = normalizePlate(plate);
  const info = db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, ?)")
    .run(plate, norm, type);
  return info.lastInsertRowid;
}

function insertFuel(vehicleId, amount, dateStr) {
  db.prepare(
    `INSERT INTO fuel_records (vehicle_id, liter, total_amount, fuel_date, liters, total_cost, date)
     VALUES (?, 50, ?, ?, 50, ?, ?)`
  ).run(vehicleId, amount, dateStr, amount, `${dateStr} 12:00:00`);
}

function insertHgs(vehicleId, amount, dateStr) {
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'HGS / OGS', 'hgs-ogs', ?, 'test hgs', ?)`
  ).run(vehicleId, amount, `${dateStr} 12:00:00`);
}

function insertMaintenance(vehicleId, serviceDate) {
  db.prepare(
    `INSERT INTO maintenance_records (vehicle_id, type, description, amount, service_date, status)
     VALUES (?, 'service', 'Test bakım', 1000, ?, 'done')`
  ).run(vehicleId, serviceDate);
}

function main() {
  console.log("1) LOSS_VEHICLE — zarar eden araç…");
  const lossId = seedVehicle("16 XXX 123");
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'Yakıt', 'yakit', 8500, 'loss', '2026-06-01 12:00:00')`
  ).run(lossId);

  const lossAlerts = alertService.detectLossVehicleAlerts();
  const loss = lossAlerts.find((a) => a.vehicleId === lossId);
  assert(loss, "LOSS_VEHICLE missing");
  assert(loss.type === "LOSS_VEHICLE", "type");
  assert(loss.severity === "critical", "severity");
  assert(loss.netProfit == null && loss.amount === -8500, `amount ${loss.amount}`);
  assert(loss.amount < 0, "negative amount");

  console.log("2) FUEL_ANOMALY — %30+ artış…");
  const fuelId = seedVehicle("16 ABC 456");
  ["2026-03-10", "2026-04-10", "2026-05-10"].forEach((d) => insertFuel(fuelId, 1000, d));
  insertFuel(fuelId, 1400, "2026-06-10");

  const fuelAlerts = alertService.detectFuelAnomalyAlerts(REF_DATE);
  const fuel = fuelAlerts.find((a) => a.vehicleId === fuelId);
  assert(fuel, "FUEL_ANOMALY missing");
  assert(fuel.type === "FUEL_ANOMALY", "fuel type");
  assert(fuel.severity === "warning", "fuel severity");
  assert(fuel.deltaPercent >= 30, `delta ${fuel.deltaPercent}`);

  console.log("3) HGS_ANOMALY — %50+ artış…");
  const hgsId = seedVehicle("34 HGS 789");
  ["2026-03-05", "2026-04-05", "2026-05-05"].forEach((d) => insertHgs(hgsId, 1000, d));
  insertHgs(hgsId, 1600, "2026-06-05");

  const hgsAlerts = alertService.detectHgsAnomalyAlerts(REF_DATE);
  const hgs = hgsAlerts.find((a) => a.vehicleId === hgsId);
  assert(hgs, "HGS_ANOMALY missing");
  assert(hgs.type === "HGS_ANOMALY", "hgs type");
  assert(hgs.severity === "warning", "hgs severity");
  assert(hgs.deltaPercent >= 50, `hgs delta ${hgs.deltaPercent}`);

  console.log("4) MAINTENANCE_RISK — 4+ kayıt / 90 gün…");
  const maintId = seedVehicle("16 SYV 16");
  ["2026-05-01", "2026-05-10", "2026-05-20", "2026-05-25"].forEach((d) =>
    insertMaintenance(maintId, d)
  );

  const maintAlerts = alertService.detectMaintenanceRiskAlerts();
  const maint = maintAlerts.find((a) => a.vehicleId === maintId);
  assert(maint, "MAINTENANCE_RISK missing");
  assert(maint.type === "MAINTENANCE_RISK", "maint type");
  assert(maint.severity === "info", "maint severity");
  assert(maint.count >= 4, `count ${maint.count}`);

  console.log("5) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-alert-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const emptyAlerts = require("../services/alertService").getCorporateAlerts();
  assert(Array.isArray(emptyAlerts) && emptyAlerts.length === 0, "empty list");

  console.log("6) Severity sıralaması…");
  process.env.FLEETOS_DB_PATH = testDbPath;
  clearModuleCache();
  const alertSvc = require("../services/alertService");
  const all = alertSvc.getCorporateAlerts({ refDate: REF_DATE });
  assert(all.length >= 4, `alert count ${all.length}`);

  const severities = all.map((a) => a.severity);
  const order = alertSvc.SEVERITY_ORDER;
  for (let i = 1; i < severities.length; i++) {
    assert(
      (order[severities[i - 1]] ?? 9) <= (order[severities[i]] ?? 9),
      `sort broken at ${i}: ${severities[i - 1]} vs ${severities[i]}`
    );
  }
  assert(all[0].severity === "critical", "first is critical");

  const summary = alertSvc.getAlertSummary(all);
  assert(summary.total === all.length, "summary total");
  assert(summary.critical >= 1, "summary critical");
  assert(summary.preview.length <= 3, "preview max 3");

  console.log("\n✓ FLEETOS-ALERT-01 tests passed");
  cleanup();
  try {
    if (fs.existsSync(emptyDb)) fs.unlinkSync(emptyDb);
    fs.rmdirSync(emptyDir);
  } catch (e) {}
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  cleanup();
  process.exit(1);
}
