/**
 * FLEETOS STB-6A — Executive Density Upgrade
 * node scripts/test-stb6a-executive-density-upgrade.js
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
const centerSrc = fs.readFileSync(path.join(root, "lib/components/vehicle360Center.js"), "utf8");
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleDetailRoute = fs.readFileSync(path.join(root, "routes/vehicle-detail.js"), "utf8");
const dbSchema = fs.readFileSync(path.join(root, "lib/db.js"), "utf8");

const STB6E = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6E, `layout version: ${LAYOUT_VERSION}`);

assert(centerSrc.includes("vehicle-360-center--executive-density"), "executive density modifier on page");
assert(centerSrc.includes('const incomeLabel = "Gelir"'), "compact income label");
assert(centerSrc.includes('const expenseLabel = "Gider"'), "compact expense label");
assert(centerSrc.includes('label: "Sağlık"'), "compact health label");
assert(centerSrc.includes('label: "Bakım"'), "compact maintenance label");

[
  ".vehicle-360-center--executive-density",
  ".vehicle-360-center--executive-density .vehicle-360-hero",
  ".vehicle-360-center--executive-density .vehicle-360-hero__image",
  ".vehicle-360-center--executive-density .vehicle-executive-scoreboard",
  ".vehicle-360-center--executive-density .vehicle-score-card",
  ".vehicle-360-center--executive-density .vehicle-action-intelligence--compact",
  ".vehicle-360-center--executive-density .executive-kpi-grid--compact",
].forEach((sel) => assert(css.includes(sel), `density CSS missing ${sel}`));

assert(
  css.includes("minmax(190px, 240px) minmax(260px, 0.8fr) minmax(420px, 1.4fr)"),
  "command-center density hero grid"
);
assert(css.includes("max-width: 240px"), "hero image max-width reduced");
assert(css.includes("max-height: 135px"), "hero image max-height reduced");
assert(css.includes("min-height: 170px"), "hero media min-height reduced");

const scoreboardDensity = css.slice(
  css.indexOf(".vehicle-360-center--executive-density .vehicle-score-card"),
  css.indexOf(".vehicle-360-center--executive-density .vehicle-action-intelligence--compact")
);
assert(scoreboardDensity.includes("min-height: 86px"), "scoreboard card target height");

const actionDensity = css.slice(
  css.indexOf(".vehicle-360-center--executive-density .vehicle-action-intelligence--compact"),
  css.indexOf(".vehicle-360-center--executive-density .vehicle-360-kpi-section")
);
assert(actionDensity.includes("min-height: 80px"), "action card target height");

const kpiDensity = css.slice(
  css.indexOf(".vehicle-360-center--executive-density .executive-kpi-grid--compact"),
  css.indexOf(".vehicle-360-decision-strip")
);
assert(kpiDensity.includes("min-height: 58px"), "KPI card density height");

assert(!vehicleDetailRoute.includes("STB-6A"), "no route changes for STB-6A");
assert(!dbSchema.includes("STB-6A"), "no schema changes for STB-6A");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb6a-",
  "test-stb6a-executive-density-upgrade.js"
);

const { vehicle360PageHtml, buildVehicleCommandMetrics } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6A", "Mercedes", "Vito", "2021", "Turizm", 125000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const metrics = buildVehicleCommandMetrics(bundle, []);
assert(metrics.income.label === "Gelir", "income metric compact label");
assert(metrics.expense.label === "Gider", "expense metric compact label");
assert(metrics.health.label === "Sağlık", "health metric compact label");
assert(metrics.maintenance.label === "Bakım", "maintenance metric compact label");

const html = vehicle360PageHtml(bundle);
assert(html.includes("vehicle-360-center--executive-density"), "density class renders");
assert(html.includes("vehicle-360-hero--command-center"), "command center hero preserved");
assert(html.includes("vehicle-executive-scoreboard"), "scoreboard renders");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "five scoreboard cards");
[
  "Araç Sağlığı",
  "Kritik Risk",
  "Açık Görev",
  "Aylık Kârlılık",
  "Filo Sıralaması",
].forEach((label) => assert(html.includes(label), `scoreboard label: ${label}`));

assert(html.includes("vehicle-action-intelligence--compact"), "compact action intelligence");
assert(html.includes("executive-kpi-grid--compact"), "compact KPI row");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");
assert(html.includes("Gelir"), "hero gelir label");
assert(html.includes("Sağlık"), "hero sağlık label");

assert(!html.match(/<section class="vehicle-focus-strip"/), "old focus strip not visible");
assert(!html.match(/<section class="vehicle-360-decision-strip"/), "old decision strip not visible");

assert(
  html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence"),
  "scoreboard before action intelligence"
);
assert(
  html.indexOf("vehicle-action-intelligence") < html.indexOf("executive-kpi-grid--compact"),
  "action before KPI"
);

const summaries = getAllVehicleSummaries();
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet list link");
assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles route preserved");

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
  const detail = await request(`/vehicle/${ins.lastInsertRowid}`);
  assert(detail.status === 200, "vehicle detail route");
  assert(detail.body.includes("vehicle-360-center--executive-density"), "route density class");
  assert(detail.body.includes("vehicle-executive-scoreboard"), "route scoreboard");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-360-center--executive-density"), `/vehicle/${id} density`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} scoreboard`);
    assert(!legacy.body.match(/<section class="vehicle-focus-strip"/), `/vehicle/${id} no focus strip`);
  }

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6A executive density upgrade tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
