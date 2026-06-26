/**
 * FLEETOS STB-5B.1 — Vehicle Hero Visual Recovery
 * node scripts/test-stb5b1-vehicle-hero-visual-recovery.js
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
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01",
  `layout version: ${LAYOUT_VERSION}`
);

[
  ".vehicle-360-identity",
  ".vehicle-360-hero__media",
  ".vehicle-360-hero__media--has-image",
  ".vehicle-360-hero__image",
  ".vehicle-360-decision-strip",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(css.includes("min-height: 260px"), "hero min-height 260px");
assert(css.match(/\.vehicle-360-hero[\s\S]*?min-height:\s*260px/), "hero block min-height");

const {
  resolveInsightVehicleImageSrc,
  vehicleImageForVehicle,
} = require("../lib/vehicleInsightImages");

assert(resolveInsightVehicleImageSrc("16 LR 005") === "/images/vehicles/bus-clean.png", "16 LR 005 → bus-clean");
assert(resolveInsightVehicleImageSrc("16 LA 005") === "/images/vehicles/sprinter-clean.png", "16 LA 005 → sprinter-clean");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5b1-",
  "test-stb5b1-vehicle-hero-visual-recovery.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const db = require("../lib/db");

const plates = [
  ["16 LR 005", "/images/vehicles/bus-clean.png"],
  ["16 LA 005", "/images/vehicles/sprinter-clean.png"],
];

plates.forEach(([plate, src]) => {
  const ins = db
    .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
    .run(plate, "Mercedes", "Test", "2021", "Turizm", 120000);
  const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
  assert(bundle, `bundle for ${plate}`);
  assert(vehicleImageForVehicle(bundle.vehicle) === src, `image map ${plate}`);

  const html = vehicle360PageHtml(bundle);
  assert(html.includes("vehicle-360-identity"), "identity wrapper");
  assert(html.includes("vehicle-360-hero__media"), "hero media visible in markup");
  assert(html.includes("vehicle-360-hero__image"), "hero image in markup");
  assert(html.includes(src), `image src ${plate}`);
  assert(html.includes("vehicle-360-decision-strip"), "decision strip");
  assert(html.indexOf("vehicle-360-decision-strip") < html.indexOf("executive-kpi-grid"), "decision strip before KPI row");
});

execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/vehicleInsightImages.js", { cwd: root, stdio: "pipe" });

cleanupTestDatabase(tmpDir);
console.log("✓ FleetOS STB-5B.1 vehicle hero visual recovery tests passed");
