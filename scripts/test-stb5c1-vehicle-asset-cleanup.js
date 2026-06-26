/**
 * FLEETOS STB-5C.1 — Vehicle asset cleanup
 * node scripts/test-stb5c1-vehicle-asset-cleanup.js
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
const vehicleInsight = fs.readFileSync(path.join(root, "lib/vehicleInsightImages.js"), "utf8");
const loginPage = fs.readFileSync(path.join(root, "lib/components/loginPage.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb6a-executive-density-upgrade-01",
  `layout version: ${LAYOUT_VERSION}`
);

["vito-clean.png", "bus-clean.png", "sprinter-clean.png"].forEach((file) => {
  const filePath = path.join(root, "public/images/vehicles", file);
  assert(fs.existsSync(filePath), `clean asset missing: ${file}`);
});

assert(vehicleInsight.includes("vito-clean.png"), "vito clean mapping");
assert(vehicleInsight.includes("bus-clean.png"), "bus clean mapping");
assert(vehicleInsight.includes("sprinter-clean.png"), "sprinter clean mapping");
assert(!vehicleInsight.includes('"/images/vehicles/vito.png"'), "old vito path not in mapping");
assert(!vehicleInsight.includes('"/images/vehicles/bus.png"'), "old bus path not in mapping");
assert(!vehicleInsight.includes('"/images/vehicles/sprinter.png"'), "old sprinter path not in mapping");

assert(loginPage.includes("vito-clean.png"), "login vito clean");
assert(loginPage.includes("bus-clean.png"), "login bus clean");
assert(loginPage.includes("sprinter-clean.png"), "login sprinter clean");

assert(
  css.includes("linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.98))"),
  "image stage gradient"
);
assert(css.includes("background: transparent"), "hero image transparent background");

const { resolveInsightVehicleImageSrc } = require("../lib/vehicleInsightImages");

assert(resolveInsightVehicleImageSrc("16 SYV 16") === "/images/vehicles/vito-clean.png", "SYV → vito-clean");
assert(resolveInsightVehicleImageSrc("16 LR 005") === "/images/vehicles/bus-clean.png", "LR → bus-clean");
assert(resolveInsightVehicleImageSrc("16 LA 005") === "/images/vehicles/sprinter-clean.png", "LA → sprinter-clean");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5c1-",
  "test-stb5c1-vehicle-asset-cleanup.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const db = require("../lib/db");

const cases = [
  ["16 LR 005", "/images/vehicles/bus-clean.png"],
  ["16 LA 005", "/images/vehicles/sprinter-clean.png"],
  ["16 SYV 16", "/images/vehicles/vito-clean.png"],
];

cases.forEach(([plate, src]) => {
  db.prepare("DELETE FROM vehicles WHERE plate = ?").run(plate);
  const ins = db
    .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
    .run(plate, "Mercedes", "Fleet", "2021", "Turizm", 100000);
  const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
  assert(bundle, `bundle for ${plate}`);
  const html = vehicle360PageHtml(bundle);
  assert(html.includes(src), `${plate} renders ${src}`);
  assert(html.includes("vehicle-360-hero__image"), "hero image markup");
});

execSync("node -c lib/vehicleInsightImages.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/loginPage.js", { cwd: root, stdio: "pipe" });

cleanupTestDatabase(tmpDir);
console.log("✓ FleetOS STB-5C.1 vehicle asset cleanup tests passed");
