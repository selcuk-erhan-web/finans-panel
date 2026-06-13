const db = require("../lib/db");
const {
  getTotals,
  getAllVehicleSummaries,
  getFleetMonthlyData,
  getRecentExpenses,
  getFleetStatus,
} = require("../lib/finance");
const maintenanceService = require("./maintenanceService");
const fuelService = require("./fuelService");

function getRecentTransactions(limit = 12) {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       ORDER BY t.date DESC LIMIT ?`
    )
    .all(limit);
}

function getTodayTasks() {
  const today = new Date().toISOString().slice(0, 10);
  return maintenanceService
    .getUpcoming(25)
    .filter((m) => m.next_service_date === today || m.status === "overdue");
}

function getUpcomingPayments() {
  return maintenanceService.getUpcoming(10);
}

function getVehicleRanking() {
  const profitabilityService = require("./profitabilityService");
  return profitabilityService.getTopProfitableVehicles(6).map((r) => ({
    id: r.vehicleId,
    plate: r.plate,
    income: r.income,
    expense: r.totalExpense,
    net: r.netProfit,
  }));
}

function getAlerts() {
  const upcoming = maintenanceService.getUpcoming(5);
  const muayeneSigorta = maintenanceService.getUpcomingMuayeneSigorta(5);
  const fuel30 = fuelService.getFleetFuelLast30Days();
  const topFuel = fuelService.getTopFuelVehicle();
  const hgsService = require("./hgsService");
  const expenseCategoryService = require("./expenseCategoryService");
  const incomeCategoryService = require("./incomeCategoryService");
  const hgs = hgsService.getDashboardHgsSummary();
  const expenseOps = expenseCategoryService.getDashboardOpsSummary();
  const incomeByCategory = incomeCategoryService.getDashboardIncomeTotals();
  return {
    hasUpcomingMaintenance: upcoming.length > 0,
    upcomingCount: upcoming.length,
    upcoming,
    muayeneSigorta,
    fuel30,
    topFuel,
    hgs,
    expenseOps,
    incomeByCategory,
  };
}

function getDashboardBundle() {
  const summaries = getAllVehicleSummaries();
  const totals = getTotals();
  const monthly = getFleetMonthlyData(6);
  const alerts = getAlerts();

  return {
    totals,
    fleetStatus: getFleetStatus(totals),
    vehicleCount: db.prepare("SELECT COUNT(*) as c FROM vehicles").get().c,
    monthly,
    recentTransactions: getRecentTransactions(10),
    recentExpenses: getRecentExpenses(6),
    todayTasks: getTodayTasks(),
    upcomingPayments: getUpcomingPayments(),
    vehicleRanking: getVehicleRanking(),
    summaries,
    alerts,
  };
}

module.exports = {
  getDashboardBundle,
  getRecentTransactions,
  getTodayTasks,
  getUpcomingPayments,
  getVehicleRanking,
  getAlerts,
};
