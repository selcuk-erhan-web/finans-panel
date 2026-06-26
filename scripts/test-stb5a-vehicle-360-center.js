/**
 * FLEETOS STB-5A — Vehicle 360 Center
 * node scripts/test-stb5a-vehicle-360-center.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");
const LAYOUT_VERSION = require("../lib/layout-version");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleCenter = fs.readFileSync(path.join(root, "lib/components/vehicleCenter.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01", `layout version: ${LAYOUT_VERSION}`);

assert(vehiclesRoute.includes('app.get("/vehicle/:id"'), "/vehicle/:id route preserved");
assert(vehiclesRoute.includes('app.get("/vehicles/:id/360"'), "vehicle 360 alias route");
assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles list preserved");
assert(vehicleCenter.includes("vehicle360PageHtml"), "vehicle center uses 360 page");

assert(css.includes(".vehicle-360-center"), "vehicle 360 styles");
assert(css.includes(".vehicle-360-identity"), "vehicle 360 identity wrapper");
assert(css.includes(".vehicle-360-hero__media"), "vehicle 360 hero media styles");

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-stb5a-", "test-stb5a-vehicle-360-center.js");
const db = require("../lib/db");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { vehicleCenterPageHtml } = require("../lib/components/vehicleCenter");
const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 360", "Mercedes", "Vito", "2021", "Servis", 88000);
const vehicleId = ins.lastInsertRowid;

let bundle = getVehicleCenterBundle(vehicleId);
assert(bundle, "bundle loads from existing service");

let html = vehicle360PageHtml(bundle);
assert(html.includes("Vehicle 360 Center"), "360 page title");
assert(html.includes("16 STB 360"), "plate visible");
assert(html.includes("executive-kpi-grid"), "executive summary cards");
assert(html.includes("Finansal Görünüm"), "financial overview section");
assert(html.includes("Operasyon Zaman Çizelgesi"), "timeline section");
assert(html.includes("Uygunluk Durumu"), "compliance section");
assert(html.includes("Bakım Özeti"), "maintenance section");
assert(html.includes("Lastik Özeti"), "tire section");
assert(html.includes("Yönetici Özeti"), "recommendation section");
assert(html.includes("Araç Zekâsı"), "quick action");
assert(
  html.includes("bakım kaydı henüz oluşturulmamış") ||
    html.includes("Bakım Merkezi"),
  "maintenance empty or data state"
);
assert(
  html.includes("lastik envanteri bekleniyor") || html.includes("Lastik Merkezi"),
  "tire empty or data state"
);
assert(!html.includes("undefined"), "no undefined leak");

const pageHtml = vehicleCenterPageHtml(bundle);
assert(pageHtml.includes("vehicle-360-center"), "vehicle detail renders 360");
assert(pageHtml.includes("Araç Zekâsı Özeti"), "legacy v1.1 hook preserved hidden");
assert(getVehicleCenterBundle(999999) === null, "missing vehicle safe");

execSync("node -c routes/vehicles.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

cleanupTestDatabase(tmpDir);
console.log("✓ FleetOS STB-5A vehicle 360 center tests passed");
