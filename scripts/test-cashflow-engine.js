/**
 * FLEETOS-CASHFLOW-01 — nakit akışı ve yükümlülük merkezi testleri (temp DB)
 * node scripts/test-cashflow-engine.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-cashflow-test-"));
let testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/cashflowService") ||
      key.includes("/services/reconciliationService") ||
      key.includes("/services/payrollObligationService") ||
      key.includes("/services/employeeService") ||
      key.includes("/services/subcontractorService") ||
      key.includes("/services/documentService") ||
      key.includes("/services/alertService") ||
      key.includes("/services/profitService")
    ) {
      delete require.cache[key];
    }
  });
}

clearModuleCache();

const db = require("../lib/db");
const cashflowService = require("../services/cashflowService");
const payrollObligationService = require("../services/payrollObligationService");
const employeeService = require("../services/employeeService");
const subcontractorService = require("../services/subcontractorService");
const alertService = require("../services/alertService");
const profitService = require("../services/profitService");

const REF = new Date("2026-07-20T12:00:00");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  } catch (e) {}
}

function useFreshDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  testDbPath = path.join(dir, "test.db");
  process.env.FLEETOS_DB_PATH = testDbPath;
  clearModuleCache();
  return require("../lib/db");
}

function seedPositiveScenario(services) {
  services.db.prepare(
    `INSERT INTO transactions (type, category, category_slug, amount, note, date)
     VALUES ('income', 'Turizm Gelirleri', 'tourism', 1250000, 'Turizm tahsilat', '2026-07-25 12:00:00')`
  ).run();

  services.payroll.createManual({
    obligation_type: "sgk",
    period: "2026-06",
    amount: "500000,00",
    due_date: "2026-08-10",
  });
  services.payroll.createManual({
    obligation_type: "muhtasar",
    period: "2026-06",
    amount: "100000,00",
    due_date: "2026-08-12",
  });

  const emp = services.employee.createEmployee({ full_name: "Maaş Test", role: "Ofis" });
  services.employee.createMonthlyCost({
    employee_id: emp.id,
    period: "2026-07",
    salary_amount: "210000,00",
  });

  const sub = services.subcontractor.createSubcontractor({ name: "Taşeron A" });
  services.subcontractor.createPayment({
    subcontractor_id: sub.id,
    period: "2026-07",
    amount: "100000,00",
    payment_date: "2026-08-15",
  });
}

function seedNegativeScenario() {
  db.prepare(
    `INSERT INTO transactions (type, category, category_slug, amount, note, date)
     VALUES ('income', 'Servis Gelirleri', 'service', 180000, 'KIRPART Temmuz tahsilat', '2026-07-20 12:00:00')`
  ).run();

  payrollObligationService.createManual({
    obligation_type: "sgk",
    period: "2026-04",
    amount: "27.696,00",
    due_date: "2026-07-25",
  });
  payrollObligationService.createManual({
    obligation_type: "muhtasar",
    period: "2026-04",
    amount: "1.940,00",
    due_date: "2026-07-26",
  });

  const emp = employeeService.createEmployee({ full_name: "Personel Maaş", role: "Ofis" });
  employeeService.createMonthlyCost({
    employee_id: emp.id,
    period: "2026-07",
    salary_amount: "380.000,00",
  });

  const sub = subcontractorService.createSubcontractor({ name: "Taşeron B" });
  subcontractorService.createPayment({
    subcontractor_id: sub.id,
    period: "2026-07",
    amount: "120.000,00",
    payment_date: "2026-08-05",
  });
}

function main() {
  console.log("1) Beklenen tahsilat…");
  seedNegativeScenario();
  const receivables = cashflowService.getExpectedReceivables(REF);
  assert(receivables.total === 180000, `receivables ${receivables.total}`);
  assert(receivables.items.length >= 1, "receivable rows");

  console.log("2) Maaş yükü…");
  const obligations = cashflowService.getUpcomingObligations(REF);
  const salaryItems = obligations.groups.personnel;
  assert(salaryItems.length === 1, "salary item");
  assert(salaryItems[0].amount === 380000, `salary ${salaryItems[0].amount}`);
  assert(salaryItems[0].dueDate === "2026-08-05", `salary due ${salaryItems[0].dueDate}`);

  console.log("3) SGK yükü…");
  const sgkItems = obligations.groups.sgk;
  assert(sgkItems.length === 1, "sgk item");
  assert(sgkItems[0].amount === 27696, `sgk ${sgkItems[0].amount}`);

  console.log("4) Muhtasar yükü…");
  const muhtItems = obligations.groups.muhtasar;
  assert(muhtItems.length === 1, "muhtasar item");
  assert(muhtItems[0].amount === 1940, `muhtasar ${muhtItems[0].amount}`);

  console.log("5) Taşeron yükü…");
  const subItems = obligations.groups.subcontractor;
  assert(subItems.length === 1, "subcontractor item");
  assert(subItems[0].amount === 120000, `sub ${subItems[0].amount}`);

  console.log("6) Pozitif nakit…");
  useFreshDb("fleetos-cashflow-pos-");
  const cashflowPos = require("../services/cashflowService");
  seedPositiveScenario({
    db: require("../lib/db"),
    payroll: require("../services/payrollObligationService"),
    employee: require("../services/employeeService"),
    subcontractor: require("../services/subcontractorService"),
  });
  const positive = cashflowPos.getCashflowSummary(REF);
  assert(positive.totalExpectedReceivables === 1250000, `pos recv ${positive.totalExpectedReceivables}`);
  assert(positive.totalUpcomingObligations === 910000, `pos exp ${positive.totalUpcomingObligations}`);
  assert(positive.netExpectedCash === 340000, `pos net ${positive.netExpectedCash}`);

  console.log("7) Negatif nakit…");
  useFreshDb("fleetos-cashflow-neg-");
  const dbNeg = require("../lib/db");
  const payrollSvc = require("../services/payrollObligationService");
  const empSvc = require("../services/employeeService");
  const subSvc = require("../services/subcontractorService");
  const cashflowNeg = require("../services/cashflowService");
  dbNeg.prepare(
    `INSERT INTO transactions (type, category, category_slug, amount, note, date)
     VALUES ('income', 'Servis Gelirleri', 'service', 180000, 'KIRPART Temmuz tahsilat', '2026-07-20 12:00:00')`
  ).run();
  payrollSvc.createManual({ obligation_type: "sgk", period: "2026-04", amount: "27.696,00", due_date: "2026-07-25" });
  payrollSvc.createManual({ obligation_type: "muhtasar", period: "2026-04", amount: "1.940,00", due_date: "2026-07-26" });
  const emp = empSvc.createEmployee({ full_name: "Personel Maaş", role: "Ofis" });
  empSvc.createMonthlyCost({ employee_id: emp.id, period: "2026-07", salary_amount: "380.000,00" });
  const sub = subSvc.createSubcontractor({ name: "Taşeron B" });
  subSvc.createPayment({ subcontractor_id: sub.id, period: "2026-07", amount: "120.000,00", payment_date: "2026-08-05" });
  const negative = cashflowNeg.getCashflowSummary(REF);
  assert(negative.netExpectedCash < 0, `neg net ${negative.netExpectedCash}`);

  console.log("8) CASHFLOW_RISK alert…");
  const critical = cashflowNeg.detectCashflowRiskAlerts(REF).find((a) => a.type === "CASHFLOW_RISK");
  assert(critical?.severity === "critical", "critical cashflow alert");
  assert(critical.amount > 0, "critical amount");

  dbNeg.prepare(
    `INSERT INTO transactions (type, category, category_slug, amount, note, date)
     VALUES ('income', 'Turizm Gelirleri', 'tourism', 900000, 'gec tahsilat', '2026-07-28 12:00:00')`
  ).run();
  const warning = cashflowNeg.detectCashflowRiskAlerts(REF).find(
    (a) => a.type === "CASHFLOW_RISK" && a.severity === "warning"
  );
  assert(warning, "warning cashflow alert");
  const alertSvc = require("../services/alertService");
  assert(typeof alertSvc.detectCashflowRiskAlerts === "function", "alert export");

  console.log("9) Boş veri — hata yok…");
  useFreshDb("fleetos-cashflow-empty-");
  const emptyCashflow = require("../services/cashflowService");
  const emptyProfit = require("../services/profitService");
  const emptySummary = emptyCashflow.getCashflowSummary(REF);
  assert(emptySummary.totalExpectedReceivables === 0, "empty receivables");
  assert(emptySummary.netExpectedCash === 0, "empty net");
  assert(emptyCashflow.detectCashflowRiskAlerts(REF).length === 0, "empty alerts");
  assert(emptyProfit.getFleetSummary().totalNet === 0, "profit untouched");

  console.log("\n✓ FLEETOS-CASHFLOW-01 tests passed");
}

try {
  main();
} catch (err) {
  console.error("\n✗ Test failed:", err.message);
  process.exit(1);
}
