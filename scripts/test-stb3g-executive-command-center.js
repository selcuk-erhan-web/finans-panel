/**
 * FLEETOS STB-3G — Executive command center
 * node scripts/test-stb3g-executive-command-center.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  buildDashboardCommandBarContext,
  executiveCommandCenter,
  derivePrimaryActionCTA,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const centerCss = [
  ".executive-command-center",
  ".executive-command-center__status",
  ".executive-command-center__metrics",
  ".executive-command-center__metric",
  ".executive-command-center__recommendation",
  ".executive-command-center__action",
  ".executive-command-center--danger",
  ".executive-command-center--warning",
  ".executive-command-center--stable",
];

centerCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

assert(css.includes("grid-row: 2") && css.includes(".executive-command-center"), "cockpit grid assigns command center row");

assert(dashboard.includes("executiveCommandCenter"), "dashboard uses executive command center");

const headerIdx = dashboard.indexOf("commandHeader(");
const centerIdx = dashboard.indexOf("executiveCommandCenter(");
const kpiIdx = dashboard.indexOf("executiveFinancialPanel(");
const radarIdx = dashboard.indexOf("executiveRiskRadarHtml(");
const healthIdx = dashboard.indexOf("fleetHealthCenterHtml(");
const insightsIdx = dashboard.indexOf("executiveInsightsHtml(");
const chartIdx = dashboard.indexOf("miniFinanceTrendsPanel()");
const tableIdx = dashboard.indexOf("financialMovementsPanel(");

assert(headerIdx > -1 && centerIdx > headerIdx, "command center after header");
assert(kpiIdx > centerIdx, "command center before KPI cards");
assert(radarIdx > kpiIdx, "risk radar after KPI cards");
assert(healthIdx > radarIdx, "fleet health after risk radar");
assert(insightsIdx > healthIdx, "executive insights after fleet health");
assert(chartIdx > insightsIdx, "mini trend after insights");
assert(tableIdx > chartIdx, "trend before movements table");

assert(dashboard.includes("executiveFinancialPanel"), "KPI cards preserved");
assert(dashboard.includes("monthlyChart"), "chart preserved");
assert(dashboard.includes("financialMovementsPanel"), "movements table preserved");

const ctx = buildDashboardCommandBarContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 2,
  profit: { summary: { totalNet: 1000 } },
  corporateAlerts: { critical: 0 },
});

const html = executiveCommandCenter(ctx);
assert(html.includes("executive-command-center"), "command center html");
assert(html.includes("executive-command-center__status-value"), "fleet status");
assert(html.includes("executive-command-center__recommendation"), "recommendation block");
assert(html.includes("executive-command-center__action-btn"), "primary action button");
assert(html.includes("Yönetici Önerisi"), "recommendation title");
assert(html.includes("Kritik Araç"), "metrics present");
assert(html.includes("Toplam Aktif Risk"), "total active risk metric");

const cta = derivePrimaryActionCTA({
  criticalVehicles: 1,
  complianceRisk: { within30: 0, expired: 0 },
  maintenanceRisk: { due: 0, overdue: 0, upcoming: 0 },
  tireRisk: { unknown: 0, mismatch: 0, attention: 0, warnings: 0 },
});
assert(cta.href === "/vehicle-intelligence", "CTA links to vehicle intelligence");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-3G executive command center tests passed");
