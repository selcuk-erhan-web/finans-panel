/**
 * FLEETOS STB-5G — Predictive Maintenance Intelligence
 * node scripts/test-stb5g-predictive-maintenance-intelligence.js
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
const engineSrc = fs.readFileSync(
  path.join(root, "lib/intelligence/predictiveMaintenanceIntelligence.js"),
  "utf8"
);
const centerSrc = fs.readFileSync(path.join(root, "lib/components/vehicle360Center.js"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb6a-executive-density-upgrade-01",
  `layout version: ${LAYOUT_VERSION}`
);

[
  ".predictive-maintenance",
  ".predictive-maintenance__head",
  ".predictive-maintenance__score",
  ".predictive-maintenance__grid",
  ".predictive-maintenance__signal",
  ".predictive-maintenance__risk-list",
  ".predictive-maintenance__recommendation",
  ".predictive-maintenance--success",
  ".predictive-maintenance--warning",
  ".predictive-maintenance--danger",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(engineSrc.includes("buildPredictiveMaintenanceIntelligence"), "engine export");
assert(!engineSrc.match(/fetch\(|openai|anthropic|llm|gpt/i), "no AI/API calls");
assert(centerSrc.includes("vehicle360PredictiveMaintenanceHtml"), "panel wired");
assert(centerSrc.includes('label: "Bakım"'), "hero maintenance forecast metric");
assert(centerSrc.includes("Predictive Maintenance Intelligence"), "panel title");

const {
  buildPredictiveMaintenanceIntelligence,
  clampScore,
  scoreToStatus,
  nextReviewLabel,
} = require("../lib/intelligence/predictiveMaintenanceIntelligence");

assert(clampScore(150) === 100, "score clamp max");
assert(clampScore(-10) === 0, "score clamp min");
assert(scoreToStatus(90).status === "Düşük Risk", "düşük risk status");
assert(scoreToStatus(75).status === "İzleme", "izleme status");
assert(scoreToStatus(55).status === "Yüksek Risk", "yüksek risk status");
assert(scoreToStatus(30).status === "Kritik", "kritik status");
assert(nextReviewLabel("Kritik") === "Bugün gözden geçirilmeli", "kritik review");
assert(nextReviewLabel("Düşük Risk") === "Rutin takip yeterli", "low review");

const emptyBundle = {
  vehicle: { km: 150000 },
  profit: { fuel: 5000, maintenance: 0, totalExpense: 5000 },
  maintenanceHistory: { records: [] },
  maintenanceSchedule: { items: [] },
  upcomingMaintenance: [],
  timeline: { events: [] },
  benchmarks: { avgExpense: 10000, vehicleCount: 3 },
};
const intel = buildPredictiveMaintenanceIntelligence(emptyBundle);
assert(intel.score >= 0 && intel.score <= 100, "score range");
assert(intel.nextReviewLabel, "next review label");
assert(Array.isArray(intel.riskFactors), "risk factors");
assert(intel.maintenanceSignals.length === 3, "maintenance signals");
assert(intel.executiveRecommendation, "executive recommendation");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5g-",
  "test-stb5g-predictive-maintenance-intelligence.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5G", "Mercedes", "Sprinter", "2020", "Turizm", 145000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes("predictive-maintenance"), "predictive panel renders");
assert(html.includes("predictive-maintenance__score"), "score card renders");
assert(html.includes("predictive-maintenance__signal"), "signal cards render");
assert(html.includes("predictive-maintenance__risk-list") || html.includes("predictive-maintenance__risk-empty"), "risk factors");
assert(html.includes("vehicle-health-dashboard"), "health dashboard preserved");
assert(html.includes("vehicle-detail-accordions"), "predictive panel in accordions");

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
  assert(detail.body.includes("predictive-maintenance"), "route predictive panel");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("predictive-maintenance"), `/vehicle/${id} panel`);
  }

  const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");
  assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles list route preserved");

  execSync("node -c lib/intelligence/predictiveMaintenanceIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5G predictive maintenance intelligence tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
