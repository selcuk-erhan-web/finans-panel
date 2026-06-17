const db = require("../lib/db");
const { normalizeExpenseSlug } = require("../lib/expenseCategoryMap");
const subcontractorService = require("./subcontractorService");
const employeeService = require("./employeeService");
const payrollAllocationService = require("./payrollAllocationService");

const SLUG = {
  fuel: "yakit",
  hgs: "hgs-ogs",
  maintenance: "bakim-onarim",
};

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function computeProfitMargin(revenue, netProfit) {
  const rev = safeAmount(revenue);
  if (rev <= 0) return null;
  return Math.round((netProfit / rev) * 10000) / 100;
}

function createVehicleRow(vehicle) {
  return {
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    type: vehicle.type || "",
    revenue: 0,
    fuelExpense: 0,
    hgsExpense: 0,
    maintenanceExpense: 0,
    subcontractorExpense: 0,
    personnelExpense: 0,
    payrollAllocatedExpense: 0,
    otherExpense: 0,
    totalExpense: 0,
    netProfit: 0,
    profitMargin: null,
  };
}

function finalizeRow(row) {
  row.totalExpense =
    row.fuelExpense +
    row.hgsExpense +
    row.maintenanceExpense +
    row.subcontractorExpense +
    row.personnelExpense +
    row.payrollAllocatedExpense +
    row.otherExpense;
  row.netProfit = row.revenue - row.totalExpense;
  row.profitMargin = computeProfitMargin(row.revenue, row.netProfit);
  return row;
}

function loadVehicleRows(vehicleFilter = null) {
  let vehicles = db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
  if (vehicleFilter === "Servis") {
    vehicles = vehicles.filter((v) => String(v.type || "").toLowerCase() === "servis");
  } else if (vehicleFilter === "Turizm") {
    vehicles = vehicles.filter((v) => String(v.type || "").toLowerCase() === "turizm");
  }
  const map = new Map();
  vehicles.forEach((v) => map.set(v.id, createVehicleRow(v)));
  return { vehicles, map };
}

function ingestIncome(map) {
  const rows = db
    .prepare(
      `SELECT vehicle_id, amount FROM transactions
       WHERE type = 'income' AND vehicle_id IS NOT NULL`
    )
    .all();

  rows.forEach((r) => {
    const bucket = map.get(Number(r.vehicle_id));
    if (!bucket) return;
    bucket.revenue += safeAmount(r.amount);
  });
}

function ingestFuel(map) {
  const linkedFuelTx = new Set(
    db
      .prepare(
        `SELECT fuel_record_id FROM transactions
         WHERE fuel_record_id IS NOT NULL AND fuel_record_id != ''`
      )
      .all()
      .map((r) => Number(r.fuel_record_id))
  );

  db.prepare(
    `SELECT id, vehicle_id, COALESCE(total_amount, total_cost, 0) AS amt
     FROM fuel_records WHERE vehicle_id IS NOT NULL`
  )
    .all()
    .forEach((r) => {
      if (linkedFuelTx.has(Number(r.id))) return;
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.fuelExpense += safeAmount(r.amt);
    });

  db.prepare(
    `SELECT vehicle_id, amount FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL
       AND (fuel_record_id IS NULL OR fuel_record_id = '')
       AND (category_slug = ? OR category = ?)`
  )
    .all(SLUG.fuel, "Yakıt")
    .forEach((r) => {
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.fuelExpense += safeAmount(r.amount);
    });
}

function ingestHgs(map) {
  db.prepare(
    `SELECT vehicle_id, amount FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL
       AND category_slug = ?`
  )
    .all(SLUG.hgs)
    .forEach((r) => {
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.hgsExpense += safeAmount(r.amount);
    });
}

function ingestMaintenance(map) {
  db.prepare(
    `SELECT vehicle_id, COALESCE(amount, cost, 0) AS amt
     FROM maintenance_records WHERE vehicle_id IS NOT NULL`
  )
    .all()
    .forEach((r) => {
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.maintenanceExpense += safeAmount(r.amt);
    });

  db.prepare(
    `SELECT vehicle_id, amount FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL
       AND category_slug = ?`
  )
    .all(SLUG.maintenance)
    .forEach((r) => {
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.maintenanceExpense += safeAmount(r.amount);
    });
}

function ingestSubcontractor(map) {
  subcontractorService.getPaymentsForProfit().forEach((r) => {
    const bucket = map.get(Number(r.related_vehicle_id));
    if (!bucket) return;
    bucket.subcontractorExpense += safeAmount(r.amount);
  });
}

function getUnassignedSubcontractorExpense() {
  return subcontractorService.getUnassignedPaymentTotal();
}

function ingestPersonnel(map) {
  employeeService.getCostsForProfit().forEach((r) => {
    const bucket = map.get(Number(r.vehicle_id));
    if (!bucket) return;
    bucket.personnelExpense += safeAmount(r.personnelCost);
  });
}

function getUnassignedPersonnelExpense() {
  return employeeService.getUnassignedPersonnelExpense();
}

function getGeneralPayrollAllocationExpense() {
  return payrollAllocationService.getGeneralAllocationTotal();
}

function ingestPayrollAllocations(map) {
  payrollAllocationService.getVehicleAllocationsForProfit().forEach((r) => {
    const bucket = map.get(Number(r.vehicle_id));
    if (!bucket) return;
    bucket.payrollAllocatedExpense += safeAmount(r.amount);
  });
}

function ingestOtherExpenses(map) {
  db.prepare(
    `SELECT vehicle_id, category, category_slug, amount FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL`
  )
    .all()
    .forEach((r) => {
      const slug = normalizeExpenseSlug(r.category_slug || r.category);
      if (slug === SLUG.fuel || slug === SLUG.hgs || slug === SLUG.maintenance) return;
      const bucket = map.get(Number(r.vehicle_id));
      if (!bucket) return;
      bucket.otherExpense += safeAmount(r.amount);
    });
}

function getVehicleProfitRows(options = {}) {
  const filter = options.vehicleType || null;
  const { vehicles, map } = loadVehicleRows(filter);

  ingestIncome(map);
  ingestFuel(map);
  ingestHgs(map);
  ingestMaintenance(map);
  ingestSubcontractor(map);
  ingestPersonnel(map);
  ingestPayrollAllocations(map);
  ingestOtherExpenses(map);

  return vehicles.map((v) => finalizeRow({ ...map.get(v.id) }));
}

function getFleetSummary(rows) {
  const data = rows || getVehicleProfitRows();
  const unassignedSubcontractor = getUnassignedSubcontractorExpense();
  const unassignedPersonnel = getUnassignedPersonnelExpense();
  const generalPayrollAllocation = getGeneralPayrollAllocationExpense();
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const vehicleExpense = data.reduce((s, r) => s + r.totalExpense, 0);
  const totalExpense =
    vehicleExpense + unassignedSubcontractor + unassignedPersonnel + generalPayrollAllocation;
  const totalNet = totalRevenue - totalExpense;
  const avgProfitPerVehicle = data.length
    ? Math.round(data.reduce((s, r) => s + r.netProfit, 0) / data.length)
    : 0;
  const margins = data.filter((r) => r.profitMargin != null).map((r) => r.profitMargin);
  const avgProfitMargin = margins.length
    ? Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 100) / 100
    : null;

  const ranked = sortByNetProfit(data);
  const mostProfitable = ranked[0] || null;
  const leastProfitable = ranked.length ? ranked[ranked.length - 1] : null;

  return {
    totalRevenue,
    totalExpense,
    totalNet,
    unassignedSubcontractorExpense: unassignedSubcontractor,
    unassignedPersonnelExpense: unassignedPersonnel,
    generalPayrollAllocationExpense: generalPayrollAllocation,
    avgProfitPerVehicle,
    avgProfitMargin,
    vehicleCount: data.length,
    mostProfitable,
    leastProfitable,
  };
}

function sortByNetProfit(rows) {
  return [...rows].sort((a, b) => b.netProfit - a.netProfit);
}

function getRankedVehicles(limit = null, options = {}) {
  const rows = sortByNetProfit(getVehicleProfitRows(options));
  const filtered = rows.filter((r) => r.revenue > 0 || r.totalExpense > 0);
  return limit ? filtered.slice(0, limit) : filtered;
}

function hasProfitData(rows) {
  const data = rows || getVehicleProfitRows();
  return data.some((r) => r.revenue > 0 || r.totalExpense > 0);
}

/** Eski profitabilityService uyumluluğu */
function toLegacyRow(row) {
  return {
    vehicleId: row.vehicleId,
    plate: row.plate,
    type: row.type,
    income: row.revenue,
    fuel: row.fuelExpense,
    hgs: row.hgsExpense,
    maintenance: row.maintenanceExpense,
    subcontractor: row.subcontractorExpense,
    personnel: row.personnelExpense,
    payrollAllocated: row.payrollAllocatedExpense,
    other: row.otherExpense,
    totalExpense: row.totalExpense,
    netProfit: row.netProfit,
    profitMargin: row.profitMargin,
    isUnassigned: false,
  };
}

module.exports = {
  SLUG,
  safeAmount,
  computeProfitMargin,
  getVehicleProfitRows,
  getFleetSummary,
  getUnassignedSubcontractorExpense,
  getUnassignedPersonnelExpense,
  getGeneralPayrollAllocationExpense,
  getRankedVehicles,
  sortByNetProfit,
  hasProfitData,
  toLegacyRow,
};
