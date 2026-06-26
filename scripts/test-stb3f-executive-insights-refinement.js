/**
 * FLEETOS STB-3F — Executive insights refinement
 * node scripts/test-stb3f-executive-insights-refinement.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const { renderModuleTabs } = require("../lib/components/moduleTabs");
const {
  executiveInsight,
  executiveCommandBar,
  executiveCommandCenter,
  buildMaintenanceIntelligence,
  maintenanceIntelligencePanel,
  vehicleDecisionCardsHtml,
  buildVehicleDecisionInsights,
} = require("../lib/components/executiveIntelligence");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const insightCss = [
  ".executive-insight",
  ".executive-insight__title",
  ".executive-insight__body",
  ".executive-insight__action",
  ".executive-insight--warning",
  ".executive-insight--danger",
  ".executive-insight--info",
  ".executive-insight--success",
  ".executive-command-bar--prominent",
  ".executive-risk-metrics--maint",
];

insightCss.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

const intel = fs.readFileSync(path.join(root, "lib/components/executiveIntelligence.js"), "utf8");
assert(intel.includes("function executiveInsight"), "executiveInsight helper");
assert(intel.includes("Bakım Planı Eksik Araç"), "maintenance intelligence metrics");
assert(intel.includes("Gecikmiş Bakım"), "maintenance overdue metric");
assert(intel.includes("executive-command-center") || intel.includes("executive-command-bar--prominent"), "command center class");

const maintIntel = buildMaintenanceIntelligence({ scheduleReport: null, summary: {}, vehicleCount: 5 });
assert(maintIntel.missingPlan === 5, "missing plan uses fleet size");
assert(maintIntel.executiveAction.includes("Öncelik"), "maintenance empty action");

const maintHtml = maintenanceIntelligencePanel(maintIntel);
assert(maintHtml.includes("Bakım Zekâsı"), "maintenance panel title");
assert(maintHtml.includes("executive-insight"), "maintenance uses executive insight");
assert(maintHtml.includes("Yaklaşan Bakım"), "maintenance upcoming metric");

const cmdHtml = executiveCommandCenter({
  fleetStatus: { label: "Stabil", tone: "success", centerTone: "stable" },
  criticalVehicles: 0,
  totalActiveRiskCount: 0,
  primaryAction: "Test",
  primaryRecommendation: "Test",
  primaryCta: { label: "İzlemeye Devam Et", href: "/" },
  hasData: true,
});
assert(cmdHtml.includes("executive-command-center"), "command center prominent");
assert(cmdHtml.includes("executive-insight") || cmdHtml.includes("executive-command-center__recommendation"), "command center recommendation");

const decisionHtml = vehicleDecisionCardsHtml(buildVehicleDecisionInsights([], {}));
assert(decisionHtml.includes("Veri bekleniyor"), "decision cards empty language");

const insightHtml = executiveInsight({ title: "Test", action: "Aksiyon", tone: "warning" });
assert(insightHtml.includes("executive-insight--warning"), "insight tone class");

assert(renderModuleTabs("maintenance", "/maintenance").includes("module-tabs"), "module tabs intact");

execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/maintenanceCenter.js", { cwd: root, stdio: "pipe" });
execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-3F executive insights refinement tests passed");
