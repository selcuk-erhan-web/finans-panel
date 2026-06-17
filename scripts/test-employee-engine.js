/**
 * FLEETOS-HR-01 — personel maliyet merkezi testleri (temp DB)
 * node scripts/test-employee-engine.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-hr-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

function clearModuleCache() {
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes("/lib/db.js") ||
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
const employeeService = require("../services/employeeService");
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
  console.log("1) Personel ekleme…");
  const vehicleId = seedVehicle("16 S 4272");
  const assigned = employeeService.createEmployee({
    full_name: "Ahmet Yılmaz",
    phone: "0532 111 22 33",
    role: "Şoför",
    vehicle_id: vehicleId,
  });
  assert(assigned.id, "employee id");
  assert(assigned.vehicle_id === vehicleId, "vehicle linked");

  console.log("2) Araç eşleştirme…");
  const unassignedEmp = employeeService.createEmployee({
    full_name: "Mehmet Demir",
    role: "Şoför",
  });
  assert(!unassignedEmp.vehicle_id, "unassigned employee");

  console.log("3) Maaş + yol + yıkama maliyeti…");
  assert(parseMoneyInput("45.000,00") === 45000, "parse salary");
  const assignedCost = employeeService.createMonthlyCost({
    employee_id: assigned.id,
    period: PERIOD,
    salary_amount: "45.000,00",
    travel_amount: "3.500,00",
    washing_amount: "1.200,00",
    bonus_amount: "2.000,00",
    advance_amount: "5.000,00",
    deduction_amount: "500,00",
  });
  assert(assignedCost.salary_amount === 45000, "salary");
  assert(assignedCost.travel_amount === 3500, "travel");
  assert(assignedCost.washing_amount === 1200, "washing");

  console.log("4) Toplam maliyet hesabı…");
  assert(
    assignedCost.personnelCost === 45000 + 3500 + 1200 + 2000 - 5000 - 500,
    `personnel cost ${assignedCost.personnelCost}`
  );
  assert(assignedCost.personnelCost === 46200, "expected total");

  console.log("5) Araç kârlılığına yansıma…");
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis Gelirleri', 'service', 120000, 'gelir', '2026-05-15 12:00:00')`
  ).run(vehicleId);

  const row = profitService.getVehicleProfitRows().find((r) => r.vehicleId === vehicleId);
  assert(row, "profit row");
  assert(row.personnelExpense === 46200, `personnel expense ${row.personnelExpense}`);
  assert(row.netProfit === 73800, `net profit ${row.netProfit}`);

  console.log("6) Atanmamış personel gideri…");
  const unassignedCost = employeeService.createMonthlyCost({
    employee_id: unassignedEmp.id,
    period: PERIOD,
    salary_amount: "22.500,00",
  });
  assert(unassignedCost.personnelCost === 22500, "unassigned cost");
  assert(profitService.getUnassignedPersonnelExpense() === 22500, "fleet unassigned");

  console.log("7) PROFIT-03 filo toplam gider…");
  const fleet = profitService.getFleetSummary();
  assert(fleet.unassignedPersonnelExpense === 22500, "summary unassigned");
  assert(fleet.totalExpense === 46200 + 22500, `fleet expense ${fleet.totalExpense}`);
  assert(fleet.totalNet === 120000 - fleet.totalExpense, "fleet net");

  console.log("8) PERSONNEL_UNASSIGNED_COST alert…");
  const alerts = alertService.detectPersonnelUnassignedCostAlerts();
  assert(alerts.length >= 1, "alert count");
  const alert = alerts.find((a) => a.amount === 22500);
  assert(alert, "unassigned alert");
  assert(alert.type === "PERSONNEL_UNASSIGNED_COST", "alert type");
  assert(alert.severity === "warning", "severity");
  assert(alert.message.includes("Mehmet"), alert.message);

  console.log("9) Boş veri — hata yok…");
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-hr-empty-"));
  const emptyDb = path.join(emptyDir, "empty.db");
  process.env.FLEETOS_DB_PATH = emptyDb;
  clearModuleCache();
  require("../lib/db");
  const empSvc = require("../services/employeeService");
  const profitSvc = require("../services/profitService");
  const alertSvc = require("../services/alertService");
  assert(empSvc.listEmployees().length === 0, "empty employees");
  assert(profitSvc.getUnassignedPersonnelExpense() === 0, "empty unassigned");
  assert(alertSvc.detectPersonnelUnassignedCostAlerts().length === 0, "empty alerts");

  console.log("\n✓ FLEETOS-HR-01 tests passed");
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
