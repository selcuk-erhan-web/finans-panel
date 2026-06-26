/**
 * FLEETOS STB-4E — Executive dashboard simplification
 * node scripts/test-stb4e-executive-dashboard-simplification.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  buildDashboardCommandBarContext,
  buildFleetHealthCenterContext,
  executiveCommandCenter,
  fleetHealthCenterHtml,
  executiveRiskRadarHtml,
  executiveInsightsHtml,
  buildExecutiveRiskRadarContext,
  buildExecutiveInsightsContext,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4e-executive-dashboard-simplification-01", `layout version: ${LAYOUT_VERSION}`);

assert(dashboard.includes("executiveCommandCenter"), "command center on dashboard");
assert(dashboard.includes("executiveFinancialPanel"), "KPI row on dashboard");
assert(dashboard.includes("fleetHealthCenterHtml"), "fleet health center on dashboard");
assert(dashboard.includes("miniFinanceTrendsPanel"), "mini financial trend on dashboard");
assert(dashboard.includes("financialMovementsPanel"), "operations table on dashboard");
assert(!dashboard.includes("dashboard-insights-trend-row"), "insights/trend row removed");

const headerIdx = dashboard.indexOf("commandHeader(");
const centerIdx = dashboard.indexOf("executiveCommandCenter(");
const kpiIdx = dashboard.indexOf("executiveFinancialPanel(");
const healthIdx = dashboard.indexOf("fleetHealthCenterHtml(");
const trendIdx = dashboard.indexOf("miniFinanceTrendsPanel()");
const tableIdx = dashboard.indexOf("financialMovementsPanel(");

const legacyIdx = dashboard.indexOf("dashboard-legacy-widgets");
assert(legacyIdx > -1, "legacy widgets container exists");
const radarInLegacy = dashboard.indexOf("executiveRiskRadarHtml(riskRadarContext)") > legacyIdx;
const insightsInLegacy = dashboard.indexOf("executiveInsightsHtml(insightsContext)") > legacyIdx;
assert(radarInLegacy, "risk radar moved to legacy container");
assert(insightsInLegacy, "executive insights moved to legacy container");
const betweenKpiAndHealth = dashboard.slice(kpiIdx, healthIdx);
assert(!betweenKpiAndHealth.includes("executiveRiskRadarHtml"), "risk radar not visible between KPI and health");
assert(!betweenKpiAndHealth.includes("executiveInsightsHtml"), "insights not visible between KPI and health");
assert(
  dashboard.indexOf("fleetHealthCenterHtml(fleetHealthContext)}") <
    dashboard.indexOf("miniFinanceTrendsPanel()"),
  "fleet health before mini trend"
);

assert(centerIdx > headerIdx, "command center after header");
assert(kpiIdx > centerIdx, "KPI after command center");
assert(healthIdx > kpiIdx, "fleet health after KPI");
assert(trendIdx > healthIdx, "mini trend after fleet health");
assert(tableIdx > trendIdx, "operations after mini trend");

assert(css.includes(".dashboard-legacy-widgets"), "legacy widgets hidden via css");
assert(css.includes("height: 140px"), "mini trend chart at 140px");
assert(css.includes(".executive-command-center__brief"), "command center brief style");
assert(css.includes(".fleet-health-center__recommendation-list"), "fleet health recommendation bullets");

const cmdCtx = buildDashboardCommandBarContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 3,
  profit: { summary: { totalNet: -1000 }, leastProfitable: { plate: "34ABC123", netProfit: -5000 } },
  corporateAlerts: { critical: 2 },
});
const cmdHtml = executiveCommandCenter(cmdCtx);
assert(cmdHtml.includes("executive-command-center__brief"), "command center uses brief line");
assert(!cmdHtml.includes("Yönetici Önerisi"), "detailed recommendation title removed from command center");

const healthCtx = buildFleetHealthCenterContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 3,
  profit: { summary: { totalNet: -1000 }, leastProfitable: { plate: "34ABC123", netProfit: -5000 } },
  corporateAlerts: { critical: 2 },
});
const healthHtml = fleetHealthCenterHtml(healthCtx);
assert(healthHtml.includes("Genel Filo Sağlık Skoru"), "health score");
assert(healthHtml.includes("Kritik Araç"), "risk distribution");
assert(healthHtml.includes("Uygunluk Riski"), "compliance risk");
assert(healthHtml.includes("Bakım Riski"), "maintenance risk");
assert(healthHtml.includes("Lastik Riski"), "tire risk");
assert(healthHtml.includes("En Riskli 3 Araç"), "top 3 vehicles");
assert(healthHtml.includes("fleet-health-center__recommendation"), "executive recommendation in fleet health");
assert(healthHtml.includes("fleet-health-center__recommendation-list"), "recommendation bullet list");

const radarHtml = executiveRiskRadarHtml(buildExecutiveRiskRadarContext({ vehicleCount: 1 }));
const insightsPanel = executiveInsightsHtml(buildExecutiveInsightsContext({ profit: { hasData: false } }));
assert(radarHtml.includes("executive-risk-radar"), "risk radar helper still renders");
assert(insightsPanel.includes("executive-insights-panel"), "insights helper still renders");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4E executive dashboard simplification tests passed");
