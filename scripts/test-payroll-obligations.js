/**
 * FLEETOS-HR-02 — SGK / Muhtasar yükümlülük testleri (temp DB)
 * node scripts/test-payroll-obligations.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-payroll-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/payrollObligationService") ||
      key.includes("/services/employeeService") ||
      key.includes("/services/profitService") ||
      key.includes("/services/alertService")
    ) {
      delete require.cache[key];
    }
  });
}

clearModuleCache();

const db = require("../lib/db");
const payrollObligationService = require("../services/payrollObligationService");
const employeeService = require("../services/employeeService");
const profitService = require("../services/profitService");
const alertService = require("../services/alertService");
const { normalizePlate } = require("../utils/plate");

const SGK_TEXT = `
SGK TAHAKKUK FİŞİ
AİT OLDUĞU YIL: 2026
AİT OLDUĞU AY: 04
KİŞİ SAYISI: 11
ÖDENECEK NET TUTAR: 27.695,66
BELGE KABUL TARİHİ: 25/05/2026
`;

const MUHTASAR_TEXT = `
GELİR VERGİSİ S. (MUHTASAR)
Vergilendirme Dönemi: 04/2026
TOPLAM: 1.939,70
VADESİ: 26/05/2026
`;

const REF = new Date("2026-05-22T12:00:00");

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
  console.log("1) SGK PDF parse…");
  const sgk = payrollObligationService.parseSgkText(SGK_TEXT);
  assert(sgk.period === "2026-04", `period ${sgk.period}`);
  assert(sgk.person_count === 11, `person ${sgk.person_count}`);
  assert(sgk.amount === 27696, `amount ${sgk.amount}`);
  assert(sgk.due_date === "2026-05-25", `due ${sgk.due_date}`);

  console.log("2) Muhtasar PDF parse…");
  const muht = payrollObligationService.parseMuhtasarText(MUHTASAR_TEXT);
  assert(muht.period === "2026-04", `period ${muht.period}`);
  assert(muht.amount === 1940, `amount ${muht.amount}`);
  assert(muht.due_date === "2026-05-26", `due ${muht.due_date}`);

  console.log("3) Manuel kayıt…");
  const manual = payrollObligationService.createManual({
    obligation_type: "sgk",
    period: "2026-03",
    amount: "10.000,00",
    due_date: "15/04/2026",
    person_count: 8,
  });
  assert(manual.ok, "manual ok");
  assert(manual.row.period === "2026-03", "manual period");

  console.log("4) Mükerrer PDF hash engeli…");
  const imp1 = payrollObligationService.importFromText(SGK_TEXT, "sgk.pdf", "sgk");
  assert(imp1.ok, "import ok");
  const imp2 = payrollObligationService.importFromText(SGK_TEXT, "sgk-copy.pdf", "sgk");
  assert(imp2.duplicate && imp2.duplicateKind === "file_hash", "hash duplicate");

  console.log("5) Ödendi işaretleme…");
  const paid = payrollObligationService.markPaid(imp1.row.id, "2026-05-20");
  assert(paid.status === "paid", "paid status");
  assert(paid.paid_date === "2026-05-20", "paid date");

  console.log("6) Overdue / due soon alert…");
  payrollObligationService.createManual({
    obligation_type: "sgk",
    period: "2026-04",
    amount: "5.000,00",
    due_date: "25/05/2026",
  });
  payrollObligationService.createManual({
    obligation_type: "muhtasar",
    period: "2026-04",
    amount: "1.000,00",
    due_date: "10/05/2026",
  });
  payrollObligationService.createManual({
    obligation_type: "sgk",
    period: "2026-02",
    amount: "2.000,00",
    note: "vade yok",
  });

  const alerts = alertService.detectPayrollObligationDueAlerts(REF);
  const dueSoon = alerts.find((a) => a.daysLeft === 3);
  const overdue = alerts.find((a) => a.obligationType === "muhtasar" && a.message.includes("geçmiş"));
  const noDue = alerts.find((a) => a.severity === "info");
  assert(dueSoon?.severity === "critical", "due soon critical");
  assert(overdue?.severity === "critical", "overdue critical");
  assert(noDue, "no due info alert");

  console.log("7) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-payroll-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const payrollSvc = require("../services/payrollObligationService");
  assert(payrollSvc.listAll().length === 0, "empty list");

  console.log("8) HR-01 personel giderleri etkilenmemeli…");
  process.env.FLEETOS_DB_PATH = testDbPath;
  clearModuleCache();
  const db2 = require("../lib/db");
  const empSvc = require("../services/employeeService");
  const profitSvc = require("../services/profitService");
  const vehicleId = db2
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES ('16 T 1', ?, 'Servis')")
    .run(normalizePlate("16 T 1")).lastInsertRowid;
  const emp = empSvc.createEmployee({ full_name: "Test Şoför", vehicle_id: vehicleId });
  empSvc.createMonthlyCost({
    employee_id: emp.id,
    period: "2026-05",
    salary_amount: "20.000,00",
  });
  const row = profitSvc.getVehicleProfitRows().find((r) => r.vehicleId === vehicleId);
  assert(row.personnelExpense === 20000, `personnel ${row.personnelExpense}`);
  assert(row.subcontractorExpense === 0, "subcontractor untouched");

  console.log("9) PROFIT-03 SGK/Muhtasar dahil edilmemeli…");
  assert(profitSvc.getFleetSummary().totalExpense === 20000, "only personnel in fleet expense");
  assert(typeof row.personnelExpense === "number", "personnel field exists");
  assert(row.payrollObligationExpense == null, "no payroll in profit row");

  console.log("\n✓ FLEETOS-HR-02 tests passed");
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
