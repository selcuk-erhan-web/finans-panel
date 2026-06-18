/**
 * FLEETOS-AKM-01 vehicle center smoke test (isolated temp DB)
 * node scripts/test-vehicle-center.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-vc-test-", "test-vehicle-center.js");

const db = require("../lib/db");
const vehicleCenterService = require("../services/vehicleCenterService");
const { vehicleCenterPageHtml } = require("../lib/components/vehicleCenter");
const { fleetCardLarge, fleetCardGrid } = require("../lib/components/fleet");

// Empty fleet cards
const emptyGrid = fleetCardGrid([]);
assert(emptyGrid.includes("İlk aracınızı ekleyerek"), "vehicles empty state");
assert(!emptyGrid.includes("/vehicle/"), "no vehicle center link when empty");

// Add vehicle
const ins = db
  .prepare(
    "INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)"
  )
  .run("16S4605", "Mercedes", "Sprinter", "2022", "Servis", 125000);
const vehicleId = ins.lastInsertRowid;

const summary = [
  {
    id: vehicleId,
    plate: "16S4605",
    brand: "Mercedes",
    model: "Sprinter",
    type: "Servis",
    income: 0,
    expense: 0,
    net: 0,
  },
];
const cardHtml = fleetCardLarge(summary[0]);
assert(cardHtml.includes(`href="/vehicle/${vehicleId}"`), "fleet card links to vehicle center");
assert(cardHtml.includes("Araç Merkezi"), "fleet card CTA label");

// Empty bundle page
let bundle = vehicleCenterService.getVehicleCenterBundle(vehicleId);
assert(bundle, "bundle exists");
assert(bundle.profit.income === 0, "empty income");
let html = vehicleCenterPageHtml(bundle);
assert(html.includes("Araç Merkezi V2"), "page title block");
assert(html.includes("Henüz veri bulunmuyor") || html.includes("Henüz gelir"), "empty state messaging");
assert(html.includes("vcMonthlyChart") === false || html.includes("vc-empty"), "no broken chart or empty chart area");

// Add income/expense
db.prepare(
  `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
   VALUES (?, 'income', 'Servis Gelirleri', 'service', 50000, 'Test', '2026-06-01')`
).run(vehicleId);
db.prepare(
  `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
   VALUES (?, 'expense', 'Yakıt', 'yakit', 8000, 'Fuel', '2026-06-02')`
).run(vehicleId);

bundle = vehicleCenterService.getVehicleCenterBundle(vehicleId);
assert(bundle.profit.income === 50000, "income reflected in KPI");
assert(bundle.incomeBySlug.service === 50000, "service income breakdown");
assert(bundle.profit.fuel >= 8000, "fuel expense in profit row");
html = vehicleCenterPageHtml(bundle);
assert(html.includes("Finansal KPI"), "financial section");
assert(html.includes("vcMonthlyChart"), "chart when data exists");

// 404 case
assert(vehicleCenterService.getVehicleCenterBundle(99999) === null, "missing vehicle returns null");

console.log("✓ FLEETOS-AKM-01 vehicle center tests passed");
cleanupTestDatabase(tmpDir);
