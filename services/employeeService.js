const db = require("../lib/db");
const { parseMoneyInput, parseMoneyInputRequired } = require("../utils/money");

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function currentMonthKey(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

function parseOptionalMoney(value, fallback = 0) {
  if (value == null || String(value).trim() === "") return fallback;
  const n = parseMoneyInput(value);
  if (n == null || n < 0) throw new Error("Tutar geçerli değil");
  return Math.round(n);
}

function computePersonnelCost(row) {
  return (
    safeAmount(row.salary_amount) +
    safeAmount(row.travel_amount) +
    safeAmount(row.washing_amount) +
    safeAmount(row.bonus_amount) -
    safeAmount(row.advance_amount) -
    safeAmount(row.deduction_amount)
  );
}

function normalizeCostRow(row) {
  if (!row) return null;
  const personnelCost = computePersonnelCost(row);
  return {
    ...row,
    salary_amount: safeAmount(row.salary_amount),
    travel_amount: safeAmount(row.travel_amount),
    washing_amount: safeAmount(row.washing_amount),
    bonus_amount: safeAmount(row.bonus_amount),
    advance_amount: safeAmount(row.advance_amount),
    deduction_amount: safeAmount(row.deduction_amount),
    personnelCost,
  };
}

function listEmployees(activeOnly = false) {
  let sql = `SELECT e.*, v.plate AS vehicle_plate
    FROM employees e
    LEFT JOIN vehicles v ON v.id = e.vehicle_id`;
  if (activeOnly) sql += " WHERE e.is_active = 1";
  sql += " ORDER BY e.full_name ASC";
  return db.prepare(sql).all();
}

function getEmployee(id) {
  const row = db
    .prepare(
      `SELECT e.*, v.plate AS vehicle_plate
       FROM employees e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       WHERE e.id = ?`
    )
    .get(id);
  return row || null;
}

function createEmployee(data) {
  const full_name = String(data.full_name || "").trim();
  if (!full_name) throw new Error("Personel adı gerekli");
  const vehicle_id = data.vehicle_id ? Number(data.vehicle_id) : null;

  const info = db
    .prepare(
      `INSERT INTO employees (full_name, phone, role, vehicle_id, note, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(full_name, data.phone || "", data.role || "Şoför", vehicle_id, data.note || "");
  return getEmployee(info.lastInsertRowid);
}

function updateEmployee(id, data) {
  const cur = getEmployee(id);
  if (!cur) return null;
  const full_name = String(data.full_name ?? cur.full_name).trim();
  if (!full_name) throw new Error("Personel adı gerekli");
  const vehicle_id =
    data.vehicle_id !== undefined
      ? data.vehicle_id
        ? Number(data.vehicle_id)
        : null
      : cur.vehicle_id;

  db.prepare(
    `UPDATE employees SET full_name=?, phone=?, role=?, vehicle_id=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(full_name, data.phone ?? cur.phone, data.role ?? cur.role, vehicle_id, data.note ?? cur.note, id);
  return getEmployee(id);
}

function listMonthlyCosts(limit = 50) {
  return db
    .prepare(
      `SELECT c.*, e.full_name, e.role, e.vehicle_id, v.plate AS vehicle_plate
       FROM employee_monthly_costs c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       ORDER BY c.period DESC, c.id DESC
       LIMIT ?`
    )
    .all(limit)
    .map(normalizeCostRow);
}

function getMonthlyCost(id) {
  const row = db
    .prepare(
      `SELECT c.*, e.full_name, e.role, e.vehicle_id, v.plate AS vehicle_plate
       FROM employee_monthly_costs c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       WHERE c.id = ?`
    )
    .get(id);
  return normalizeCostRow(row);
}

function createMonthlyCost(data) {
  const employee_id = Number(data.employee_id);
  if (!employee_id) throw new Error("Personel seçilmeli");
  const period = String(data.period || currentMonthKey()).trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Dönem YYYY-MM formatında olmalı");

  const payload = {
    salary_amount: parseOptionalMoney(data.salary_amount, 0),
    travel_amount: parseOptionalMoney(data.travel_amount, 0),
    washing_amount: parseOptionalMoney(data.washing_amount, 0),
    bonus_amount: parseOptionalMoney(data.bonus_amount, 0),
    advance_amount: parseOptionalMoney(data.advance_amount, 0),
    deduction_amount: parseOptionalMoney(data.deduction_amount, 0),
  };

  const info = db
    .prepare(
      `INSERT INTO employee_monthly_costs (
        employee_id, period, salary_amount, travel_amount, washing_amount,
        bonus_amount, advance_amount, deduction_amount, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      employee_id,
      period,
      payload.salary_amount,
      payload.travel_amount,
      payload.washing_amount,
      payload.bonus_amount,
      payload.advance_amount,
      payload.deduction_amount,
      data.note || ""
    );
  return getMonthlyCost(info.lastInsertRowid);
}

function removeMonthlyCost(id) {
  db.prepare("DELETE FROM employee_monthly_costs WHERE id = ?").run(id);
  return true;
}

function getCostsForProfit() {
  return db
    .prepare(
      `SELECT e.vehicle_id,
              (COALESCE(c.salary_amount,0) + COALESCE(c.travel_amount,0) + COALESCE(c.washing_amount,0)
               + COALESCE(c.bonus_amount,0) - COALESCE(c.advance_amount,0) - COALESCE(c.deduction_amount,0)) AS personnelCost
       FROM employee_monthly_costs c
       JOIN employees e ON e.id = c.employee_id
       WHERE e.vehicle_id IS NOT NULL`
    )
    .all()
    .map((r) => ({ vehicle_id: r.vehicle_id, personnelCost: safeAmount(r.personnelCost) }));
}

function getUnassignedCostRows() {
  return db
    .prepare(
      `SELECT c.*, e.full_name, e.role, e.vehicle_id, v.plate AS vehicle_plate
       FROM employee_monthly_costs c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       WHERE e.vehicle_id IS NULL
       ORDER BY c.period DESC, c.id DESC`
    )
    .all()
    .map(normalizeCostRow);
}

function getUnassignedPersonnelExpense() {
  return getUnassignedCostRows().reduce((s, r) => s + r.personnelCost, 0);
}

function getMonthPersonnelTotal(ref = new Date()) {
  const month = currentMonthKey(ref);
  const rows = db
    .prepare(
      `SELECT salary_amount, travel_amount, washing_amount, bonus_amount, advance_amount, deduction_amount
       FROM employee_monthly_costs WHERE period = ?`
    )
    .all(month);
  return rows.reduce((s, r) => s + computePersonnelCost(r), 0);
}

function getKpiSummary(ref = new Date()) {
  const activeEmployees = db.prepare("SELECT COUNT(*) AS c FROM employees WHERE is_active = 1").get().c;
  const assignedEmployees = db
    .prepare("SELECT COUNT(*) AS c FROM employees WHERE is_active = 1 AND vehicle_id IS NOT NULL")
    .get().c;
  const unassignedEmployees = db
    .prepare("SELECT COUNT(*) AS c FROM employees WHERE is_active = 1 AND vehicle_id IS NULL")
    .get().c;

  return {
    activeEmployees,
    monthPersonnelCost: safeAmount(getMonthPersonnelTotal(ref)),
    assignedEmployees,
    unassignedEmployees,
  };
}

function buildUnassignedAlertMessage(costRow) {
  const { money } = require("../lib/finance");
  const name = costRow.full_name || "Personel";
  return `${name} için ${money(costRow.personnelCost)} personel gideri araç ile eşleşmemiş.`;
}

module.exports = {
  computePersonnelCost,
  currentMonthKey,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  listMonthlyCosts,
  getMonthlyCost,
  createMonthlyCost,
  removeMonthlyCost,
  getCostsForProfit,
  getUnassignedCostRows,
  getUnassignedPersonnelExpense,
  getMonthPersonnelTotal,
  getKpiSummary,
  buildUnassignedAlertMessage,
};
