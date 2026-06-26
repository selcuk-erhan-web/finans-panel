/**
 * FLEETOS STB-6D — Fleet Comparison Intelligence
 * node scripts/test-stb6d-fleet-comparison-intelligence.js
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
const engineSrc = fs.readFileSync(path.join(root, "lib/intelligence/fleetComparisonIntelligence.js"), "utf8");
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleDetailRoute = fs.readFileSync(path.join(root, "routes/vehicle-detail.js"), "utf8");

const STB6F = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6F, `layout version: ${LAYOUT_VERSION}`);

assert(engineSrc.includes("buildFleetComparisonIntelligence"), "comparison engine");
assert(engineSrc.includes("buildFleetComparisonFleet"), "fleet snapshot builder");
assert(!engineSrc.match(/fetch\(|openai|anthropic|llm|gpt/i), "no AI/API calls");
assert(centerSrc.includes("vehicle360FleetComparisonHtml"), "comparison panel wired");
assert(centerSrc.includes("buildFleetComparisonFleet"), "fleet snapshot wired in vehicle360");

[
  ".fleet-comparison",
  ".fleet-comparison-card",
  ".fleet-comparison-summary",
  ".fleet-comparison-bars",
  ".fleet-comparison-badge",
  ".fleet-comparison-rank",
  ".fleet-bar",
  ".fleet-bar--vehicle",
  ".fleet-bar--fleet",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

const headerBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360HeaderHtml"),
  centerSrc.indexOf("function vehicle360SummaryHtml")
);
assert(!headerBlock.includes("vehicle360FleetComparisonHtml"), "full comparison not in header");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb6d-",
  "test-stb6d-fleet-comparison-intelligence.js"
);

const {
  buildFleetComparisonIntelligence,
  buildFleetComparisonFleet,
  rankByMetric,
} = require("../lib/intelligence/fleetComparisonIntelligence");
const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const fleetSample = [
  { vehicleId: 1, healthScore: 90, maintenanceScore: 85, profitability: 50000, complianceRisk: 0, totalCost: 10000 },
  { vehicleId: 2, healthScore: 60, maintenanceScore: 55, profitability: -20000, complianceRisk: 2, totalCost: 40000 },
  { vehicleId: 3, healthScore: 75, maintenanceScore: 70, profitability: 10000, complianceRisk: 1, totalCost: 25000 },
];

assert(rankByMetric(fleetSample, 1, (row) => row.healthScore, true) === 1, "health rank best");
assert(rankByMetric(fleetSample, 2, (row) => row.profitability, true) === 3, "profitability rank worst");
assert(rankByMetric(fleetSample, 2, (row) => row.complianceRisk, false) === 3, "compliance rank worst");

const bundle = {
  vehicle: { id: 2 },
  profit: { income: 0, totalExpense: 40000, netProfit: -20000 },
  summary: { net: -20000 },
  monthly: { incomeData: [0], expenseData: [40000] },
  hasFinancialData: true,
};
const comparison = buildFleetComparisonIntelligence(bundle, fleetSample);
assert(comparison.overallRank != null, "overall rank");
assert(comparison.healthRank === 3, "current vehicle health rank");
assert(comparison.fleetSize === 3, "fleet size");
assert(comparison.summary, "summary sentence");
assert(comparison.recommendation, "recommendation");
assert(Array.isArray(comparison.badges), "badges array");
assert(comparison.bars.health, "health bars");
assert(comparison.bars.profitability, "profitability bars");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6D", "Mercedes", "Vito", "2021", "Turizm", 128000);
const liveBundle = getVehicleCenterBundle(ins.lastInsertRowid);
const fleetRows = buildFleetComparisonFleet();
assert(fleetRows.length >= 1, "fleet rows from records");
const html = vehicle360PageHtml(liveBundle);

assert(html.includes('aria-label="Fleet Comparison Intelligence"'), "comparison panel renders");
assert(html.includes("fleet-comparison-summary"), "summary renders");
assert(html.includes("fleet-comparison-bars"), "comparison bars render");
assert(html.includes("fleet-comparison-badge"), "badges render");
assert(html.includes("fleet-comparison-rank"), "rank cards render");
assert((html.match(/fleet-comparison-card/g) || []).length >= 6, "six comparison cards");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "scoreboard preserved");
assert(html.includes("vehicle-action-intelligence--ticker"), "action ticker preserved");
assert(html.includes("executive-kpi-grid--grouped"), "KPI row preserved");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");

assert(html.includes("fleet-comparison-ribbon"), "comparison ribbon renders");
assert(html.includes('aria-label="Fleet Comparison Intelligence"'), "full comparison in page");
assert(
  html.indexOf("executive-kpi-grid--grouped") < html.indexOf("vehicle-intelligence-ribbons"),
  "ribbons after KPI"
);
assert(
  html.indexOf('aria-label="Fleet Comparison Intelligence"') > html.indexOf("vehicle-detail-accordions"),
  "full comparison inside accordions"
);

assert(!vehicleDetailRoute.includes("STB-6D"), "no route changes");
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
  assert(detail.body.includes('aria-label="Fleet Comparison Intelligence"'), "route comparison panel");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes('aria-label="Fleet Comparison Intelligence"'), `/vehicle/${id} comparison`);
  }

  execSync("node -c lib/intelligence/fleetComparisonIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6D fleet comparison intelligence tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
