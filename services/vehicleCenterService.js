const db = require("../lib/db");
const { normalizeIncomeSlug } = require("../lib/incomeCategoryMap");
const { getVehicleFinance, getVehicleMonthlyData, vehicleStatus, safeAmount } = require("../lib/finance");
const profitService = require("./profitService");
const profitabilityService = require("./profitabilityService");
const fuelService = require("./fuelService");
const maintenanceService = require("./maintenanceService");
const documentService = require("./documentService");
const alertService = require("./alertService");

function getIncomeBreakdown(vehicleId) {
  const rows = db
    .prepare(
      `SELECT category_slug, category, amount FROM transactions
       WHERE vehicle_id = ? AND type = 'income'`
    )
    .all(vehicleId);
  const totals = { service: 0, tourism: 0, other: 0 };
  rows.forEach((r) => {
    const slug = normalizeIncomeSlug(r.category_slug || r.category);
    if (Object.prototype.hasOwnProperty.call(totals, slug)) totals[slug] += safeAmount(r.amount);
    else totals.other += safeAmount(r.amount);
  });
  return totals;
}

function getVehicleProfit(vehicleId, vehicle) {
  const rows = profitService.getVehicleProfitRows();
  const row = rows.find((r) => r.vehicleId === Number(vehicleId));
  if (row) return profitService.toLegacyRow(row);
  return profitService.toLegacyRow({
    vehicleId: Number(vehicleId),
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
  });
}

function getHgsByVehicle(vehicleId, limit = 6) {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.vehicle_id = ? AND t.type = 'expense' AND t.category_slug = 'hgs-ogs'
       ORDER BY t.date DESC, t.id DESC LIMIT ?`
    )
    .all(vehicleId, limit);
}

function getFleetBenchmarks() {
  const rows = profitService.getVehicleProfitRows();
  const legacy = rows.map(profitService.toLegacyRow);
  const summary = profitabilityService.getFleetProfitSummary(legacy);
  const avgExpense =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.totalExpense, 0) / rows.length)
      : 0;
  return {
    avgNetProfit: summary.avgProfitPerVehicle,
    avgExpense,
    vehicleCount: summary.vehicleCount,
    avgMargin: summary.avgProfitMargin,
  };
}

function getVehicleCenterBundle(vehicleId) {
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  if (!vehicle) return null;

  const finance = getVehicleFinance(vehicleId);
  const incomeBySlug = getIncomeBreakdown(vehicleId);
  const profit = getVehicleProfit(vehicleId, vehicle);
  const monthly = getVehicleMonthlyData(vehicleId, 6);
  const fuelStats = fuelService.vehicleStats(vehicleId);
  const maintenance = maintenanceService.listByVehicle(vehicleId);
  const upcomingMaintenance = maintenance
    .filter((m) => m.status === "upcoming" || m.status === "overdue")
    .slice(0, 6);
  const documents = documentService
    .listByVehicle(vehicleId)
    .filter((d) => d.status !== "ok" && d.status !== "no_date")
    .slice(0, 6);
  const hgsRecords = getHgsByVehicle(vehicleId, 6);

  const incomes = db
    .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'income' ORDER BY date DESC`)
    .all(vehicleId);
  const expenses = db
    .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'expense' ORDER BY date DESC`)
    .all(vehicleId);

  const recentTransactions = [...incomes, ...expenses]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 10);

  const alerts = alertService
    .getCorporateAlerts()
    .filter((a) => Number(a.vehicleId) === Number(vehicleId));

  const summary = {
    ...vehicle,
    income: profit.income,
    expense: profit.totalExpense,
    net: profit.netProfit,
  };
  const status = vehicleStatus(summary);
  const benchmarks = getFleetBenchmarks();

  const hasFinancialData = profit.income > 0 || profit.totalExpense > 0;

  return {
    vehicle,
    summary,
    status,
    finance,
    incomeBySlug,
    profit,
    monthly,
    fuelStats,
    maintenance,
    upcomingMaintenance,
    documents,
    hgsRecords,
    recentTransactions,
    alerts,
    benchmarks,
    hasFinancialData,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
  };
}

module.exports = {
  getVehicleCenterBundle,
  getIncomeBreakdown,
  getVehicleProfit,
  getFleetBenchmarks,
};
