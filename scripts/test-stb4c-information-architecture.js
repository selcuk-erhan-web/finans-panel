/**
 * FLEETOS STB-4C — Information architecture simplification
 * node scripts/test-stb4c-information-architecture.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  buildDashboardCommandBarContext,
  buildExecutiveRiskRadarContext,
  buildExecutiveInsightsContext,
  executiveCommandCenter,
  executiveRiskRadarHtml,
  executiveInsightsHtml,
  fleetHealthCenterHtml,
  buildFleetHealthCenterContext,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");
const intel = fs.readFileSync(path.join(root, "lib/components/executiveIntelligence.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const iaCss = [
  ".executive-risk-radar",
  ".executive-risk-radar__priority-list",
  ".executive-risk-radar__priority-item",
  ".executive-risk-radar__decision",
  ".executive-insights-panel",
  ".executive-insights-panel__metric",
  ".dashboard-analytics-layer",
  ".dashboard-insights-trend-row",
  ".dashboard-legacy-widgets",
  ".mini-financial-trend",
];

iaCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

assert(intel.includes("function buildExecutiveRiskRadarContext"), "risk radar context builder");
assert(intel.includes("function executiveRiskRadarHtml"), "risk radar html");
assert(intel.includes("function buildExecutiveInsightsContext"), "insights context builder");
assert(intel.includes("function executiveInsightsHtml"), "insights html");
assert(intel.includes("Toplam Aktif Risk"), "command center total active risk metric");
assert(intel.includes("executive-risk-radar--compact"), "compact risk radar class");
assert(!intel.includes("executive-command-center__metric--profit"), "net profit removed from command center");

assert(dashboard.includes("executiveRiskRadarHtml"), "dashboard renders risk radar");
assert(dashboard.includes("executiveInsightsHtml"), "dashboard renders executive insights");
assert(dashboard.includes("dashboard-analytics-layer"), "dashboard analytics layer");
assert(dashboard.includes("dashboard-legacy-widgets"), "legacy widgets preserved for hooks");
assert(dashboard.includes("vehicleHealthDashboardWidgetHtml()"), "health widget hook preserved");
assert(dashboard.includes("vehicleProfitRiskDashboardWidgetHtml()"), "profit risk widget hook preserved");
assert(dashboard.includes("executiveVehicleDashboardWidgetHtml()"), "executive vehicle widget hook preserved");
assert(dashboard.includes("cmd-vi-widget-stack"), "vi widget stack preserved");
assert(dashboard.includes("executiveFinancialPanel"), "KPI cards preserved");
assert(dashboard.includes("miniFinanceTrendsPanel"), "mini financial trend preserved");
assert(dashboard.includes("monthlyChart"), "chart preserved");
assert(dashboard.includes("financialMovementsPanel"), "movements table preserved");
assert(!dashboard.includes("financeTrendsPanel()"), "full trend panel not on dashboard");

const headerIdx = dashboard.indexOf("commandHeader(");
const centerIdx = dashboard.indexOf("executiveCommandCenter(");
const kpiIdx = dashboard.indexOf("executiveFinancialPanel(");
const radarIdx = dashboard.indexOf("executiveRiskRadarHtml(");
const healthIdx = dashboard.indexOf("fleetHealthCenterHtml(");
const insightsIdx = dashboard.indexOf("executiveInsightsHtml(");
const trendIdx = dashboard.indexOf("miniFinanceTrendsPanel()");
const tableIdx = dashboard.indexOf("financialMovementsPanel(");

assert(centerIdx > headerIdx, "command center after header");
assert(kpiIdx > centerIdx, "KPI after command center");
assert(radarIdx > kpiIdx, "risk radar after KPI");
assert(healthIdx > radarIdx, "fleet health after risk radar");
assert(insightsIdx > healthIdx, "executive insights after fleet health");
assert(trendIdx > insightsIdx, "mini trend after executive insights");
assert(tableIdx > trendIdx, "movements after insights row");

const cmdCtx = buildDashboardCommandBarContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 3,
  profit: { summary: { totalNet: -1000 }, leastProfitable: { plate: "34ABC123", netProfit: -5000 } },
  corporateAlerts: { critical: 1 },
});

const cmdHtml = executiveCommandCenter(cmdCtx);
assert(cmdHtml.includes("executive-command-center"), "command center html");
assert(cmdHtml.includes("Filo Durumu"), "fleet status");
assert(cmdHtml.includes("Kritik Araç"), "critical vehicle metric");
assert(cmdHtml.includes("Toplam Aktif Risk"), "total active risk metric");
assert(cmdHtml.includes("Yönetici Önerisi"), "recommendation in command center");
assert(cmdHtml.includes("executive-command-center__action-btn"), "primary CTA");
assert(!cmdHtml.includes("Uygunluk Riski"), "per-domain risk removed from command center");
assert(!cmdHtml.includes("Net Kâr"), "net profit removed from command center");

const radarCtx = buildExecutiveRiskRadarContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 3,
  profit: { leastProfitable: { plate: "34ABC123", netProfit: -5000 } },
  corporateAlerts: { critical: 1 },
});
const radarHtml = executiveRiskRadarHtml(radarCtx);
assert(radarHtml.includes("executive-risk-radar"), "risk radar section");
assert(radarHtml.includes("executive-risk-radar__priority-list"), "priority list");
assert(radarHtml.includes("Risk Skoru:"), "risk score label");
assert(radarHtml.includes("Yönetici Kararı"), "executive decision");

const healthCtx = buildFleetHealthCenterContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 0,
  profit: { summary: { totalNet: 0 } },
  corporateAlerts: { critical: 0 },
});
const healthHtml = fleetHealthCenterHtml(healthCtx);
assert(healthHtml.includes("Genel Filo Sağlık Skoru"), "health score");
assert(healthHtml.includes("En Riskli 3 Araç"), "top 3 vehicles");
assert(!healthHtml.includes("fleet-health-center__recommendation"), "recommendation removed from health center");

const insightsCtx = buildExecutiveInsightsContext({
  profit: { hasData: false },
  vehicleCount: 0,
});
const insightsPanel = executiveInsightsHtml(insightsCtx);
assert(insightsPanel.includes("executive-insights-panel"), "insights panel");
assert(insightsPanel.includes("En Kârlı Araç"), "most profitable label");
assert(insightsPanel.includes("En Riskli Araç"), "highest risk label");
assert(insightsPanel.includes("En Masraflı Araç"), "highest cost label");
assert(insightsPanel.includes("Acil Müdahale Gereken Araç"), "immediate attention label");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4C information architecture tests passed");
