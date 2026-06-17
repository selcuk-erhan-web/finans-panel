/**
 * FLEETOS-PROFIT-03 — araç bazlı kârlılık motoru testleri (temp DB)
 * node scripts/test-profit-engine.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-profit-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

Object.keys(require.cache).forEach((key) => {
  if (
    key.includes("/lib/db.js") ||
    key.includes("/services/profitService") ||
    key.includes("/services/profitabilityService")
  ) {
    delete require.cache[key];
  }
});

const db = require("../lib/db");
const profitService = require("../services/profitService");
const { normalizePlate } = require("../utils/plate");

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

function main() {
  console.log("1) Seed 16 SYV 16…");
  const vehicleId = seedVehicle("16 SYV 16", "Servis");

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis Gelirleri', 'service', 145000, 'test gelir', '2026-05-15 12:00:00')`
  ).run(vehicleId);

  db.prepare(
    `INSERT INTO fuel_records (vehicle_id, liter, total_amount, fuel_date, liters, total_cost, date)
     VALUES (?, 100, 22000, '2026-05-10', 100, 22000, '2026-05-10 12:00:00')`
  ).run(vehicleId);

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'HGS / OGS', 'hgs-ogs', 3400, 'HGS test', '2026-05-11 12:00:00')`
  ).run(vehicleId);

  db.prepare(
    `INSERT INTO maintenance_records (vehicle_id, type, description, amount, service_date, status)
     VALUES (?, 'oil', 'Yağ bakım', 6800, '2026-05-12', 'done')`
  ).run(vehicleId);

  console.log("2) Compute profit row…");
  const rows = profitService.getVehicleProfitRows();
  const row = rows.find((r) => r.vehicleId === vehicleId);
  assert(row, "vehicle row missing");

  assert(row.revenue === 145000, `revenue ${row.revenue}`);
  assert(row.fuelExpense === 22000, `fuel ${row.fuelExpense}`);
  assert(row.hgsExpense === 3400, `hgs ${row.hgsExpense}`);
  assert(row.maintenanceExpense === 6800, `maint ${row.maintenanceExpense}`);
  assert(row.totalExpense === 32200, `totalExpense ${row.totalExpense}`);
  assert(row.netProfit === 112800, `netProfit ${row.netProfit}`);
  assert(row.profitMargin === 77.79, `margin ${row.profitMargin}`);

  console.log("3) Fleet summary…");
  const summary = profitService.getFleetSummary(rows);
  assert(summary.totalNet === 112800, "fleet net");
  assert(summary.mostProfitable.plate === "16 SYV 16", "best vehicle");

  console.log("4) Negative profit support…");
  const lossId = seedVehicle("34 ABC 99", "Turizm");
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'Yakıt', 'yakit', 50000, 'loss fuel', '2026-05-01 12:00:00')`
  ).run(lossId);
  const lossRow = profitService.getVehicleProfitRows().find((r) => r.vehicleId === lossId);
  assert(lossRow.netProfit === -50000, "negative net");
  assert(lossRow.profitMargin === null, "null margin when no revenue");

  console.log("5) Filter Servis…");
  const servisOnly = profitService.getVehicleProfitRows({ vehicleType: "Servis" });
  assert(servisOnly.length === 1, "servis filter count");
  assert(servisOnly[0].vehicleId === vehicleId, "servis vehicle");

  console.log("6) Empty data no throw…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-profit-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  delete require.cache[require.resolve("../lib/db")];
  delete require.cache[require.resolve("../services/profitService")];
  require("../lib/db");
  const emptyRows = require("../services/profitService").getVehicleProfitRows();
  assert(Array.isArray(emptyRows) && emptyRows.length === 0, "empty ok");

  console.log("\n✓ FLEETOS-PROFIT-03 tests passed");
  cleanup();
  try {
    if (fs.existsSync(emptyDb)) fs.unlinkSync(emptyDb);
    fs.rmdirSync(emptyDir);
  } catch (e) {}
}

try {
  main();
} catch (e) {
  console.error("✗", e.message);
  cleanup();
  process.exit(1);
}
