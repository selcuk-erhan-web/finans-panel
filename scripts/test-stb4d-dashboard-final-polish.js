/**
 * FLEETOS STB-4D — Dashboard final polish
 * node scripts/test-stb4d-dashboard-final-polish.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  executiveInsightsHtml,
  buildExecutiveInsightsContext,
} = require("../lib/components/executiveIntelligence");
const {
  buildUpcomingWorkCenterContext,
  upcomingWorkCenterHtml,
  dashboardFinanceTrendPanel,
} = require("../lib/components/commandCenter");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");
const layout = fs.readFileSync(path.join(root, "lib/components/layout.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4g1-premium-login-micro-polish-01", `layout version: ${LAYOUT_VERSION}`);

assert(layout.includes("/images/mistur-fleetos-logo-cropped.png"), "sidebar uses cropped Mistur FleetOS logo");
assert(!layout.includes("mistur-fleetos-logo.svg"), "SVG logo not referenced");
assert(layout.includes("sidebar__brand-logo"), "sidebar brand logo class");
assert(!layout.includes('<div class="sidebar__logo" aria-hidden="true">M</div>'), "purple M placeholder removed");

assert(dashboard.includes("executiveCommandCenter"), "command center on dashboard");
assert(dashboard.includes("executiveFinancialPanel"), "KPI row on dashboard");
assert(dashboard.includes("upcomingWorkCenterHtml"), "upcoming work center on dashboard");
assert(dashboard.includes("dashboardFinanceTrendPanel"), "finance trend on dashboard");
assert(dashboard.includes("executiveInsightsHtml"), "executive insights visible");
assert(dashboard.includes("monthlyChart"), "chart boot preserved");

const legacyIdx = dashboard.indexOf("dashboard-legacy-widgets");
const movementsInLegacy = dashboard.indexOf("financialMovementsPanel(bundle.recentTransactions)") > legacyIdx;
const radarInLegacy = dashboard.indexOf("executiveRiskRadarHtml(riskRadarContext)") > legacyIdx;
assert(legacyIdx > -1, "legacy container exists");
assert(movementsInLegacy, "operations table moved to legacy container");
assert(radarInLegacy, "risk radar in legacy container");

const kpiIdx = dashboard.indexOf("executiveFinancialPanel(");
const workIdx = dashboard.indexOf("upcomingWorkCenterHtml(");
const trendIdx = dashboard.indexOf("dashboardFinanceTrendPanel()");
const insightsIdx = dashboard.indexOf("executiveInsightsHtml(");
assert(workIdx > kpiIdx, "upcoming work after KPI");
assert(trendIdx > workIdx, "finance trend after upcoming work block");
assert(insightsIdx > trendIdx, "insights after finance trend row");

const betweenKpiAndInsights = dashboard.slice(kpiIdx, insightsIdx);
assert(!betweenKpiAndInsights.includes("fleetHealthCenterHtml("), "fleet health not visible on main dashboard");
assert(betweenKpiAndInsights.includes("dashboard-executive-row"), "two-column executive row present");

const polishCss = [
  ".dashboard-executive-row",
  ".upcoming-work-center",
  ".dashboard-finance-trend",
  ".executive-insights-panel",
  "height: 140px",
  ".executive-insight-card",
];
polishCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

const workCtx = buildUpcomingWorkCenterContext({ vehicleCount: 2, alerts: { upcoming: [], muayeneSigorta: [] } });
const workHtml = upcomingWorkCenterHtml(workCtx);
assert(workHtml.includes("Yaklaşan İşler Merkezi"), "upcoming work title");
assert(workHtml.includes("Muayene"), "muayene metric");
assert(workHtml.includes("Sigorta"), "sigorta metric");
assert(workHtml.includes("Bakım"), "bakim metric");
assert(workHtml.includes("Lastik Değişimi"), "lastik metric");
assert(workHtml.includes("Kritik Evrak"), "kritik evrak metric");
assert(workHtml.includes("En yakın kritik tarih"), "nearest critical date");

const trendHtml = dashboardFinanceTrendPanel();
assert(trendHtml.includes("Gelir / Gider Trendi"), "finance trend title");
assert(trendHtml.includes("monthlyChart"), "chart canvas id");

const insightsPanel = executiveInsightsHtml(buildExecutiveInsightsContext({ profit: { hasData: false } }));
assert(insightsPanel.includes("En Kârlı Araç"), "most profitable");
assert(insightsPanel.includes("En Riskli Araç"), "highest risk");
assert(insightsPanel.includes("En Masraflı Araç"), "highest expense");
assert(insightsPanel.includes("Acil Müdahale Gereken"), "immediate attention");
assert(insightsPanel.includes("executive-insight-card"), "upgraded insight cards");
assert(insightsPanel.includes("Detayları Gör →"), "insight card CTA");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/commandCenter.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4D dashboard final polish tests passed");
