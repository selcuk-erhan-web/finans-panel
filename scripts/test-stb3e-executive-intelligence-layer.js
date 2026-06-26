/**
 * FLEETOS STB-3E — Executive intelligence layer
 * node scripts/test-stb3e-executive-intelligence-layer.js
 */
const fs = require("fs");
const path = require("path");
const LAYOUT_VERSION = require("../lib/layout-version");
const { renderModuleTabs } = require("../lib/components/moduleTabs");
const {
  buildDashboardCommandBarContext,
  executiveCommandBar,
  buildVehicleDecisionInsights,
  vehicleDecisionCardsHtml,
  buildComplianceRiskSummary,
  complianceRiskSummaryPanel,
  buildTireIntelligence,
  tireIntelligencePanel,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const intelCss = [
  ".executive-command-bar",
  ".executive-command-bar__status",
  ".executive-command-bar__metric",
  ".executive-command-bar__action",
  ".executive-decision-grid",
  ".executive-decision-card",
  ".executive-decision-card__label",
  ".executive-decision-card__value",
  ".executive-decision-card__meta",
  ".executive-risk-metrics",
  ".executive-empty-note",
];

intelCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

const dashboardRoute = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");
assert(dashboardRoute.includes("executiveCommandCenter") || dashboardRoute.includes("executiveCommandBar"), "dashboard uses executive command center");
assert(dashboardRoute.includes("buildDashboardCommandBarContext"), "dashboard builds command bar context");
assert(dashboardRoute.includes("executiveFinancialPanel"), "dashboard KPI widgets preserved");

const viSource = fs.readFileSync(path.join(root, "lib/components/vehicleIntelligence.js"), "utf8");
assert(viSource.includes("vehicleDecisionCardsHtml"), "vehicle intelligence decision cards");
assert(viSource.includes("executive-decision-grid") || viSource.includes("vehicleDecisionCardsHtml"), "decision cards wired");

const docsSource = fs.readFileSync(path.join(root, "lib/components/documents.js"), "utf8");
assert(docsSource.includes("complianceRiskSummaryPanel"), "compliance risk summary panel");
assert(docsSource.includes("buildComplianceRiskSummary"), "compliance risk summary wired");

const tireSource = fs.readFileSync(path.join(root, "lib/components/tireCenter.js"), "utf8");
assert(tireSource.includes("tireIntelligencePanel"), "tire intelligence panel");
assert(tireSource.includes("buildTireIntelligence"), "tire intelligence wired");

const maintSource = fs.readFileSync(path.join(root, "lib/components/maintenanceCenter.js"), "utf8");
assert(maintSource.includes("maintenanceIntelligencePanel"), "maintenance intelligence panel");

const intelModule = fs.readFileSync(path.join(root, "lib/components/executiveIntelligence.js"), "utf8");
assert(intelModule.includes("executiveCommandBar"), "executive intelligence module exports command bar");

const cmdCtx = buildDashboardCommandBarContext({
  fleetStatus: { tone: "neutral" },
  vehicleCount: 0,
  profit: { summary: { totalNet: 0 } },
  corporateAlerts: { critical: 0 },
});
const cmdHtml = executiveCommandBar(cmdCtx);
assert(cmdHtml.includes("executive-command-center") || cmdHtml.includes("executive-command-bar"), "command center html");
assert(cmdHtml.includes("Yönetici Önerisi"), "command bar action label");

const decisionHtml = vehicleDecisionCardsHtml(
  buildVehicleDecisionInsights([], {})
);
assert(decisionHtml.includes("executive-decision-card"), "decision card html");

const riskHtml = complianceRiskSummaryPanel(
  buildComplianceRiskSummary({ kpi: { expired: 0, within7: 0, within30: 0, within60: 0 }, upcoming: [] })
);
assert(riskHtml.includes("executive-panel--risk"), "risk panel class");

const tireHtml = tireIntelligencePanel(
  buildTireIntelligence({ seasonalReport: null, summary: {}, vehicleCount: 0 })
);
assert(tireHtml.includes("executive-panel--intel"), "tire intel panel class");

const tabsHtml = renderModuleTabs("compliance", "/documents");
assert(tabsHtml.includes("module-tabs"), "module tabs still render");

const routeDocs = fs.readFileSync(path.join(root, "routes/documents.js"), "utf8");
assert(routeDocs.includes('app.get("/documents"'), "documents route intact");
assert(!routeDocs.includes("router.delete"), "no route removal in documents");

console.log("✓ FleetOS STB-3E executive intelligence layer tests passed");
