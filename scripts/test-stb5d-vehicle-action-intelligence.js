/**
 * FLEETOS STB-5D — Vehicle Action Intelligence
 * node scripts/test-stb5d-vehicle-action-intelligence.js
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
const engineSrc = fs.readFileSync(
  path.join(root, "lib/intelligence/vehicleActionIntelligence.js"),
  "utf8"
);
const centerSrc = fs.readFileSync(path.join(root, "lib/components/vehicle360Center.js"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb6a-executive-density-upgrade-01",
  `layout version: ${LAYOUT_VERSION}`
);

[
  ".vehicle-action-intelligence",
  ".vehicle-action-intelligence__head",
  ".vehicle-action-grid",
  ".vehicle-action-card",
  ".vehicle-action-card__icon",
  ".vehicle-action-card__title",
  ".vehicle-action-card__body",
  ".vehicle-action-card__meta",
  ".vehicle-action-card--success",
  ".vehicle-action-card--warning",
  ".vehicle-action-card--danger",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(engineSrc.includes("buildVehicleActionIntelligence"), "engine export");
assert(!engineSrc.match(/fetch\(|openai|anthropic|llm|gpt/i), "no AI/API calls");
assert(centerSrc.includes("vehicle360ActionIntelligenceHtml"), "action panel wired");
assert(centerSrc.includes('label: "Sağlık"'), "hero health metric");

const {
  buildVehicleActionIntelligence,
  clampScore,
  scoreToStatus,
} = require("../lib/intelligence/vehicleActionIntelligence");

assert(clampScore(120) === 100, "score clamp max");
assert(clampScore(-5) === 0, "score clamp min");
assert(scoreToStatus(95).status === "Mükemmel", "mükemmel status");
assert(scoreToStatus(80).status === "İyi", "iyi status");
assert(scoreToStatus(60).status === "Dikkat", "dikkat status");
assert(scoreToStatus(30).status === "Kritik", "kritik status");

const emptyBundle = {
  profit: { income: 0, totalExpense: 0, netProfit: 0, fuel: 0 },
  summary: { net: 0 },
  hasFinancialData: false,
  maintenanceHistory: { records: [] },
  tireStatus: { records: [] },
  tireSeasonalStatus: { alerts: [] },
  upcomingMaintenance: [],
  timeline: { events: [] },
  recentTransactions: [],
};
const sparseIntel = buildVehicleActionIntelligence(emptyBundle, []);
assert(sparseIntel.score >= 0 && sparseIntel.score <= 100, "sparse score range");
assert(Array.isArray(sparseIntel.criticalActions), "critical actions array");
assert(sparseIntel.executiveRecommendation, "executive recommendation");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5d-",
  "test-stb5d-vehicle-action-intelligence.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const plates = ["16 LR 005", "16 LA 005"];
plates.forEach((plate) => {
  db.prepare("DELETE FROM vehicles WHERE plate = ?").run(plate);
  const ins = db
    .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
    .run(plate, "Mercedes", "Fleet", "2021", "Turizm", 120000);
  const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
  const html = vehicle360PageHtml(bundle);
  assert(html.includes("vehicle-action-intelligence"), `${plate} action panel`);
  assert(html.includes("vehicle-action-card"), `${plate} action cards`);
  assert(html.includes("Araç Sağlığı"), `${plate} hero health metric`);
  assert(html.includes("executive-kpi-grid"), `${plate} KPI row preserved`);
  assert(
    html.indexOf("vehicle-action-intelligence") < html.indexOf("executive-kpi-grid"),
    `${plate} action panel before KPI`
  );
  assert(html.includes("vehicle-executive-scoreboard"), `${plate} scoreboard`);
});

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
  const vehicle = db.prepare("SELECT id FROM vehicles WHERE plate = ?").get("16 LR 005");
  const detail = await request(`/vehicle/${vehicle.id}`);
  assert(detail.status === 200, "vehicle detail route");
  assert(detail.body.includes("vehicle-action-intelligence"), "route action panel");
  assert(detail.body.includes("vehicle-executive-scoreboard"), "route scoreboard");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-action-intelligence"), `/vehicle/${id} action panel`);
  }

  const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
  assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles list route preserved");

  execSync("node -c lib/intelligence/vehicleActionIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5D vehicle action intelligence tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
