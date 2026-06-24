/**
 * FLEETOS STB-5I — Render debug (Vehicle Executive Scoreboard visibility)
 * node scripts/test-stb5i-render-debug.js
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

assert(LAYOUT_VERSION === "fleetos-stb5i-vehicle-executive-scoreboard-01", `layout version: ${LAYOUT_VERSION}`);

assert(centerSrc.includes("buildVehicleExecutiveScoreboard"), "scoreboard engine imported");
assert(centerSrc.includes("vehicle360ExecutiveScoreboardHtml"), "scoreboard html helper exists");
assert(centerSrc.includes("${vehicle360ExecutiveScoreboardHtml(bundle, complianceDocs, actionIntel, healthIntel, predictiveMaint)}"), "scoreboard wired in header");

const headerBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360HeaderHtml"),
  centerSrc.indexOf("function vehicle360SummaryHtml")
);
assert(!headerBlock.includes("vehicle360FocusStripHtml("), "focus strip not rendered in header");
assert(!headerBlock.includes("vehicle360DecisionStripHtml("), "decision strip not rendered in header");

const pageBlock = centerSrc.slice(
  centerSrc.indexOf("function vehicle360PageHtml"),
  centerSrc.indexOf("module.exports")
);
const actionIdx = pageBlock.indexOf("vehicle360ActionIntelligenceHtml");
const kpiIdx = pageBlock.indexOf("vehicle360SummaryHtml");
const accordionIdx = pageBlock.indexOf("vehicle360DetailAccordionsHtml");
assert(pageBlock.includes("vehicle360HeaderHtml(bundle, complianceDocs)"), "header includes scoreboard");
assert(pageBlock.includes("vehicle360ActionIntelligenceHtml"), "action intelligence on page");
assert(actionIdx > 0 && kpiIdx > actionIdx, "action before KPI in page");
assert(accordionIdx > kpiIdx, "accordions after KPI");

[
  ".vehicle-executive-scoreboard",
  ".vehicle-score-card",
  ".vehicle-score-card__label",
  ".vehicle-score-card__value",
  ".vehicle-score-card__meta",
].forEach((sel) => assert(css.includes(sel), `CSS exists: ${sel}`));

const scoreboardCss = css.slice(
  css.indexOf(".vehicle-executive-scoreboard"),
  css.indexOf(".vehicle-focus-strip")
);
assert(!/display:\s*none/.test(scoreboardCss), "scoreboard CSS not hidden");
assert(!/visibility:\s*hidden/.test(scoreboardCss), "scoreboard CSS visibility ok");
assert(!/height:\s*0/.test(scoreboardCss), "scoreboard CSS height ok");

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-stb5i-debug-", "test-stb5i-render-debug.js");

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5I DBG", "Mercedes", "Vito", "2021", "Turizm", 121000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes('data-layout="fleetos-stb5i-vehicle-executive-scoreboard-01"') === false, "layout version on page wrapper is layout.js concern");
assert(html.includes("vehicle-executive-scoreboard"), "scoreboard section in HTML");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "scoreboard cards in HTML");

[
  "Araç Sağlığı",
  "Kritik Risk",
  "Açık Görev",
  "Aylık Kârlılık",
  "Filo Sıralaması",
].forEach((label) => assert(html.includes(label), `label: ${label}`));

assert(!html.match(/<section class="vehicle-360-decision-strip"/), "decision strip not visible");
assert(!html.match(/<section class="vehicle-focus-strip"/), "focus strip not visible");
assert(!html.includes("En Büyük Maliyet"), "old decision strip label not visible");

const scoreboardPos = html.indexOf("vehicle-executive-scoreboard");
const actionPos = html.indexOf("vehicle-action-intelligence");
const kpiPos = html.indexOf("executive-kpi-grid--compact");
const accordionPos = html.indexOf("vehicle-detail-accordions");
assert(scoreboardPos > 0 && scoreboardPos < actionPos, "scoreboard before action intelligence");
assert(actionPos < kpiPos, "action before KPI");
assert(kpiPos < accordionPos, "KPI before accordions");

const accordionBody = html.slice(accordionPos);
assert(accordionBody.includes("vehicle-executive-scoreboard") === false, "scoreboard not inside accordion");

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
  assert(detail.status === 200, "/vehicle/:id returns 200");
  assert(detail.body.includes("vehicle-executive-scoreboard"), "route renders scoreboard");
  assert(detail.body.includes("Filo Sıralaması"), "route renders fleet rank label");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} returns 200`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} scoreboard`);
  }

  assert(vehiclesRoute.includes('app.get("/vehicles"'), "/vehicles route exists");

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/vehicleExecutiveScoreboard.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5I render debug tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
