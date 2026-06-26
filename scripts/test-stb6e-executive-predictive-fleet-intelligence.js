/**
 * FLEETOS STB-6E — Executive Predictive Fleet Intelligence
 * node scripts/test-stb6e-executive-predictive-fleet-intelligence.js
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
const engineSrc = fs.readFileSync(
  path.join(root, "lib/intelligence/executivePredictiveFleetIntelligence.js"),
  "utf8"
);
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleDetailRoute = fs.readFileSync(path.join(root, "routes/vehicle-detail.js"), "utf8");

const STB6F = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6F, `layout version: ${LAYOUT_VERSION}`);

assert(engineSrc.includes("buildExecutivePredictiveFleetIntelligence"), "predictive engine");
assert(!engineSrc.match(/fetch\(|openai|anthropic|llm|gpt|machine learning|ml\./i), "no AI/API calls");
assert(centerSrc.includes("vehicle360ExecutivePredictiveHtml"), "predictive panel wired");

[
  ".executive-predictive",
  ".executive-predictive-card",
  ".executive-predictive-timeline",
  ".executive-predictive-risk",
  ".executive-predictive-summary",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

const headerBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360HeaderHtml"),
  centerSrc.indexOf("function vehicle360SummaryHtml")
);
assert(!headerBlock.includes("vehicle360ExecutivePredictiveHtml"), "full predictive not in header");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb6e-",
  "test-stb6e-executive-predictive-fleet-intelligence.js"
);

const {
  buildExecutivePredictiveFleetIntelligence,
  buildMaintenanceForecast,
  buildComplianceForecast,
  buildFinancialForecast,
  buildOperationalForecast,
  collectPredictedEvents,
} = require("../lib/intelligence/executivePredictiveFleetIntelligence");
const { buildPredictiveMaintenanceIntelligence } = require("../lib/intelligence/predictiveMaintenanceIntelligence");
const { buildVehicleActionIntelligence } = require("../lib/intelligence/vehicleActionIntelligence");
const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const sampleBundle = {
  vehicle: { id: 99, plate: "16 STB 6E", km: 120000 },
  profit: { income: 0, totalExpense: 51500, netProfit: -51500, fuel: 30000, maintenance: 5000 },
  summary: { net: -51500 },
  monthly: { incomeData: [0, 0], expenseData: [40000, 51500] },
  hasFinancialData: true,
  maintenanceSchedule: {
    items: [
      {
        maintenance_type_label: "Periyodik Bakım",
        days_remaining: 18,
        status: "upcoming",
        next_due_date: "2026-07-06",
      },
    ],
  },
  upcomingMaintenance: [],
  maintenanceHistory: { records: [{ maintenance_date: "2025-12-01" }] },
  tireStatus: { records: [] },
  tireSeasonalStatus: { alerts: [] },
  timeline: { events: [{ severity: "warning", source: "maintenance" }] },
};
const sampleDocs = [
  {
    document_type: "inspection",
    expiry_date: "2026-07-12",
    status: "warning",
    daysLeft: 24,
    title: "Muayene",
  },
];
const sampleEvents = collectPredictedEvents(sampleBundle, sampleDocs);
assert(sampleEvents.length >= 2, "predicted events collected");

const maintIntel = buildPredictiveMaintenanceIntelligence(sampleBundle);
const actionIntel = buildVehicleActionIntelligence(sampleBundle, sampleDocs);
const maintenanceForecast = buildMaintenanceForecast(sampleBundle, maintIntel, sampleEvents);
const complianceForecast = buildComplianceForecast(sampleDocs, sampleEvents);
const financialForecast = buildFinancialForecast(sampleBundle, []);
const operationalForecast = buildOperationalForecast(sampleBundle, actionIntel, sampleEvents);

assert(maintenanceForecast.text, "maintenance forecast");
assert(complianceForecast.text.includes("Muayene"), "compliance forecast");
assert(financialForecast.text, "financial forecast");
assert(operationalForecast.readiness, "operational readiness");

const predictive = buildExecutivePredictiveFleetIntelligence(sampleBundle, [], sampleDocs);
assert(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(predictive.executiveRiskLevel), "risk level");
assert(Array.isArray(predictive.predictedEvents), "predicted events array");
assert(predictive.executiveForecast, "executive forecast");
assert(predictive.recommendation, "recommendation");
assert(predictive.nextCriticalEvent, "next critical event");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6E", "Mercedes", "Vito", "2021", "Turizm", 129000);
const liveBundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(liveBundle);

assert(html.includes("executive-predictive-ribbon"), "predictive ribbon renders");
assert(html.includes('aria-label="Executive Predictive Intelligence"'), "full predictive in page");
assert(html.includes("executive-predictive-timeline"), "predictive timeline in accordion");
assert(html.includes("executive-predictive-recommendation"), "predictive recommendation in accordion");
assert((html.match(/executive-predictive-card/g) || []).length >= 6, "six predictive cards");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "scoreboard preserved");
assert(html.includes('aria-label="Fleet Comparison Intelligence"'), "fleet comparison preserved");
assert(html.includes("vehicle-action-intelligence--ticker"), "action ticker preserved");
assert(html.includes("executive-kpi-grid--grouped"), "KPI row preserved");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");

assert(
  html.indexOf("executive-kpi-grid--grouped") < html.indexOf("vehicle-intelligence-ribbons"),
  "ribbons after KPI"
);
assert(
  html.indexOf('aria-label="Executive Predictive Intelligence"') > html.indexOf("vehicle-detail-accordions"),
  "full predictive inside accordions"
);

assert(!vehicleDetailRoute.includes("STB-6E"), "no route changes");
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
  assert(detail.body.includes('aria-label="Executive Predictive Intelligence"'), "route predictive panel");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes('aria-label="Executive Predictive Intelligence"'), `/vehicle/${id} predictive`);
  }

  execSync("node -c lib/intelligence/executivePredictiveFleetIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6E executive predictive fleet intelligence tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
