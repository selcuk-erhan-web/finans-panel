/**
 * FLEETOS STB-5C — Vehicle Executive Command Center
 * node scripts/test-stb5c-vehicle-executive-command-center.js
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

assert(
  LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01",
  `layout version: ${LAYOUT_VERSION}`
);

[
  ".vehicle-360-hero--command-center",
  ".vehicle-360-command-metrics",
  ".vehicle-360-command-metric",
  ".vehicle-360-hero__image-stage",
  ".vehicle-360-hero__media::after",
  ".vehicle-360-decision-card__icon",
  ".vehicle-360-decision-card--success",
  ".vehicle-360-decision-card--warning",
  ".vehicle-360-decision-card--danger",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(
  css.includes("grid-template-columns: minmax(280px, 360px) minmax(320px, 1fr) minmax(280px, 360px)"),
  "3-column command hero layout"
);
assert(css.includes("min-height: 280px"), "hero min-height 280px");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5c-",
  "test-stb5c-vehicle-executive-command-center.js"
);

const {
  vehicle360PageHtml,
  buildVehicleCommandMetrics,
} = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 LR 005", "Mercedes", "Sprinter", "2021", "Turizm", 150000);
const vehicleId = ins.lastInsertRowid;
const bundle = getVehicleCenterBundle(vehicleId);
assert(bundle, "bundle loads");

const complianceDocs = [];
const metrics = buildVehicleCommandMetrics(bundle, complianceDocs);
assert(metrics.income?.label, "income metric label");
assert(metrics.expense?.label, "expense metric label");
assert(metrics.maintenance?.label === "Bakım Tahmini", "maintenance forecast metric");
assert(metrics.health?.label === "Araç Sağlığı", "health metric");
assert(
  ["Bu Ay Gelir", "Toplam Gelir"].includes(metrics.income.label),
  "income label valid"
);
assert(
  ["Bu Ay Gider", "Toplam Gider"].includes(metrics.expense.label),
  "expense label valid"
);

const html = vehicle360PageHtml(bundle);
assert(html.includes("vehicle-360-hero--command-center"), "command center hero");
assert(html.includes("vehicle-360-command-metrics"), "command metrics in hero");
assert(html.includes("Bakım Tahmini"), "maintenance forecast metric rendered");
assert(html.includes("Araç Sağlığı"), "health metric rendered");
assert(html.includes("vehicle-360-decision-card__icon"), "decision card icons");
assert(html.includes("vehicle-360-decision-card--"), "decision tone classes");
assert(html.includes("executive-kpi-grid"), "KPI row preserved");
assert(html.includes("Finansal Görünüm"), "financial section preserved");
assert(html.includes("Uygunluk Durumu"), "compliance section preserved");
assert(html.indexOf("vehicle-360-command-metrics") < html.indexOf("executive-kpi-grid"), "metrics before KPI row");
assert(html.indexOf("vehicle-360-decision-strip") < html.indexOf("executive-kpi-grid"), "decision strip before KPI row");

const summaries = getAllVehicleSummaries();
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet list link preserved");

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
  const detail = await request(`/vehicle/${vehicleId}`);
  assert(detail.status === 200, `/vehicle/:id status ${detail.status}`);
  assert(detail.body.includes("vehicle-360-command-metrics"), "route renders command metrics");

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/vehicleInsightImages.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5C vehicle executive command center tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
