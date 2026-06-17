/**
 * FLEETOS-SUBCONTRACTOR-01 — taşeron yönetimi testleri (temp DB)
 * node scripts/test-subcontractor-engine.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-sub-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/subcontractorService") ||
      key.includes("/services/profitService") ||
      key.includes("/services/alertService")
    ) {
      delete require.cache[key];
    }
  });
}

clearModuleCache();

const db = require("../lib/db");
const subcontractorService = require("../services/subcontractorService");
const profitService = require("../services/profitService");
const alertService = require("../services/alertService");
const { parseMoneyInput } = require("../utils/money");
const { normalizePlate } = require("../utils/plate");

const PERIOD = "2026-05";

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

function main() {
  console.log("1) Taşeron ekleme…");
  const sub = subcontractorService.createSubcontractor({
    name: "Başoğlu Taşeron",
    phone: "0532 000 00 00",
    tax_info: "1234567890",
    note: "Akşam servisi",
  });
  assert(sub.id, "subcontractor id");
  assert(sub.name === "Başoğlu Taşeron", "sub name");

  console.log("2) Görev/hat ekleme…");
  const mistur4272 = seedVehicle("16 S 4272");
  const assignment = subcontractorService.createAssignment({
    subcontractor_id: sub.id,
    customer_name: "Başoğlu Lazer",
    route_name: "Akşam Çıkış",
    shift_type: "evening",
    external_plate: "34 ABC 123",
    related_vehicle_id: mistur4272,
    monthly_agreed_amount: "45.000,00",
  });
  assert(assignment.related_vehicle_id === mistur4272, "related vehicle");
  assert(assignment.monthly_agreed_amount === 45000, "monthly amount");

  console.log("3) Hakediş ödeme ekleme…");
  const assignedPayment = subcontractorService.createPayment({
    subcontractor_id: sub.id,
    assignment_id: assignment.id,
    period: PERIOD,
    amount: "38.240,00",
    payment_date: "2026-05-20",
    invoice_no: "FTR-001",
  });
  assert(assignedPayment.amount === 38240, "assigned payment");
  assert(assignedPayment.is_assigned === true, "is assigned");

  console.log("4) Türkçe para formatı parse…");
  assert(parseMoneyInput("22.500,00") === 22500, "parse tr money");
  const unassignedPayment = subcontractorService.createPayment({
    subcontractor_id: sub.id,
    assignment_id: null,
    period: PERIOD,
    amount: "22.500,00",
    note: "Başoğlu Lazer atanmamış",
  });
  assert(unassignedPayment.amount === 22500, "unassigned amount");

  console.log("5) related_vehicle_id → araç kârlılığı…");
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis Gelirleri', 'service', 145000, 'gelir', '2026-05-15 12:00:00')`
  ).run(mistur4272);

  const row = profitService.getVehicleProfitRows().find((r) => r.vehicleId === mistur4272);
  assert(row, "profit row");
  assert(row.subcontractorExpense === 38240, `sub expense ${row.subcontractorExpense}`);
  assert(row.totalExpense === 38240, `total expense ${row.totalExpense}`);
  assert(row.netProfit === 106760, `net ${row.netProfit}`);

  console.log("6) Atanmış / atanmamış raporu…");
  const kpi = subcontractorService.getKpiSummary(new Date("2026-05-15"));
  assert(kpi.assignedExpense === 38240, `assigned kpi ${kpi.assignedExpense}`);
  assert(kpi.unassignedExpense === 22500, `unassigned kpi ${kpi.unassignedExpense}`);

  console.log("7) PROFIT-03 filo toplam gider…");
  const fleet = profitService.getFleetSummary();
  assert(fleet.unassignedSubcontractorExpense === 22500, "fleet unassigned sub");
  assert(fleet.totalExpense === 38240 + 22500, `fleet expense ${fleet.totalExpense}`);
  assert(fleet.totalNet === 145000 - fleet.totalExpense, "fleet net");

  console.log("8) SUBCONTRACTOR_UNASSIGNED_COST alert…");
  const alerts = alertService.detectSubcontractorUnassignedCostAlerts();
  assert(alerts.length >= 1, "alert count");
  const alert = alerts.find((a) => a.amount === 22500);
  assert(alert, "unassigned alert");
  assert(alert.type === "SUBCONTRACTOR_UNASSIGNED_COST", "alert type");
  assert(alert.severity === "warning", "severity");
  assert(alert.message.includes("Başoğlu"), alert.message);

  console.log("9) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-sub-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const subSvc = require("../services/subcontractorService");
  const profitSvc = require("../services/profitService");
  const alertSvc = require("../services/alertService");
  assert(subSvc.listSubcontractors().length === 0, "empty subs");
  assert(profitSvc.getUnassignedSubcontractorExpense() === 0, "empty unassigned");
  assert(alertSvc.detectSubcontractorUnassignedCostAlerts().length === 0, "empty alerts");

  console.log("\n✓ FLEETOS-SUBCONTRACTOR-01 tests passed");
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
