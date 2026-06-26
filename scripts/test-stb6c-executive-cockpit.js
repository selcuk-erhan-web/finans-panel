/**
 * FLEETOS STB-6C — Executive Cockpit
 * node scripts/test-stb6c-executive-cockpit.js
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
const cockpitSrc = fs.readFileSync(path.join(root, "lib/intelligence/vehicleExecutiveCockpit.js"), "utf8");
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleDetailRoute = fs.readFileSync(path.join(root, "routes/vehicle-detail.js"), "utf8");

const STB6F = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6F, `layout version: ${LAYOUT_VERSION}`);

assert(cockpitSrc.includes("buildVehicleExecutiveCockpit"), "cockpit engine exists");
assert(!cockpitSrc.match(/fetch\(|openai|anthropic|llm|gpt/i), "no AI/API calls in cockpit");
assert(centerSrc.includes("vehicle360ExecutiveCockpitHtml"), "cockpit html helper");
assert(centerSrc.includes("vehicle-360-center--cockpit"), "cockpit page modifier");
assert(centerSrc.includes("vehicle-action-intelligence--ticker"), "action ticker modifier");

[
  ".vehicle-executive-cockpit",
  ".vehicle-executive-cockpit__state",
  ".vehicle-executive-cockpit__score",
  ".vehicle-executive-cockpit__priority",
  ".vehicle-executive-cockpit__risk",
  ".vehicle-executive-cockpit__financial",
  ".vehicle-executive-cockpit--success",
  ".vehicle-executive-cockpit--danger",
  ".vehicle-action-intelligence--ticker",
  ".vehicle-action-ticker-item",
  ".vehicle-action-ticker-item__badge",
  ".executive-kpi-grid--grouped",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

const headerBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360HeaderHtml"),
  centerSrc.indexOf("function vehicle360SummaryHtml")
);
const heroIdx = headerBlock.indexOf("vehicle360ExecutiveHeroHtml");
const cockpitIdx = headerBlock.indexOf("vehicle360ExecutiveCockpitHtml");
const scoreboardIdx = headerBlock.indexOf("vehicle360ExecutiveScoreboardHtml");
assert(heroIdx > -1 && cockpitIdx > heroIdx, "cockpit below hero");
assert(cockpitIdx > -1 && scoreboardIdx > cockpitIdx, "cockpit above scoreboard");

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-stb6c-", "test-stb6c-executive-cockpit.js");

const { buildVehicleExecutiveCockpit } = require("../lib/intelligence/vehicleExecutiveCockpit");
const { buildVehicleActionIntelligence } = require("../lib/intelligence/vehicleActionIntelligence");
const { buildVehicleHealthIntelligence } = require("../lib/intelligence/vehicleHealthIntelligence");
const { buildPredictiveMaintenanceIntelligence } = require("../lib/intelligence/predictiveMaintenanceIntelligence");
const { buildVehicleExecutiveScoreboard } = require("../lib/intelligence/vehicleExecutiveScoreboard");
const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6C", "Mercedes", "Vito", "2021", "Turizm", 127000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const complianceDocs = [];
const actionIntel = buildVehicleActionIntelligence(bundle, complianceDocs);
const healthIntel = buildVehicleHealthIntelligence(bundle, complianceDocs);
const maintIntel = buildPredictiveMaintenanceIntelligence(bundle);
const scoreboard = buildVehicleExecutiveScoreboard(
  bundle,
  actionIntel,
  healthIntel,
  maintIntel,
  complianceDocs
);
const cockpit = buildVehicleExecutiveCockpit(
  bundle,
  actionIntel,
  healthIntel,
  maintIntel,
  scoreboard,
  complianceDocs
);

assert(["KRİTİK", "DİKKAT", "İYİ", "MÜKEMMEL"].includes(cockpit.stateLabel), "cockpit state label");
assert(cockpit.score >= 0 && cockpit.score <= 100, "cockpit score range");
assert(cockpit.todayPriority, "cockpit today priority");
assert(cockpit.primaryRisk, "cockpit primary risk");
assert(cockpit.financialImpact, "cockpit financial impact");
assert(cockpit.readiness, "cockpit readiness");

const html = vehicle360PageHtml(bundle);
assert(html.includes("vehicle-executive-cockpit"), "cockpit renders");
assert(html.includes("vehicle-executive-cockpit__state-label"), "cockpit state zone");
assert(html.includes("vehicle-executive-cockpit__priority-text"), "cockpit priority zone");
assert(html.includes("vehicle-executive-cockpit__risk-value"), "cockpit risk zone");
assert(html.includes("vehicle-executive-cockpit__financial-value"), "cockpit financial zone");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "five scoreboard cards");
assert(html.includes("vehicle-action-intelligence--ticker"), "action ticker renders");
assert((html.match(/vehicle-action-ticker-item/g) || []).length >= 4, "four ticker items");
assert(html.includes("executive-kpi-grid--grouped"), "grouped KPI row");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");

assert(
  html.indexOf("vehicle-executive-cockpit") < html.indexOf("vehicle-executive-scoreboard"),
  "cockpit before scoreboard"
);
assert(
  html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence--ticker"),
  "scoreboard before action ticker"
);
assert(
  html.indexOf("executive-kpi-grid--grouped") < html.indexOf("vehicle-intelligence-ribbons"),
  "ribbons after KPI"
);
assert(
  html.indexOf("vehicle-action-intelligence--ticker") < html.indexOf("executive-kpi-grid--grouped"),
  "action ticker before KPI"
);

assert(!vehicleDetailRoute.includes("STB-6C"), "no route changes");
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
  assert(detail.body.includes("vehicle-executive-cockpit"), "route cockpit");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-executive-cockpit"), `/vehicle/${id} cockpit`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} scoreboard`);
  }

  execSync("node -c lib/intelligence/vehicleExecutiveCockpit.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6C executive cockpit tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
