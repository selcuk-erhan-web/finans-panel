/**
 * FLEETOS STB-4D.2 — Executive insights vehicle visual refinement
 * node scripts/test-stb4d2-executive-insights-vehicle-visuals.js
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
  resolveInsightVehicleImageSrc,
  plateInsightImageKey,
} = require("../lib/vehicleInsightImages");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "routes/dashboard.js"), "utf8");
const intelligence = fs.readFileSync(path.join(root, "lib/components/executiveIntelligence.js"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01",
  `layout version: ${LAYOUT_VERSION}`
);

assert(css.includes("max-width: 260px"), "sidebar logo max-width updated");
assert(css.includes("max-height: 145px"), "sidebar logo max-height updated");
assert(css.includes("min-height: 165px"), "sidebar brand min-height updated");
assert(css.includes(".executive-insight-card"), "executive insight card styles");
assert(css.includes(".executive-insight-card__vehicle-img"), "vehicle image styles");
assert(css.includes(".executive-insight-card__cta"), "insight card CTA styles");

assert(intelligence.includes("resolveInsightVehicleImageSrc"), "vehicle image resolver wired");
assert(intelligence.includes("executive-insight-card"), "insight cards use new markup");
assert(intelligence.includes('variant: "urgent"'), "urgent card variant exists");
assert(intelligence.includes("Detayları Gör →"), "insight CTA label");

assert(resolveInsightVehicleImageSrc("16 SYV 16") === "/images/vehicles/vito-clean.png", "16 SYV 16 → vito-clean");
assert(resolveInsightVehicleImageSrc("16 LR 005") === "/images/vehicles/bus-clean.png", "16 LR 005 → bus-clean");
assert(resolveInsightVehicleImageSrc("16 LA 005") === "/images/vehicles/sprinter-clean.png", "16 LA 005 → sprinter-clean");
assert(plateInsightImageKey("16syv16") === "16SYV16", "flexible plate key");

["vito.png", "bus.png", "sprinter.png"].forEach((file) => {
  assert(
    fs.existsSync(path.join(root, "public/images/vehicles", file)),
    `vehicle asset exists: ${file}`
  );
});

const html = executiveInsightsHtml(
  buildExecutiveInsightsContext({
    profit: {
      hasData: true,
      mostProfitable: { plate: "16 SYV 16", netProfit: 12000 },
    },
  })
);
assert(html.includes("Yönetici İçgörüleri"), "insights panel renders");
assert(html.includes("executive-insight-card"), "insight cards render");
assert(html.includes("/images/vehicles/vito-clean.png"), "matched vehicle image in output");
assert(html.includes("Acil Müdahale Gereken"), "urgent card title");
assert(!html.includes("executive-insight-card__vehicle-img") || html.includes("executive-insight-card__icon--urgent"), "urgent uses icon path");

const legacyIdx = dashboard.indexOf("dashboard-legacy-widgets");
const movementsInLegacy =
  dashboard.indexOf("financialMovementsPanel(bundle.recentTransactions)") > legacyIdx;
const radarInLegacy = dashboard.indexOf("executiveRiskRadarHtml(riskRadarContext)") > legacyIdx;
const fleetHealthInLegacy = dashboard.indexOf("fleetHealthCenterHtml(fleetHealthContext)") > legacyIdx;
assert(legacyIdx > -1, "legacy container exists");
assert(movementsInLegacy, "operations table not visible on main dashboard");
assert(radarInLegacy, "risk radar not visible on main dashboard");
assert(fleetHealthInLegacy, "fleet health not visible on main dashboard");

execSync("node -c routes/dashboard.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/executiveIntelligence.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/layout.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4D.2 executive insights vehicle visual tests passed");
