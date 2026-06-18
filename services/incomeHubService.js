const db = require("../lib/db");
const { getFleetMonthlyData } = require("../lib/finance");
const incomeCategoryService = require("./incomeCategoryService");
const cashflowService = require("./cashflowService");

function getRecentIncome(limit = 8) {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.type = 'income'
       ORDER BY t.date DESC LIMIT ?`
    )
    .all(limit);
}

function getIncomeDashboardBundle() {
  const totals = incomeCategoryService.getDashboardIncomeTotals();
  const monthly = getFleetMonthlyData(6);
  const recent = getRecentIncome(8);
  const receivables = cashflowService.getExpectedReceivables();
  const grandTotal = totals.service + totals.tourism + totals.other;

  return {
    totals,
    grandTotal,
    monthly: {
      labels: monthly.labels,
      incomeData: monthly.incomeData,
    },
    recent,
    receivables,
  };
}

module.exports = { getIncomeDashboardBundle, getRecentIncome };
