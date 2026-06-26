/**
 * FLEETOS STB-6B — Executive Visual Hierarchy
 * node scripts/test-stb6b-executive-visual-hierarchy.js
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

const STB6E = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6E, `layout version: ${LAYOUT_VERSION}`);

assert(centerSrc.includes("vehicle-360-center--visual-hierarchy"), "visual hierarchy modifier on page");
assert(centerSrc.includes("vehicle-score-card--primary"), "primary scoreboard card class");
assert(centerSrc.includes("scoreboardIndicatorHtml"), "scoreboard indicator helper");
assert(centerSrc.includes("vehicle-score-indicator"), "scoreboard indicator markup");
assert(centerSrc.includes("vehicle-action-card__priority"), "action priority badge");

[
  ".vehicle-score-card--primary",
  ".vehicle-score-indicator",
  ".vehicle-score-indicator__bar",
  ".vehicle-score-indicator--success",
  ".vehicle-score-indicator--info",
  ".vehicle-score-indicator--warning",
  ".vehicle-score-indicator--danger",
  ".vehicle-score-indicator--neutral",
  ".vehicle-action-card__priority",
  ".vehicle-360-center--visual-hierarchy .vehicle-360-hero__image-stage",
  ".vehicle-360-center--visual-hierarchy .vehicle-action-card::before",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(
  css.includes("grid-template-columns: 1.35fr 1fr 1fr 1fr 0.9fr"),
  "scoreboard hierarchy grid"
);
assert(css.includes("repeating-linear-gradient"), "hero blueprint grid background");
assert(css.includes("drop-shadow"), "hero image drop shadow polish");

const commandMetricsBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360CommandMetricsHtml"),
  centerSrc.indexOf("function vehicle360ExecutiveHeroHtml")
);
assert(commandMetricsBlock.includes("metrics.income, metrics.expense, metrics.health, metrics.maintenance"), "hero metrics limited to 4");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb6b-",
  "test-stb6b-executive-visual-hierarchy.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6B", "Mercedes", "Vito", "2021", "Turizm", 126000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes("vehicle-360-center--visual-hierarchy"), "visual hierarchy class renders");
assert(html.includes("vehicle-score-card--primary"), "primary health card renders");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "five scoreboard cards");
assert(html.includes("vehicle-score-indicator"), "score indicators render");
assert(html.includes("vehicle-score-indicator__bar"), "health/task/profit bars render");
assert(html.includes("vehicle-score-indicator__segments") || html.includes("vehicle-score-indicator__dot"), "risk indicator renders");
assert(html.includes("vehicle-score-indicator__chip"), "fleet rank chip renders");
assert(
  html.includes("vehicle-action-ticker-item__badge") || html.includes("vehicle-action-card__priority"),
  "action priority badges render"
);
assert(
  html.includes("vehicle-action-intelligence--ticker") || html.includes("vehicle-action-intelligence--compact"),
  "action intelligence lane"
);
assert(html.includes("executive-kpi-grid--compact"), "compact KPI row");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");

[
  "Araç Sağlığı",
  "Kritik Risk",
  "Açık Görev",
  "Aylık Kârlılık",
  "Filo Sıralaması",
].forEach((label) => assert(html.includes(label), `scoreboard label: ${label}`));

assert(!vehicleDetailRoute.includes("STB-6B"), "no route changes");
assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles route preserved");

const summaries = getAllVehicleSummaries();
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet list link");

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
  assert(detail.body.includes("vehicle-score-card--primary"), "route primary card");
  assert(
    detail.body.includes("vehicle-action-ticker-item__badge") ||
      detail.body.includes("vehicle-action-card__priority"),
    "route priority badges"
  );

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} scoreboard`);
    assert(legacy.body.includes("vehicle-360-center--visual-hierarchy"), `/vehicle/${id} hierarchy`);
  }

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6B executive visual hierarchy tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
