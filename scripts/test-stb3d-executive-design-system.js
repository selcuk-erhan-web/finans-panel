/**
 * FLEETOS STB-3D — Executive design system
 * node scripts/test-stb3d-executive-design-system.js
 */
const fs = require("fs");
const path = require("path");
const LAYOUT_VERSION = require("../lib/layout-version");
const { renderModuleTabs } = require("../lib/components/moduleTabs");
const { executiveKpi, executiveHubHeader } = require("../lib/components/executiveDesign");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);

const tokenChecks = [
  "--exec-surface",
  "--exec-elevated",
  "--exec-shadow",
  "--exec-radius",
  "--exec-section-gap",
  "--exec-kpi-height",
  ".executive-kpi-grid",
  ".executive-kpi",
  ".executive-hub__header",
  ".executive-panel",
  ".executive-form",
  ".executive-table",
];

tokenChecks.forEach((token) => assert(css.includes(token), `missing css: ${token}`));

const targetFiles = [
  "lib/components/vehicleIntelligence.js",
  "lib/components/vehicleHealth.js",
  "lib/components/documents.js",
  "lib/components/maintenanceCenter.js",
  "lib/components/tireCenter.js",
];

targetFiles.forEach((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(source.includes("executive-hub"), `${file} uses executive-hub`);
  assert(source.includes("executiveKpiGrid"), `${file} uses executive KPI grid`);
  assert(source.includes("executiveHubHeader"), `${file} uses executive hub header`);
  assert(source.includes("executive-panel"), `${file} uses executive panels`);
  assert(source.includes("executive-table"), `${file} uses executive tables`);
  assert(source.includes("module-tabs") || source.includes("renderModuleTabs"), `${file} keeps module tabs`);
  assert(!source.includes("vi-hub__title") && !source.includes("documents-hub__title"), `${file} removed duplicate hub title`);
});

const kpiHtml = executiveKpi({ label: "Test", value: "12", meta: "meta", tone: "success" });
assert(kpiHtml.includes("executive-kpi--success"), "kpi tone class");
assert(kpiHtml.includes("executive-kpi__meta"), "kpi meta");

const hubHtml = executiveHubHeader({
  eyebrow: "Filo",
  description: "Test açıklama",
  tabsHtml: renderModuleTabs("vehicleIntelligence", "/vehicle-intelligence"),
});
assert(hubHtml.includes("executive-hub__description"), "hub description");
assert(hubHtml.includes("module-tabs"), "hub tabs preserved");

const routeIntel = fs.readFileSync(path.join(root, "routes/vehicleIntelligence.js"), "utf8");
assert(routeIntel.includes("vehicleIntelligenceService.buildFleetVehicleIntelligence"), "route service call intact");
assert(routeIntel.includes("vehicleIntelligencePageHtml"), "route still renders page");
assert(!routeIntel.includes("router.delete"), "no route mutations in test scope");

console.log("✓ FleetOS STB-3D executive design system tests passed");
