/**
 * FLEETOS STB-3C — Executive layout expansion
 * node scripts/test-stb3c-executive-layout.js
 */
const fs = require("fs");
const path = require("path");
const LAYOUT_VERSION = require("../lib/layout-version");
const { shell, resolveWorkspaceBodyClass } = require("../lib/components/layout");
const { renderModuleTabs } = require("../lib/components/moduleTabs");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb4d-dashboard-final-polish-01", `layout version: ${LAYOUT_VERSION}`);
assert(resolveWorkspaceBodyClass("/") === "workspace__body workspace__body--cockpit", "dashboard cockpit mode");
assert(resolveWorkspaceBodyClass("/vehicle-health") === "workspace__body workspace__body--scroll", "app scroll mode");

const homeShell = shell({ title: "Ana Ekran", subtitle: "Test", content: '<div class="command-center"></div>', path: "/" });
const viShell = shell({ title: "Araç Zekâsı", subtitle: "Test", content: "<div></div>", path: "/vehicle-intelligence" });
assert(homeShell.includes('class="workspace__body workspace__body--cockpit"'), "home shell cockpit class");
assert(viShell.includes('class="workspace__body workspace__body--scroll"'), "vi shell scroll class");

assert(css.includes(".workspace__body--cockpit"), "cockpit css");
assert(css.includes(".workspace__body--scroll"), "scroll css");
assert(css.includes(".grid2--executive"), "executive grid css");
assert(css.includes(".dash--executive"), "executive dash css");
assert(css.includes(".form-panel--narrow"), "narrow form utility");
assert(css.includes(".panel--comfortable"), "comfortable panel css");

const executiveHubFiles = [
  "lib/components/vehicleIntelligence.js",
  "lib/components/vehicleHealth.js",
  "lib/components/documents.js",
  "lib/components/complianceAnalytics.js",
  "lib/components/maintenanceCenter.js",
  "lib/components/maintenanceAnalytics.js",
  "lib/components/tireCenter.js",
  "lib/components/tireAnalytics.js",
];

executiveHubFiles.forEach((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(source.includes("dash--executive") || source.includes("executive-hub"), `${file} uses executive layout`);
});

const gridFiles = [
  "lib/components/documents.js",
  "lib/components/maintenanceCenter.js",
  "lib/components/tireCenter.js",
];

gridFiles.forEach((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(source.includes("grid2--executive"), `${file} uses grid2--executive`);
});

const layoutSource = fs.readFileSync(path.join(root, "lib/components/layout.js"), "utf8");
assert(layoutSource.includes("resolveWorkspaceBodyClass"), "layout resolver exported");

const routeFiles = ["routes/vehicles.js", "routes/income.js", "routes/fuel.js", "routes/transactions.js"];
routeFiles.forEach((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(source.includes("form-panel--narrow"), `${file} uses form-panel--narrow`);
  assert(!source.includes("max-width:520px"), `${file} inline max-width removed`);
});

const tabs = renderModuleTabs("vehicleIntelligence", "/vehicle-health");
assert(tabs.includes("module-tab--active"), "module tabs still work");

console.log("✓ FleetOS STB-3C executive layout tests passed");
