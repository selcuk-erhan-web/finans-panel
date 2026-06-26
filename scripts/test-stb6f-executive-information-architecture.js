/**
 * FLEETOS STB-6F — Executive Information Architecture
 * node scripts/test-stb6f-executive-information-architecture.js
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const { execSync } = require("child_process");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");
const LAYOUT_VERSION = require("../lib/layout-version");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const centerSrc = fs.readFileSync(path.join(root, "lib/components/vehicle360Center.js"), "utf8");
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
const vehicleDetailRoute = fs.readFileSync(path.join(root, "routes/vehicle-detail.js"), "utf8");

const STB6F = "fleetos-stb6f-executive-information-architecture-01";
assert(LAYOUT_VERSION === STB6F, `layout version: ${LAYOUT_VERSION}`);

assert(centerSrc.includes("vehicle360IntelligenceRibbonsHtml"), "ribbons section wired");
assert(centerSrc.includes("vehicle360FleetComparisonRibbonHtml"), "comparison ribbon");
assert(centerSrc.includes("vehicle360ExecutivePredictiveRibbonHtml"), "predictive ribbon");
assert(centerSrc.includes("vehicle-360-center--information-architecture"), "IA page modifier");

[
  ".vehicle-intelligence-ribbons",
  ".fleet-comparison-ribbon",
  ".executive-predictive-ribbon",
  ".intelligence-ribbon__label",
  ".intelligence-ribbon__value",
  ".intelligence-ribbon__meta",
  ".intelligence-ribbon__cta",
  ".vehicle-detail-accordion--comparison",
  ".vehicle-detail-accordion--predictive",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

const headerBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360HeaderHtml"),
  centerSrc.indexOf("function vehicle360SummaryHtml")
);
assert(!headerBlock.includes("vehicle360FleetComparisonHtml"), "full comparison not in header");
assert(!headerBlock.includes("vehicle360ExecutivePredictiveHtml"), "full predictive not in header");
assert(headerBlock.indexOf("vehicle360ExecutiveCockpitHtml") < headerBlock.indexOf("vehicle360ExecutiveScoreboardHtml"), "cockpit before scoreboard in header");

const pageBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360PageHtml"),
  centerSrc.indexOf("module.exports")
);
const kpiIdx = pageBlock.indexOf("vehicle360SummaryHtml");
const ribbonsIdx = pageBlock.indexOf("vehicle360IntelligenceRibbonsHtml");
const accordionIdx = pageBlock.indexOf("vehicle360DetailAccordionsHtml");
assert(kpiIdx > 0 && ribbonsIdx > kpiIdx, "ribbons after KPI");
assert(accordionIdx > ribbonsIdx, "accordions after ribbons");

const accordionBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360DetailAccordionsHtml"),
  centerSrc.indexOf("function vehicle360PageHtml")
);
assert(accordionBlock.includes("Filo Karşılaştırması"), "comparison accordion");
assert(accordionBlock.includes("Öngörü &amp; Tahmin"), "predictive accordion");
assert(accordionBlock.includes("vehicle360FleetComparisonHtml"), "full comparison in accordion");
assert(accordionBlock.includes("vehicle360ExecutivePredictiveHtml"), "full predictive in accordion");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb6f-",
  "test-stb6f-executive-information-architecture.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 6F", "Mercedes", "Vito", "2021", "Turizm", 130000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

const headerEnd = html.indexOf("</div>", html.indexOf("vehicle-360-identity"));
const aboveFold = html.slice(0, headerEnd > 0 ? headerEnd : html.length);
assert(!aboveFold.includes('aria-label="Fleet Comparison Intelligence"'), "full comparison not above fold");
assert(!aboveFold.includes('aria-label="Executive Predictive Intelligence"'), "full predictive not above fold");

assert(html.includes("fleet-comparison-ribbon"), "comparison ribbon renders");
assert(html.includes("executive-predictive-ribbon"), "predictive ribbon renders");
assert(html.includes("vehicle-intelligence-ribbons"), "ribbons section renders");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "scoreboard preserved");
assert(html.includes("vehicle-action-intelligence--ticker"), "action ticker preserved");
assert(html.includes("executive-kpi-grid--grouped"), "KPI row preserved");
assert(html.includes('aria-label="Fleet Comparison Intelligence"'), "full comparison in page");
assert(html.includes('aria-label="Executive Predictive Intelligence"'), "full predictive in page");
assert(html.includes("vehicle-detail-accordions"), "accordions preserved");
assert(html.includes("Finansal Görünüm"), "financial accordion");
assert(html.includes("Bakım &amp; Tahmin"), "maintenance accordion");
assert(html.includes("Sağlık Detayları"), "health accordion");
assert(html.includes("predictive-maintenance"), "predictive maintenance preserved");
assert(html.includes("vehicle-health-dashboard"), "health dashboard preserved");

assert(
  html.indexOf("vehicle-executive-cockpit") < html.indexOf("vehicle-executive-scoreboard"),
  "cockpit before scoreboard"
);
assert(
  html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence--ticker"),
  "scoreboard before action ticker"
);
assert(
  html.indexOf("vehicle-action-intelligence--ticker") < html.indexOf("executive-kpi-grid--grouped"),
  "action before KPI"
);
assert(
  html.indexOf("executive-kpi-grid--grouped") < html.indexOf("vehicle-intelligence-ribbons"),
  "KPI before ribbons"
);
assert(
  html.indexOf("vehicle-intelligence-ribbons") < html.indexOf("vehicle-detail-accordions"),
  "ribbons before accordions"
);
assert(
  html.indexOf('aria-label="Fleet Comparison Intelligence"') > html.indexOf("vehicle-detail-accordions"),
  "full comparison inside accordions"
);

assert(!vehicleDetailRoute.includes("STB-6F"), "no route changes");
assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles route preserved");

const summaries = getAllVehicleSummaries();
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet list link");

const app = express();
app.get("/vehicle/:id", (req, res) => renderVehicleDetail(req, res));

async function request(pathname) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://127.0.0.1:${port}${pathname}`)
        .then(async (res) => {
          const body = await res.text();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

(async () => {
  const detail = await request(`/vehicle/${ins.lastInsertRowid}`);
  assert(detail.status === 200, "vehicle detail route");
  assert(detail.body.includes("fleet-comparison-ribbon"), "route comparison ribbon");
  assert(detail.body.includes("executive-predictive-ribbon"), "route predictive ribbon");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-intelligence-ribbons"), `/vehicle/${id} ribbons`);
    assert(legacy.body.includes("Filo Karşılaştırması"), `/vehicle/${id} comparison accordion`);
  }

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/fleetComparisonIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/executivePredictiveFleetIntelligence.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-6F executive information architecture tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
