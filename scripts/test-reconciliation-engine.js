/**
 * FLEETOS-RECON-01 — hakediş doğrulama motoru testleri (temp DB)
 * node scripts/test-reconciliation-engine.js
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-recon-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/reconciliationService") ||
      key.includes("/services/alertService")
    ) {
      delete require.cache[key];
    }
  });
}

clearModuleCache();

const db = require("../lib/db");
const reconciliationService = require("../services/reconciliationService");
const alertService = require("../services/alertService");
const { normalizePlate } = require("../utils/plate");

const PERIOD_LABEL = "May.26";
const COMPANY = "KIRPART";
const PERIOD_DATE = "2026-05-31";
const TX_DATE = "2026-05-31 12:00:00";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    fs.rmdirSync(tmpDir);
  } catch (e) {}
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function createBatch() {
  const hash = crypto.randomBytes(12).toString("hex");
  return db
    .prepare(
      `INSERT INTO hakedis_import_batches (period_label, company_name, period_date, file_hash, calculated_total)
       VALUES (?, ?, ?, ?, 0)`
    )
    .run(PERIOD_LABEL, COMPANY, PERIOD_DATE, hash).lastInsertRowid;
}

function insertExpected({ vehicleId, amount, note }) {
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis Gelirleri', 'service', ?, ?, ?)`
  ).run(vehicleId, amount, note, TX_DATE);
}

function insertHakedis({ batchId, vehicleId, amount, lineType = "vehicle", suffix = "4472" }) {
  const idPart = vehicleId || suffix;
  const dedupKey = `hakedis:${PERIOD_LABEL}:${COMPANY}:${lineType}:${idPart}:${amount}`;
  let note;
  if (lineType === "vehicle") note = `${COMPANY} ${PERIOD_LABEL} hakediş · ${suffix}`;
  else if (lineType === "otoban") note = `${COMPANY} ${PERIOD_LABEL} Otoban Hakedişi`;
  else note = `${COMPANY} ${PERIOD_LABEL} hakediş`;

  db.prepare(
    `INSERT INTO transactions (
      vehicle_id, type, category, category_slug, amount, note, date,
      hakedis_import_id, income_dedup_key
    ) VALUES (?, 'income', 'Servis Gelirleri', 'service', ?, ?, ?, ?, ?)`
  ).run(vehicleId, amount, note, TX_DATE, batchId, dedupKey);
}

function findRow(rows, predicate) {
  return rows.find(predicate);
}

function main() {
  const batchId = createBatch();

  console.log("1) Beklenen = Hakediş → matched…");
  const vMatch = seedVehicle("16 S 4472");
  insertExpected({
    vehicleId: vMatch,
    amount: 100000,
    note: `${COMPANY} ${PERIOD_LABEL} beklenen · 4472`,
  });
  insertHakedis({ batchId, vehicleId: vMatch, amount: 100000, suffix: "4472" });

  console.log("2) Hakediş düşük → underpaid…");
  const vUnder = seedVehicle("16 S 4605");
  insertExpected({ vehicleId: vUnder, amount: 132660, note: `${COMPANY} ${PERIOD_LABEL} beklenen · 4605` });
  insertHakedis({ batchId, vehicleId: vUnder, amount: 132040, suffix: "4605" });

  console.log("3) Hakediş yüksek → overpaid…");
  const vOver = seedVehicle("16 S 4269");
  insertExpected({ vehicleId: vOver, amount: 100000, note: `${COMPANY} ${PERIOD_LABEL} beklenen · 4269` });
  insertHakedis({ batchId, vehicleId: vOver, amount: 105000, suffix: "4269" });

  console.log("4) Eşleşmeyen hakediş → unmatched…");
  const vUnmatched = seedVehicle("16 S 4272");
  insertHakedis({ batchId, vehicleId: vUnmatched, amount: 88000, suffix: "4272" });

  console.log("5) Güven seviyesi high / medium / low…");
  insertExpected({
    vehicleId: null,
    amount: 37499,
    note: `${COMPANY} ${PERIOD_LABEL} Otoban beklenen`,
  });
  insertHakedis({ batchId, vehicleId: null, amount: 37499, lineType: "otoban" });

  assert(
    reconciliationService.resolveConfidence({
      period: "2026-05",
      company: COMPANY,
      vehicleId: vMatch,
    }) === "high",
    "high confidence"
  );
  assert(
    reconciliationService.resolveConfidence({
      period: "2026-05",
      company: COMPANY,
      vehicleId: null,
    }) === "medium",
    "medium confidence"
  );
  assert(
    reconciliationService.resolveConfidence({ period: "2026-05", company: null, vehicleId: null }) ===
      "low",
    "low confidence"
  );
  assert(reconciliationService.resolveStatus(100, 100, "low") === "low_confidence", "low status");

  const rows = reconciliationService.buildReconciliationRows();
  const matched = findRow(rows, (r) => r.vehicleId === vMatch);
  const under = findRow(rows, (r) => r.vehicleId === vUnder);
  const over = findRow(rows, (r) => r.vehicleId === vOver);
  const unmatched = findRow(rows, (r) => r.vehicleId === vUnmatched);
  const otoban = findRow(rows, (r) => r.lineType === "otoban");

  assert(matched?.status === "matched", `matched ${matched?.status}`);
  assert(under?.status === "underpaid", `underpaid ${under?.status}`);
  assert(under?.difference === -620, `under diff ${under?.difference}`);
  assert(over?.status === "overpaid", `overpaid ${over?.status}`);
  assert(unmatched?.status === "unmatched", `unmatched ${unmatched?.status}`);
  assert(otoban?.confidence === "medium", `otoban confidence ${otoban?.confidence}`);
  assert(otoban?.status === "matched", `otoban matched ${otoban?.status}`);

  console.log("6) RECON_UNDERPAYMENT alert üretimi…");
  const vCritical = seedVehicle("16 SYV 16");
  insertExpected({ vehicleId: vCritical, amount: 200000, note: `${COMPANY} ${PERIOD_LABEL} beklenen · SYV` });
  insertHakedis({ batchId, vehicleId: vCritical, amount: 193000, suffix: "SYV1" });

  const alerts = alertService.detectReconUnderpaymentAlerts();
  const warn = alerts.find((a) => a.vehicleId === vUnder);
  assert(warn, "warning alert");
  assert(warn.severity === "warning", `warn severity ${warn.severity}`);
  assert(warn.type === "RECON_UNDERPAYMENT", "alert type");
  assert(warn.amount === -620, `alert amount ${warn.amount}`);

  const crit = alerts.find((a) => a.vehicleId === vCritical);
  assert(crit, "critical alert");
  assert(crit.severity === "critical", `crit severity ${crit.severity}`);
  assert(Math.abs(crit.amount) > 5000, "critical gap");

  const summary = reconciliationService.getReconciliationSummary(
    reconciliationService.buildReconciliationRows()
  );
  assert(summary.underpaidCount >= 2, "summary underpaid");

  console.log("7) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-recon-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const reconSvc = require("../services/reconciliationService");
  const alertSvc = require("../services/alertService");
  assert(reconSvc.buildReconciliationRows().length === 0, "empty rows");
  assert(alertSvc.detectReconUnderpaymentAlerts().length === 0, "empty alerts");

  console.log("\n✓ FLEETOS-RECON-01 tests passed");
  cleanup();
  try {
    if (fs.existsSync(emptyDb)) fs.unlinkSync(emptyDb);
    fs.rmdirSync(emptyDir);
  } catch (e) {}
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  cleanup();
  process.exit(1);
}
