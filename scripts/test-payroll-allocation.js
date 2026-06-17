/**
 * FLEETOS-HR-03 — Personel yük dağıtım motoru testleri (temp DB)
 * node scripts/test-payroll-allocation.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-payroll-alloc-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
      key.includes("/services/payrollObligationService") ||
      key.includes("/services/payrollAllocationService") ||
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
const payrollAllocationService = require("../services/payrollAllocationService");
const employeeService = require("../services/employeeService");
const profitService = require("../services/profitService");
const alertService = require("../services/alertService");
const { normalizePlate } = require("../utils/plate");

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
  console.log("1) SGK obligation oluştur…");
  const obligation = payrollObligationService.createManual({
    obligation_type: "sgk",
    period: "2026-04",
    amount: "30.000,00",
    due_date: "25/05/2026",
    person_count: 3,
  });
  assert(obligation.ok, "obligation ok");
  assert(obligation.row.amount === 30000, `amount ${obligation.row.amount}`);

  console.log("2) 2 araçlı şoför + 1 ofis personeli…");
  const v1 = seedVehicle("16 SYV 16");
  const v2 = seedVehicle("34 ABC 01");
  const driver1 = employeeService.createEmployee({ full_name: "Şoför A", vehicle_id: v1, role: "Şoför" });
  const driver2 = employeeService.createEmployee({ full_name: "Şoför B", vehicle_id: v2, role: "Şoför" });
  const office = employeeService.createEmployee({ full_name: "Ofis Personeli", role: "Ofis" });
  assert(driver1.vehicle_id === v1, "driver1 vehicle");
  assert(!office.vehicle_id, "office no vehicle");

  console.log("3) 30.000 TL SGK dağıt…");
  const alloc = payrollAllocationService.allocateObligation(obligation.row.id);
  assert(alloc.ok, "allocate ok");
  assert(alloc.allocations.length === 3, `rows ${alloc.allocations.length}`);
  assert(alloc.allocations.every((a) => a.amount === 10000), "equal split 10k");

  const vehicleRows = alloc.allocations.filter((a) => a.allocation_type === "vehicle");
  const generalRows = alloc.allocations.filter((a) => a.allocation_type === "general");
  assert(vehicleRows.length === 2, "2 vehicle allocations");
  assert(generalRows.length === 1, "1 general allocation");
  assert(
    vehicleRows.some((a) => a.vehicle_id === v1) && vehicleRows.some((a) => a.vehicle_id === v2),
    "drivers mapped to vehicles"
  );
  assert(alloc.warnings.length === 0, "person_count matches, no warning");

  console.log("4) PROFIT-03 araç kârlılığına payrollAllocatedExpense…");
  const profitRows = profitService.getVehicleProfitRows();
  const row1 = profitRows.find((r) => r.vehicleId === v1);
  const row2 = profitRows.find((r) => r.vehicleId === v2);
  assert(row1.payrollAllocatedExpense === 10000, `v1 payroll ${row1.payrollAllocatedExpense}`);
  assert(row2.payrollAllocatedExpense === 10000, `v2 payroll ${row2.payrollAllocatedExpense}`);
  assert(row1.totalExpense === 10000, "vehicle total includes allocation");

  console.log("5) general allocation filo toplam giderine…");
  const fleet = profitService.getFleetSummary(profitRows);
  assert(fleet.generalPayrollAllocationExpense === 10000, `general ${fleet.generalPayrollAllocationExpense}`);
  assert(fleet.totalExpense === 30000, `fleet expense ${fleet.totalExpense}`);

  console.log("6) Tekrar dağıtım çift sayım yapmaz…");
  payrollAllocationService.allocateObligation(obligation.row.id);
  const afterRealloc = profitService.getVehicleProfitRows();
  assert(
    afterRealloc.find((r) => r.vehicleId === v1).payrollAllocatedExpense === 10000,
    "realloc v1 still 10k"
  );
  assert(
    profitService.getGeneralPayrollAllocationExpense() === 10000,
    "realloc general still 10k"
  );
  const dbCount = db
    .prepare("SELECT COUNT(*) AS c FROM payroll_allocations WHERE obligation_id = ?")
    .get(obligation.row.id).c;
  assert(dbCount === 3, `allocation rows ${dbCount}`);

  console.log("7) Geri alma…");
  payrollAllocationService.revokeAllocation(obligation.row.id);
  assert(!payrollAllocationService.hasAllocation(obligation.row.id), "revoked");
  assert(profitService.getGeneralPayrollAllocationExpense() === 0, "general cleared");
  assert(
    profitService.getVehicleProfitRows().find((r) => r.vehicleId === v1).payrollAllocatedExpense === 0,
    "vehicle cleared"
  );

  console.log("8) PAYROLL_UNALLOCATED_OBLIGATION alert…");
  const alerts = alertService.detectPayrollUnallocatedObligationAlerts();
  const hit = alerts.find((a) => a.type === "PAYROLL_UNALLOCATED_OBLIGATION");
  assert(hit, "alert exists");
  assert(hit.severity === "warning", `severity ${hit.severity}`);
  assert(hit.amount === 30000, `alert amount ${hit.amount}`);
  assert(hit.message.includes("2026-04"), hit.message);
  assert(hit.message.includes("SGK"), hit.message);

  payrollObligationService.markPaid(obligation.row.id);
  const paidAlert = alertService.detectPayrollUnallocatedObligationAlerts().find(
    (a) => a.obligationType === "sgk"
  );
  assert(paidAlert?.severity === "info", "paid obligation info severity");

  console.log("9) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-payroll-alloc-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const allocSvc = require("../services/payrollAllocationService");
  const alertSvc = require("../services/alertService");
  assert(allocSvc.getGlobalAllocationSummary().allocatedTotal === 0, "empty summary");
  assert(allocSvc.getUnallocatedObligations().length === 0, "empty unallocated");
  assert(alertSvc.detectPayrollUnallocatedObligationAlerts().length === 0, "empty alerts");

  console.log("\n✓ FLEETOS-HR-03 tests passed");
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
