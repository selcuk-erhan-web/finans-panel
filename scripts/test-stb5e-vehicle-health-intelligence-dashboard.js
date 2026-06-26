/**
 * FLEETOS STB-5E — Vehicle Health Intelligence Dashboard
 * node scripts/test-stb5e-vehicle-health-intelligence-dashboard.js
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
  path.join(root, "lib/intelligence/vehicleHealthIntelligence.js"),
  "utf8"
);
const centerSrc = fs.readFileSync(path.join(root, "lib/components/vehicle360Center.js"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb6a-executive-density-upgrade-01",
  `layout version: ${LAYOUT_VERSION}`
);

[
  ".vehicle-health-dashboard",
  ".vehicle-health-dashboard__head",
  ".vehicle-health-grid",
  ".vehicle-health-score-card",
  ".vehicle-health-risk-radar",
  ".vehicle-health-alarm-center",
  ".vehicle-health-activity-stream",
  ".vehicle-health-classification",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(engineSrc.includes("buildVehicleHealthIntelligence"), "engine export");
assert(!engineSrc.match(/fetch\(|openai|anthropic|llm|gpt/i), "no AI/API calls");
assert(centerSrc.includes("vehicle360HealthDashboardHtml"), "dashboard wired");
assert(centerSrc.includes("Health Score"), "health score card");
assert(centerSrc.includes("Risk Radar"), "risk radar");
assert(centerSrc.includes("Executive Alarm Center"), "alarm center");
assert(centerSrc.includes("Recent Activity Stream"), "activity stream");
assert(centerSrc.includes("Vehicle Classification"), "classification");

const { buildVehicleHealthIntelligence } = require("../lib/intelligence/vehicleHealthIntelligence");

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
  alerts: [],
  health: null,
};
const intel = buildVehicleHealthIntelligence(emptyBundle, []);
assert(intel.healthScore.score >= 0 && intel.healthScore.score <= 100, "score range");
assert(Array.isArray(intel.riskRadar.domains), "risk radar domains");
assert(Array.isArray(intel.alarms), "alarms array");
assert(Array.isArray(intel.activity), "activity array");
assert(intel.classification.label, "classification label");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5e-",
  "test-stb5e-vehicle-health-intelligence-dashboard.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5E", "Mercedes", "Vito", "2021", "Turizm", 95000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes("vehicle-health-dashboard"), "dashboard section");
assert(html.includes("vehicle-health-score-card"), "score card renders");
assert(html.includes("vehicle-health-risk-radar"), "risk radar renders");
assert(html.includes("vehicle-health-alarm-center"), "alarm center renders");
assert(html.includes("vehicle-health-activity-stream"), "activity stream renders");
assert(html.includes("vehicle-health-classification"), "classification renders");
assert(html.includes("vehicle-action-intelligence"), "STB-5D panel preserved");
assert(html.includes("Araç Sağlığı"), "hero health metric preserved");
assert(html.includes("vehicle-detail-accordions"), "health dashboard in accordions");

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
  assert(detail.body.includes("vehicle-health-dashboard"), "route health dashboard");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-health-dashboard"), `/vehicle/${id} dashboard`);
  }

  const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
  assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles list route preserved");

  execSync("node -c lib/intelligence/vehicleHealthIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5E vehicle health intelligence dashboard tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
