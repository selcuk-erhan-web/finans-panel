/**
 * FLEETOS STB-4A — Fleet Health Center
 * node scripts/test-stb4a-fleet-health-center.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  buildFleetHealthCenterContext,
  fleetHealthCenterHtml,
  executiveCommandCenter,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const healthCss = [
  ".fleet-health-center",
  ".fleet-health-center__score",
  ".fleet-health-center__metrics",
  ".fleet-health-center__metric",
  ".fleet-health-center__risk-list",
  ".fleet-health-center__risk-item",
  ".fleet-health-center__recommendation",
  ".dashboard-insights-trend-row",
  ".mini-financial-trend",
  ".mini-financial-trend .chart-wrap--command.trend-chart",
];

healthCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

assert(dashboard.includes("fleetHealthCenterHtml"), "dashboard renders fleet health center");
assert(dashboard.includes("miniFinanceTrendsPanel"), "dashboard uses mini financial trend");
assert(dashboard.includes("buildFleetHealthCenterContext"), "dashboard builds health context");
assert(!dashboard.includes("financeTrendsPanel()"), "full trend panel removed from dashboard");

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
assert(trendIdx > insightsIdx, "mini trend after insights");
assert(tableIdx > trendIdx, "movements after health/trend row");
assert(dashboard.includes("executiveFinancialPanel"), "KPI cards preserved");
assert(dashboard.includes("monthlyChart"), "chart preserved");
assert(dashboard.includes("vehicleHealthDashboardWidgetHtml()"), "health widget hook preserved for tests");

const ctx = buildFleetHealthCenterContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 0,
  profit: { summary: { totalNet: 0 } },
  corporateAlerts: { critical: 0 },
});
const html = fleetHealthCenterHtml(ctx);
assert(html.includes("fleet-health-center"), "fleet health center html");
assert(html.includes("Genel Filo Sağlık Skoru"), "health score label");
assert(html.includes("Kritik Araç"), "critical vehicles metric");
assert(html.includes("Uygunluk Riski"), "compliance risk metric");
assert(html.includes("Bakım Riski"), "maintenance risk metric");
assert(html.includes("Lastik Riski"), "tire risk metric");
assert(html.includes("En Riskli 3 Araç"), "top risk vehicles");
assert(!html.includes("fleet-health-center__recommendation"), "recommendation removed from health center");

const cmdHtml = executiveCommandCenter({
  fleetStatus: { label: "Stabil", tone: "success", centerTone: "stable" },
  criticalVehicles: 0,
  totalActiveRiskCount: 0,
  primaryRecommendation: "Test",
  primaryCta: { label: "İzlemeye Devam Et", href: "/" },
  hasData: true,
});
assert(cmdHtml.includes("executive-command-center"), "command center still present");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4A fleet health center tests passed");
