const db = require("../lib/db");
const payrollObligationService = require("./payrollObligationService");
const { money } = require("../lib/finance");

const BASIS_LABELS = {
  equal_active_employee: "Aktif personel eşit pay",
  manual: "Manuel",
  driver_only: "Sadece şoför",
};

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function splitAmount(total, count) {
  const amt = safeAmount(total);
  if (!count || count <= 0) return [];
  const base = Math.floor(amt / count);
  let remainder = amt - base * count;
  const shares = Array(count).fill(base);
  for (let i = 0; i < remainder; i++) shares[i] += 1;
  return shares;
}

function listActiveEmployees() {
  return db
    .prepare(
      `SELECT e.*, v.plate AS vehicle_plate
       FROM employees e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       WHERE e.is_active = 1
       ORDER BY e.full_name ASC`
    )
    .all();
}

function normalizeAllocation(row) {
  if (!row) return null;
  return {
    ...row,
    amount: safeAmount(row.amount),
    basis_label: BASIS_LABELS[row.basis] || row.basis,
  };
}

function listByObligation(obligationId) {
  return db
    .prepare(
      `SELECT a.*, e.full_name, v.plate AS vehicle_plate,
              o.obligation_type, o.period AS obligation_period
       FROM payroll_allocations a
       LEFT JOIN employees e ON e.id = a.employee_id
       LEFT JOIN vehicles v ON v.id = a.vehicle_id
       LEFT JOIN payroll_obligations o ON o.id = a.obligation_id
       WHERE a.obligation_id = ?
       ORDER BY a.allocation_type ASC, e.full_name ASC`
    )
    .all(obligationId)
    .map(normalizeAllocation);
}

function listAll(limit = 200) {
  return db
    .prepare(
      `SELECT a.*, e.full_name, v.plate AS vehicle_plate,
              o.obligation_type, o.period AS obligation_period, o.amount AS obligation_amount
       FROM payroll_allocations a
       LEFT JOIN employees e ON e.id = a.employee_id
       LEFT JOIN vehicles v ON v.id = a.vehicle_id
       LEFT JOIN payroll_obligations o ON o.id = a.obligation_id
       ORDER BY a.period DESC, a.id DESC
       LIMIT ?`
    )
    .all(limit)
    .map(normalizeAllocation);
}

function hasAllocation(obligationId) {
  const hit = db
    .prepare("SELECT id FROM payroll_allocations WHERE obligation_id = ? LIMIT 1")
    .get(obligationId);
  return !!hit;
}

function deleteByObligation(obligationId) {
  db.prepare("DELETE FROM payroll_allocations WHERE obligation_id = ?").run(obligationId);
}

function allocateObligation(obligationId) {
  const obligation = payrollObligationService.getById(obligationId);
  if (!obligation) throw new Error("Tahakkuk kaydı bulunamadı.");

  const employees = listActiveEmployees();
  if (!employees.length) throw new Error("Dağıtım için aktif personel bulunamadı.");

  const warnings = [];
  if (
    obligation.person_count != null &&
    Number(obligation.person_count) > 0 &&
    Number(obligation.person_count) !== employees.length
  ) {
    warnings.push(
      `Tahakkuktaki kişi sayısı (${obligation.person_count}) ile aktif personel (${employees.length}) uyuşmuyor.`
    );
  }

  deleteByObligation(obligationId);

  const shares = splitAmount(obligation.amount, employees.length);
  const insert = db.prepare(
    `INSERT INTO payroll_allocations (
      obligation_id, employee_id, vehicle_id, period, allocation_type, amount, basis, note
    ) VALUES (?, ?, ?, ?, ?, ?, 'equal_active_employee', ?)`
  );

  const allocations = [];
  employees.forEach((emp, idx) => {
    const amount = shares[idx] || 0;
    const allocation_type = emp.vehicle_id ? "vehicle" : "general";
    const info = insert.run(
      obligationId,
      emp.id,
      emp.vehicle_id || null,
      obligation.period,
      allocation_type,
      amount,
      `${obligation.type_label} ${obligation.period} · ${emp.full_name}`
    );
    allocations.push(
      normalizeAllocation({
        id: info.lastInsertRowid,
        obligation_id: obligationId,
        employee_id: emp.id,
        vehicle_id: emp.vehicle_id,
        period: obligation.period,
        allocation_type,
        amount,
        basis: "equal_active_employee",
        full_name: emp.full_name,
        vehicle_plate: emp.vehicle_plate,
      })
    );
  });

  return {
    ok: true,
    obligation,
    allocations,
    warnings,
    summary: getAllocationSummaryForObligation(obligationId),
  };
}

function revokeAllocation(obligationId) {
  const obligation = payrollObligationService.getById(obligationId);
  if (!obligation) throw new Error("Tahakkuk kaydı bulunamadı.");
  deleteByObligation(obligationId);
  return { ok: true, obligationId };
}

function getAllocationSummaryForObligation(obligationId) {
  const obligation = payrollObligationService.getById(obligationId);
  if (!obligation) return null;
  const rows = listByObligation(obligationId);
  const vehicleTotal = rows
    .filter((r) => r.allocation_type === "vehicle")
    .reduce((s, r) => s + r.amount, 0);
  const generalTotal = rows
    .filter((r) => r.allocation_type === "general")
    .reduce((s, r) => s + r.amount, 0);
  const allocatedTotal = vehicleTotal + generalTotal;
  const ratio =
    obligation.amount > 0 ? Math.round((allocatedTotal / obligation.amount) * 10000) / 100 : 0;

  return {
    obligationId,
    obligationAmount: obligation.amount,
    vehicleTotal,
    generalTotal,
    allocatedTotal,
    ratio,
    rowCount: rows.length,
  };
}

function getGlobalAllocationSummary() {
  const obligations = payrollObligationService.listAll();
  const allocatedIds = new Set(
    db.prepare("SELECT DISTINCT obligation_id FROM payroll_allocations").all().map((r) => r.obligation_id)
  );
  const unallocated = obligations.filter((o) => !allocatedIds.has(o.id));
  const allocated = obligations.filter((o) => allocatedIds.has(o.id));

  const vehicleTotal = safeAmount(
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payroll_allocations WHERE allocation_type = 'vehicle'`
    ).get().total
  );
  const generalTotal = safeAmount(
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payroll_allocations WHERE allocation_type = 'general'`
    ).get().total
  );
  const obligationTotal = obligations.reduce((s, o) => s + safeAmount(o.amount), 0);
  const allocatedObligationTotal = allocated.reduce((s, o) => s + safeAmount(o.amount), 0);

  return {
    totalObligationAmount: obligationTotal,
    allocatedObligationAmount: allocatedObligationTotal,
    vehicleTotal,
    generalTotal,
    allocatedTotal: vehicleTotal + generalTotal,
    ratio:
      allocatedObligationTotal > 0
        ? Math.round(((vehicleTotal + generalTotal) / allocatedObligationTotal) * 10000) / 100
        : 0,
    unallocated,
    allocated,
  };
}

function getUnallocatedObligations() {
  return db
    .prepare(
      `SELECT o.* FROM payroll_obligations o
       WHERE NOT EXISTS (
         SELECT 1 FROM payroll_allocations a WHERE a.obligation_id = o.id
       )
       AND o.status IN ('pending', 'paid', 'overdue')
       ORDER BY o.period DESC, o.id DESC`
    )
    .all()
    .map((r) => payrollObligationService.getById(r.id));
}

function getVehicleAllocationsForProfit() {
  return db
    .prepare(
      `SELECT vehicle_id, COALESCE(SUM(amount), 0) AS amount
       FROM payroll_allocations
       WHERE allocation_type = 'vehicle' AND vehicle_id IS NOT NULL
       GROUP BY vehicle_id`
    )
    .all()
    .map((r) => ({ vehicle_id: r.vehicle_id, amount: safeAmount(r.amount) }));
}

function getGeneralAllocationTotal() {
  return safeAmount(
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payroll_allocations WHERE allocation_type = 'general'`
    ).get().total
  );
}

function buildUnallocatedAlertMessage(obligation) {
  const label = obligation.type_label || obligation.obligation_type;
  return `${obligation.period} ${label} tahakkuku kârlılığa dağıtılmamış.`;
}

function alertSeverityForUnallocated(obligation) {
  if (obligation.status === "paid") return "info";
  return "warning";
}

module.exports = {
  BASIS_LABELS,
  splitAmount,
  listActiveEmployees,
  listByObligation,
  listAll,
  hasAllocation,
  allocateObligation,
  revokeAllocation,
  getAllocationSummaryForObligation,
  getGlobalAllocationSummary,
  getUnallocatedObligations,
  getVehicleAllocationsForProfit,
  getGeneralAllocationTotal,
  buildUnallocatedAlertMessage,
  alertSeverityForUnallocated,
};
