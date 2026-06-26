/**
 * FLEETOS STB-5B — Vehicle 360 Executive Hero
 * node scripts/test-stb5b-vehicle-executive-hero.js
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
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

assert(LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01", `layout version: ${LAYOUT_VERSION}`);

[
  ".vehicle-360-identity",
  ".vehicle-360-hero",
  ".vehicle-360-hero__media",
  ".vehicle-360-hero__image",
  ".vehicle-360-hero__content",
  ".vehicle-360-hero__title",
  ".vehicle-360-hero__meta",
  ".vehicle-360-hero__badges",
  ".vehicle-360-hero__actions",
  ".vehicle-360-decision-strip",
  ".vehicle-360-decision-card",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

const {
  vehicleImageForVehicle,
  vehicleDisplayType,
  resolveInsightVehicleImageSrc,
} = require("../lib/vehicleInsightImages");

assert(resolveInsightVehicleImageSrc("16 SYV 16") === "/images/vehicles/vito-clean.png", "16 SYV 16 → vito-clean");
assert(resolveInsightVehicleImageSrc("16 LR 005") === "/images/vehicles/bus-clean.png", "16 LR 005 → bus-clean");
assert(resolveInsightVehicleImageSrc("16 LA 005") === "/images/vehicles/sprinter-clean.png", "16 LA 005 → sprinter-clean");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5b-",
  "test-stb5b-vehicle-executive-hero.js"
);

const {
  vehicle360PageHtml,
  buildDecisionStrip,
} = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");
const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5B", "Mercedes", "Vito", "2021", "Servis", 92000);
const vehicleId = ins.lastInsertRowid;

const bundle = getVehicleCenterBundle(vehicleId);
assert(bundle, "bundle loads");

const syvVehicle = { ...bundle.vehicle, plate: "16 SYV 16" };
assert(
  vehicleImageForVehicle(syvVehicle) === "/images/vehicles/vito-clean.png",
  "vehicleImageForVehicle maps plate"
);
assert(vehicleDisplayType(syvVehicle).includes("Vito"), "vehicleDisplayType");

const html = vehicle360PageHtml({
  ...bundle,
  vehicle: syvVehicle,
});
assert(html.includes("vehicle-360-identity"), "identity wrapper");
assert(html.includes("vehicle-360-hero"), "executive hero section");
assert(html.includes("vehicle-360-hero__image"), "vehicle image rendered");
assert(html.includes("/images/vehicles/vito-clean.png"), "vito-clean image in hero");
assert(html.includes("vehicle-360-decision-strip"), "decision strip");
assert(html.includes("vehicle-360-decision-card"), "decision cards");
assert(html.includes("vehicle-360-hero__pill"), "quick action pills");
assert(html.includes("Araç Zekâsı"), "intelligence pill");
assert(html.includes("Net Durum"), "decision strip label");
assert(html.includes("Yönetici Aksiyonu"), "manager action card");
assert(!html.includes("undefined"), "no undefined leak");

const decision = buildDecisionStrip(bundle, []);
assert(decision.netStatus, "decision net status");
assert(decision.primaryRisk, "decision primary risk");
assert(decision.managerAction, "decision manager action");

const summaries = getAllVehicleSummaries();
assert(summaries.length > 0, "vehicles list summaries");
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet card link preserved");

const app = express();
app.get("/vehicle/:id", (req, res) => renderVehicleDetail(req, res));

async function request(pathname) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://127.0.0.1:${port}${pathname}`)
        .then(async (res) => {
          const body = await res.text();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

(async () => {
  const detail = await request(`/vehicle/${vehicleId}`);
  assert(detail.status === 200, `/vehicle/:id status ${detail.status}`);
  assert(detail.body.includes("vehicle-360-hero"), "route renders hero");

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/vehicleInsightImages.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5B vehicle executive hero tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
