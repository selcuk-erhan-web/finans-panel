/**
 * FLEETOS STB-5I — Vehicle Executive Scoreboard
 * node scripts/test-stb5i-vehicle-executive-scoreboard.js
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
const scoreboardSrc = fs.readFileSync(
  path.join(root, "lib/intelligence/vehicleExecutiveScoreboard.js"),
  "utf8"
);
const vehiclesRoute = fs.readFileSync(path.join(root, "routes/vehicles.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb5i-vehicle-executive-scoreboard-01", `layout version: ${LAYOUT_VERSION}`);

[
  ".vehicle-executive-scoreboard",
  ".vehicle-score-card",
  ".vehicle-score-card__label",
  ".vehicle-score-card__value",
  ".vehicle-score-card__meta",
  ".vehicle-score-card--success",
  ".vehicle-score-card--warning",
  ".vehicle-score-card--danger",
].forEach((sel) => assert(css.includes(sel), `CSS missing ${sel}`));

assert(scoreboardSrc.includes("buildVehicleExecutiveScoreboard"), "scoreboard engine");
assert(centerSrc.includes("vehicle360ExecutiveScoreboardHtml"), "scoreboard wired");
assert(!centerSrc.includes("${vehicle360FocusStripHtml(bundle, complianceDocs, actionIntel, predictiveMaint)}"), "focus strip not in header");

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5i-",
  "test-stb5i-vehicle-executive-scoreboard.js"
);

const {
  buildVehicleExecutiveScoreboard,
  resolveMonthlyProfitability,
  resolveFleetRanking,
} = require("../lib/intelligence/vehicleExecutiveScoreboard");
const { buildVehicleActionIntelligence } = require("../lib/intelligence/vehicleActionIntelligence");
const { buildVehicleHealthIntelligence } = require("../lib/intelligence/vehicleHealthIntelligence");
const { buildPredictiveMaintenanceIntelligence } = require("../lib/intelligence/predictiveMaintenanceIntelligence");

const lossBundle = {
  profit: { income: 0, totalExpense: 28373, netProfit: -28373 },
  summary: { net: -28373 },
  hasFinancialData: true,
  monthly: { incomeData: [0], expenseData: [28373] },
  maintenanceHistory: { records: [] },
  maintenanceSchedule: { items: [] },
  tireStatus: { records: [] },
  tireSeasonalStatus: { alerts: [] },
  upcomingMaintenance: [],
  benchmarks: { vehicleCount: 9 },
};
const actionIntel = buildVehicleActionIntelligence(lossBundle, []);
const healthIntel = buildVehicleHealthIntelligence(lossBundle, []);
const maintIntel = buildPredictiveMaintenanceIntelligence(lossBundle);
const board = buildVehicleExecutiveScoreboard(
  lossBundle,
  actionIntel,
  healthIntel,
  maintIntel,
  []
);
assert(board.cards.length === 5, "five scoreboard cards");
assert(board.cards[3].value.includes("-"), "negative profitability when expense without income");
assert(board.cards[4].value.includes("— / 9"), "fleet rank not invented");
assert(board.cards[4].meta.includes("bekleniyor"), "fleet rank meta");

const fleetRank = resolveFleetRanking({ benchmarks: { vehicleCount: 9 } });
assert(fleetRank.value === "— / 9", "fleet placeholder rank");
const profit = resolveMonthlyProfitability(lossBundle);
assert(profit.meta === "Zararda", "zararda meta");

const { vehicle360PageHtml } = require("../lib/components/vehicle360Center");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { fleetCardFit } = require("../lib/components/fleet");
const { getAllVehicleSummaries } = require("../lib/finance");
const { renderVehicleDetail } = require("../routes/vehicle-detail");
const db = require("../lib/db");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 STB 5I", "Mercedes", "Vito", "2021", "Turizm", 118000);
const bundle = getVehicleCenterBundle(ins.lastInsertRowid);
const html = vehicle360PageHtml(bundle);

assert(html.includes("vehicle-executive-scoreboard"), "scoreboard renders");
assert((html.match(/vehicle-score-card/g) || []).length >= 5, "scoreboard cards render");
[
  "Araç Sağlığı",
  "Kritik Risk",
  "Açık Görev",
  "Aylık Kârlılık",
  "Filo Sıralaması",
].forEach((label) => assert(html.includes(label), `scoreboard label: ${label}`));

const visibleFocusStrip = html.match(/<section class="vehicle-focus-strip"/);
assert(!visibleFocusStrip, "old focus strip not visible");

assert(
  html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence"),
  "scoreboard before action intelligence"
);
assert(html.includes("vehicle-action-intelligence--compact"), "compact action intelligence");
assert(html.includes("executive-kpi-grid--compact"), "compact KPI row");
assert(html.includes("vehicle-detail-accordions"), "accordions render");

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
  assert(detail.body.includes("vehicle-executive-scoreboard"), "route scoreboard");

  for (const id of [11, 12]) {
    const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
    if (!row) continue;
    const legacy = await request(`/vehicle/${id}`);
    assert(legacy.status === 200, `/vehicle/${id} renders`);
    assert(legacy.body.includes("vehicle-executive-scoreboard"), `/vehicle/${id} scoreboard`);
  }

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/vehicleExecutiveScoreboard.js", { cwd: root, stdio: "pipe" });

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5I vehicle executive scoreboard tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
