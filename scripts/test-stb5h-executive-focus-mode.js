/**
 * FLEETOS STB-5H — Executive Focus Mode
 * node scripts/test-stb5h-executive-focus-mode.js
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

assert(LAYOUT_VERSION === "fleetos-stb6a-executive-density-upgrade-01", `layout version: ${LAYOUT_VERSION}`);

[
  ".vehicle-executive-scoreboard",
  ".vehicle-score-card",
  ".vehicle-score-card__label",
  ".vehicle-score-card__value",
  ".vehicle-score-card__meta",
  ".vehicle-action-intelligence--compact",
  ".vehicle-detail-accordions",
  ".vehicle-detail-accordion",
  ".vehicle-detail-accordion__summary",
  ".vehicle-detail-accordion__body",
  ".executive-kpi-grid--compact",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(centerSrc.includes("vehicle360ExecutiveScoreboardHtml"), "scoreboard wired");
assert(centerSrc.includes("vehicle360FocusStripHtml"), "focus strip helper preserved");
assert(centerSrc.includes("vehicle360DetailAccordionsHtml"), "accordions wired");
assert(!centerSrc.includes("${vehicle360DecisionStripHtml(bundle, complianceDocs)}"), "decision strip not in header");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5h-",
  "test-stb5h-executive-focus-mode.js"
);

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5H", "Mercedes", "Vito", "2021", "Turizm", 132000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes("vehicle-executive-scoreboard"), "scoreboard renders");
assert(html.includes("vehicle-score-card"), "score cards render");
["Araç Sağlığı", "Kritik Risk", "Açık Görev", "Aylık Kârlılık", "Filo Sıralaması"].forEach((label) =>
  assert(html.includes(label), `scoreboard label: ${label}`)
);

const visibleFocusStrip = html.match(/<section class="vehicle-focus-strip"/);
assert(!visibleFocusStrip, "old focus strip not visible");

assert(html.includes("vehicle-action-intelligence--compact"), "compact action intelligence");
assert(html.includes("executive-kpi-grid--compact"), "compact KPI row");
assert(html.includes("executive-kpi-grid"), "KPI row preserved");

assert(html.includes("vehicle-detail-accordions"), "accordions render");
assert(html.includes("Finansal Görünüm"), "financial accordion");
assert(html.includes("Uygunluk &amp; Evrak"), "compliance accordion");
assert(html.includes("Bakım &amp; Tahmin"), "maintenance accordion");
assert(html.includes("Lastik Durumu"), "tire accordion");
assert(html.includes("Sağlık Detayları"), "health accordion");
assert(html.includes("Operasyon Zaman Çizelgesi"), "timeline accordion");

assert(html.includes('class="vehicle-detail-accordion" open>'), "default open accordions");
const openCount = (html.match(/class="vehicle-detail-accordion" open>/g) || []).length;
assert(openCount === 2, `default open accordions: ${openCount}`);

assert(html.includes("Finansal Görünüm</h2>") || html.includes("Finansal Görünüm"), "financial section preserved");
assert(html.includes("Uygunluk Durumu"), "compliance section preserved");
assert(html.includes("Bakım Özeti"), "maintenance section preserved");
assert(html.includes("predictive-maintenance"), "predictive panel preserved");
assert(html.includes("Lastik Özeti"), "tire section preserved");
assert(html.includes("vehicle-health-dashboard"), "health dashboard preserved");
assert(html.includes("Operasyon Zaman Çizelgesi</h2>") || html.includes("v360-timeline"), "timeline preserved");

assert(
  html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence"),
  "scoreboard before action intelligence"
);
assert(
  html.indexOf("vehicle-action-intelligence") < html.indexOf("executive-kpi-grid--compact"),
  "action before KPI"
);
assert(
  html.indexOf("executive-kpi-grid--compact") < html.indexOf("vehicle-detail-accordions"),
  "KPI before accordions"
);

const summaries = getAllVehicleSummaries();
assert(fleetCardFit(summaries[0]).includes('href="/vehicle/'), "fleet list link");
assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles route preserved");

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
  assert(detail.body.includes("vehicle-focus-strip") === false || !detail.body.match(/<section class="vehicle-focus-strip"/), "route no visible focus strip");
  assert(detail.body.includes("vehicle-executive-scoreboard"), "route scoreboard");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} focus mode`);
  }

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5H executive focus mode tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
