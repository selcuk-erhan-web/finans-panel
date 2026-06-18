/**
 * HGS retroactive matching — import before vehicle, repair after vehicle added.
 * node scripts/test-hgs-retro-match.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-hgs-retro-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

Object.keys(require.cache).forEach((key) => {
  if (
    key.includes("/lib/db.js") ||
    key.includes("/services/hgsImportService") ||
    key.includes("/services/hgsRetroMatchService") ||
    key.includes("/services/profitService") ||
    key.includes("/services/vehicleCenterService")
  ) {
    delete require.cache[key];
  }
});

const db = require("../lib/db");
const hgsImportService = require("../services/hgsImportService");
const { repairUnmatchedHgs } = require("../services/hgsRetroMatchService");
const profitService = require("../services/profitService");
const vehicleCenterService = require("../services/vehicleCenterService");
const { normalizePlate } = require("../utils/plate");

const RETRO_PLATE_DISPLAY = "34 RET 01";
const RETRO_PLATE_NORM = "34RET01";

const RETRO_HGS_TEXT = `
İş Bankası HGS Ekstre
HGS No: 1099999001
Plaka Numarası: ${RETRO_PLATE_NORM}
Araç Sınıfı: 2
Dönem: 01.05.2026 - 31.05.2026
Dönem İçi Yükleme Adedi: 1
Dönem İçi Geçiş Adedi: 1
Dönem İçi Yüklemeler Toplamı: 5.000,00
Dönem İçi Geçişler Toplamı: 2.000,00

GOI Geçiş BURSA-İZMİR Bursa Batı
15.05.2026 10:11:02
İzmir
15.05.2026 13:04:44
2.000,00
Yükleme
11.05.2026
5.000,00
`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    fs.rmdirSync(tmpDir);
  } catch (e) {}
}

function main() {
  console.log("1) Import HGS before vehicle exists…");
  const hash = hgsImportService.hashBuffer(Buffer.from(RETRO_HGS_TEXT + "-retro-test"));
  const parsed = hgsImportService.parsePdfText(RETRO_HGS_TEXT, "retro-before-vehicle.pdf");
  const importResult = hgsImportService.importFromParsed(parsed, "retro-before-vehicle.pdf", hash);

  assert(importResult.ok, "import failed");
  assert(!importResult.vehicleMatched, "should be unmatched at import");
  assert(importResult.expenseCount === 0, "no expenses without vehicle");
  assert(importResult.unmatchedPlates.includes(RETRO_PLATE_NORM), "unmatched plate missing");

  const report = db.prepare("SELECT * FROM hgs_reports WHERE id = ?").get(importResult.reportId);
  assert(!report.vehicle_id, "report vehicle_id should be null");

  const txRows = db
    .prepare("SELECT * FROM hgs_transactions WHERE report_id = ?")
    .all(importResult.reportId);
  assert(txRows.length === 2, `tx count ${txRows.length}`);
  assert(txRows.every((t) => !t.vehicle_id), "tx vehicle_id should be null");
  assert(txRows.every((t) => !t.expense_id), "tx expense_id should be null");

  console.log("2) Add vehicle + income after import…");
  const vehicleId = db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(RETRO_PLATE_DISPLAY, RETRO_PLATE_NORM).lastInsertRowid;

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis Gelirleri', 'service', 100000, 'svc', '2026-05-20 12:00:00')`
  ).run(vehicleId);

  let profit = profitService.getVehicleProfitRows().find((r) => r.vehicleId === vehicleId);
  assert(profit.hgsExpense === 0, `hgs before repair ${profit.hgsExpense}`);
  assert(profit.totalExpense === 0, `total before repair ${profit.totalExpense}`);
  assert(profit.netProfit === 100000, `net before repair ${profit.netProfit}`);

  let bundle = vehicleCenterService.getVehicleCenterBundle(vehicleId);
  assert(bundle.profit.hgs === 0, "vehicle center hgs before repair");

  console.log("3) Dry-run repair…");
  const preview = repairUnmatchedHgs({ dryRun: true });
  assert(preview.matchedReports === 1, `preview matched ${preview.matchedReports}`);
  assert(preview.expensesCreated === 2, `preview expenses ${preview.expensesCreated}`);
  assert(report.vehicle_id == null, "dry-run must not write report");

  console.log("4) Apply repair…");
  const applied = repairUnmatchedHgs({ dryRun: false });
  assert(applied.matchedReports === 1, `applied matched ${applied.matchedReports}`);
  assert(applied.expensesCreated === 2, `applied expenses ${applied.expensesCreated}`);
  assert(applied.unmatchedReportsAfter === 0, "no unmatched after repair");

  const reportAfter = db.prepare("SELECT * FROM hgs_reports WHERE id = ?").get(importResult.reportId);
  assert(Number(reportAfter.vehicle_id) === Number(vehicleId), "report linked to vehicle");

  const txAfter = db
    .prepare("SELECT * FROM hgs_transactions WHERE report_id = ?")
    .all(importResult.reportId);
  assert(txAfter.every((t) => Number(t.vehicle_id) === Number(vehicleId)), "tx linked");
  assert(txAfter.every((t) => t.expense_id), "tx expense_id set");

  const hgsExpenses = db
    .prepare(
      `SELECT SUM(amount) AS s FROM transactions
       WHERE vehicle_id = ? AND type = 'expense' AND category_slug = 'hgs-ogs'`
    )
    .get(vehicleId);
  assert(hgsExpenses.s === 7000, `hgs expense sum ${hgsExpenses.s}`);

  profit = profitService.getVehicleProfitRows().find((r) => r.vehicleId === vehicleId);
  assert(profit.hgsExpense === 7000, `hgs after repair ${profit.hgsExpense}`);
  assert(profit.totalExpense === 7000, `total after repair ${profit.totalExpense}`);
  assert(profit.netProfit === 93000, `net after repair ${profit.netProfit}`);

  bundle = vehicleCenterService.getVehicleCenterBundle(vehicleId);
  assert(bundle.profit.hgs === 7000, `vehicle center hgs ${bundle.profit.hgs}`);
  assert(bundle.profit.totalExpense === 7000, `vehicle center total expense ${bundle.profit.totalExpense}`);

  console.log("5) Re-apply is idempotent…");
  const again = repairUnmatchedHgs({ dryRun: false });
  assert(again.matchedReports === 0, "nothing left to match");
  assert(again.expensesCreated === 0, "no duplicate expenses");

  const expenseCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM transactions WHERE vehicle_id = ? AND category_slug = 'hgs-ogs'`
    )
    .get(vehicleId).c;
  assert(expenseCount === 2, `expense rows ${expenseCount}`);

  assert(normalizePlate(RETRO_PLATE_DISPLAY) === RETRO_PLATE_NORM, "plate normalize sanity");

  console.log("\n✓ HGS retroactive matching tests passed");
  cleanup();
}

try {
  main();
} catch (e) {
  console.error("✗", e.message);
  cleanup();
  process.exit(1);
}
