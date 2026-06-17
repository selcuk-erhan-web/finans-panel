const db = require("../lib/db");
const { parseMoneyInput, parseMoneyInputRequired } = require("../utils/money");

const SHIFT_TYPES = {
  morning: "Sabah",
  evening: "Akşam",
  both: "İkisi",
};

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function currentMonthKey(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

function shiftLabel(key) {
  return SHIFT_TYPES[key] || key || "—";
}

function listSubcontractors(activeOnly = false) {
  let sql = "SELECT * FROM subcontractors";
  if (activeOnly) sql += " WHERE is_active = 1";
  sql += " ORDER BY name ASC";
  return db.prepare(sql).all();
}

function getSubcontractor(id) {
  return db.prepare("SELECT * FROM subcontractors WHERE id = ?").get(id);
}

function createSubcontractor(data) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Taşeron adı gerekli");
  const info = db
    .prepare(
      `INSERT INTO subcontractors (name, phone, tax_info, note, is_active)
       VALUES (?, ?, ?, ?, 1)`
    )
    .run(name, data.phone || "", data.tax_info || "", data.note || "");
  return getSubcontractor(info.lastInsertRowid);
}

function updateSubcontractor(id, data) {
  const cur = getSubcontractor(id);
  if (!cur) return null;
  const name = String(data.name ?? cur.name).trim();
  if (!name) throw new Error("Taşeron adı gerekli");
  db.prepare(
    `UPDATE subcontractors SET name=?, phone=?, tax_info=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(name, data.phone ?? cur.phone, data.tax_info ?? cur.tax_info, data.note ?? cur.note, id);
  return getSubcontractor(id);
}

function removeSubcontractor(id) {
  db.prepare("UPDATE subcontractors SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    id
  );
  return true;
}

function normalizeAssignment(row) {
  if (!row) return null;
  return {
    ...row,
    shift_label: shiftLabel(row.shift_type),
    monthly_agreed_amount: safeAmount(row.monthly_agreed_amount),
  };
}

function listAssignments(filters = {}) {
  let sql = `SELECT a.*, s.name AS subcontractor_name, v.plate AS related_plate
    FROM subcontractor_assignments a
    JOIN subcontractors s ON s.id = a.subcontractor_id
    LEFT JOIN vehicles v ON v.id = a.related_vehicle_id
    WHERE 1=1`;
  const params = [];
  if (filters.subcontractor_id) {
    sql += " AND a.subcontractor_id = ?";
    params.push(filters.subcontractor_id);
  }
  if (filters.activeOnly) {
    sql += " AND a.is_active = 1 AND s.is_active = 1";
  }
  sql += " ORDER BY a.customer_name ASC, a.route_name ASC, a.id DESC";
  return db.prepare(sql).all(...params).map(normalizeAssignment);
}

function getAssignment(id) {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS subcontractor_name, v.plate AS related_plate
       FROM subcontractor_assignments a
       JOIN subcontractors s ON s.id = a.subcontractor_id
       LEFT JOIN vehicles v ON v.id = a.related_vehicle_id
       WHERE a.id = ?`
    )
    .get(id);
  return normalizeAssignment(row);
}

function createAssignment(data) {
  const subcontractor_id = Number(data.subcontractor_id);
  if (!subcontractor_id) throw new Error("Taşeron seçilmeli");
  const shift_type = SHIFT_TYPES[data.shift_type] ? data.shift_type : "both";
  let monthly = null;
  if (data.monthly_agreed_amount != null && String(data.monthly_agreed_amount).trim() !== "") {
    monthly = parseMoneyInputRequired(data.monthly_agreed_amount, { allowZero: true });
  }
  const related_vehicle_id = data.related_vehicle_id ? Number(data.related_vehicle_id) : null;

  const info = db
    .prepare(
      `INSERT INTO subcontractor_assignments (
        subcontractor_id, customer_name, route_name, shift_type, external_plate,
        related_vehicle_id, monthly_agreed_amount, note, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      subcontractor_id,
      String(data.customer_name || "").trim(),
      String(data.route_name || "").trim(),
      shift_type,
      String(data.external_plate || "").trim(),
      related_vehicle_id,
      monthly,
      data.note || ""
    );
  return getAssignment(info.lastInsertRowid);
}

function normalizePayment(row) {
  if (!row) return null;
  return {
    ...row,
    amount: safeAmount(row.amount),
    is_assigned: isPaymentAssigned(row),
  };
}

function isPaymentAssigned(row) {
  if (!row) return false;
  if (!row.assignment_id) return false;
  return !!row.related_vehicle_id;
}

function listPayments(limit = 50) {
  return db
    .prepare(
      `SELECT p.*, s.name AS subcontractor_name,
              a.customer_name, a.route_name, a.external_plate, a.related_vehicle_id,
              v.plate AS related_plate
       FROM subcontractor_payments p
       JOIN subcontractors s ON s.id = p.subcontractor_id
       LEFT JOIN subcontractor_assignments a ON a.id = p.assignment_id
       LEFT JOIN vehicles v ON v.id = a.related_vehicle_id
       ORDER BY COALESCE(p.payment_date, p.period, p.created_at) DESC, p.id DESC
       LIMIT ?`
    )
    .all(limit)
    .map(normalizePayment);
}

function getPayment(id) {
  const row = db
    .prepare(
      `SELECT p.*, s.name AS subcontractor_name,
              a.customer_name, a.route_name, a.external_plate, a.related_vehicle_id,
              v.plate AS related_plate
       FROM subcontractor_payments p
       JOIN subcontractors s ON s.id = p.subcontractor_id
       LEFT JOIN subcontractor_assignments a ON a.id = p.assignment_id
       LEFT JOIN vehicles v ON v.id = a.related_vehicle_id
       WHERE p.id = ?`
    )
    .get(id);
  return normalizePayment(row);
}

function createPayment(data) {
  const subcontractor_id = Number(data.subcontractor_id);
  if (!subcontractor_id) throw new Error("Taşeron seçilmeli");
  const amount = parseMoneyInputRequired(data.amount);
  const assignment_id = data.assignment_id ? Number(data.assignment_id) : null;
  const period = String(data.period || currentMonthKey()).trim().slice(0, 7);
  const payment_date =
    data.payment_date && String(data.payment_date).trim()
      ? String(data.payment_date).trim().slice(0, 10)
      : null;

  const info = db
    .prepare(
      `INSERT INTO subcontractor_payments (
        subcontractor_id, assignment_id, period, amount, payment_date, invoice_no, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      subcontractor_id,
      assignment_id,
      period,
      amount,
      payment_date,
      data.invoice_no || "",
      data.note || ""
    );
  return getPayment(info.lastInsertRowid);
}

function removePayment(id) {
  db.prepare("DELETE FROM subcontractor_payments WHERE id = ?").run(id);
  return true;
}

function getPaymentsForProfit() {
  return db
    .prepare(
      `SELECT p.amount, a.related_vehicle_id
       FROM subcontractor_payments p
       JOIN subcontractor_assignments a ON a.id = p.assignment_id
       WHERE a.related_vehicle_id IS NOT NULL`
    )
    .all();
}

function getUnassignedPayments() {
  return db
    .prepare(
      `SELECT p.*, s.name AS subcontractor_name,
              a.customer_name, a.route_name, a.external_plate, a.related_vehicle_id,
              v.plate AS related_plate
       FROM subcontractor_payments p
       JOIN subcontractors s ON s.id = p.subcontractor_id
       LEFT JOIN subcontractor_assignments a ON a.id = p.assignment_id
       LEFT JOIN vehicles v ON v.id = a.related_vehicle_id
       WHERE p.assignment_id IS NULL OR a.related_vehicle_id IS NULL
       ORDER BY p.id DESC`
    )
    .all()
    .map(normalizePayment);
}

function getUnassignedPaymentTotal() {
  return getUnassignedPayments().reduce((s, p) => s + safeAmount(p.amount), 0);
}

function getAssignedPaymentTotal(ref = new Date()) {
  const month = currentMonthKey(ref);
  return db
    .prepare(
      `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM subcontractor_payments p
       JOIN subcontractor_assignments a ON a.id = p.assignment_id
       WHERE a.related_vehicle_id IS NOT NULL
         AND (p.period = ? OR substr(COALESCE(p.payment_date, ''), 1, 7) = ?)`
    )
    .get(month, month).total;
}

function getKpiSummary(ref = new Date()) {
  const month = currentMonthKey(ref);
  const activeCount = db.prepare("SELECT COUNT(*) AS c FROM subcontractors WHERE is_active = 1").get().c;
  const monthTotal = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM subcontractor_payments
       WHERE period = ? OR substr(COALESCE(payment_date, ''), 1, 7) = ?`
    )
    .get(month, month).total;
  const assigned = getAssignedPaymentTotal(ref);
  const unassigned = getUnassignedPaymentTotal();

  return {
    activeSubcontractors: activeCount,
    monthPayments: safeAmount(monthTotal),
    assignedExpense: safeAmount(assigned),
    unassignedExpense: safeAmount(unassigned),
  };
}

function buildUnassignedAlertMessage(payment) {
  const label =
    payment.customer_name ||
    payment.subcontractor_name ||
    "Taşeron";
  const { money } = require("../lib/finance");
  return `${label} için ${money(payment.amount)} taşeron gideri araç/hat ile eşleşmemiş.`;
}

module.exports = {
  SHIFT_TYPES,
  shiftLabel,
  listSubcontractors,
  getSubcontractor,
  createSubcontractor,
  updateSubcontractor,
  removeSubcontractor,
  listAssignments,
  getAssignment,
  createAssignment,
  listPayments,
  getPayment,
  createPayment,
  removePayment,
  getPaymentsForProfit,
  getUnassignedPayments,
  getUnassignedPaymentTotal,
  getAssignedPaymentTotal,
  getKpiSummary,
  buildUnassignedAlertMessage,
  isPaymentAssigned,
  currentMonthKey,
};
