const profitService = require("./profitService");

function getVehicleProfitability(options = {}) {
  return profitService.getVehicleProfitRows(options).map(profitService.toLegacyRow);
}

function getAssignedRows(rows) {
  return rows.filter((r) => !r.isUnassigned);
}

function summaryFromLegacyRows(legacyRows) {
  const assigned = getAssignedRows(legacyRows);
  const unassignedSub = profitService.getUnassignedSubcontractorExpense();
  const totalIncome = legacyRows.reduce((s, r) => s + r.income, 0);
  const totalExpense = legacyRows.reduce((s, r) => s + r.totalExpense, 0) + unassignedSub;
  const totalNet = totalIncome - totalExpense;
  const avgProfitPerVehicle = assigned.length
    ? Math.round(assigned.reduce((s, r) => s + r.netProfit, 0) / assigned.length)
    : 0;
  const margins = assigned.filter((r) => r.profitMargin != null).map((r) => r.profitMargin);
  const avgProfitMargin = margins.length
    ? Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 100) / 100
    : null;
  const sorted = [...assigned].sort((a, b) => b.netProfit - a.netProfit);
  return {
    totalIncome,
    totalExpense,
    totalNet,
    unassignedSubcontractorExpense: unassignedSub,
    avgProfitPerVehicle,
    avgProfitMargin,
    vehicleCount: assigned.length,
    mostProfitable: sorted[0] || null,
    leastProfitable: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

function getFleetProfitSummary(rows = null) {
  if (rows) return summaryFromLegacyRows(rows);
  const summary = profitService.getFleetSummary();
  return {
    totalIncome: summary.totalRevenue,
    totalExpense: summary.totalExpense,
    totalNet: summary.totalNet,
    unassignedSubcontractorExpense: summary.unassignedSubcontractorExpense,
    avgProfitPerVehicle: summary.avgProfitPerVehicle,
    avgProfitMargin: summary.avgProfitMargin,
    vehicleCount: summary.vehicleCount,
    mostProfitable: summary.mostProfitable
      ? profitService.toLegacyRow(summary.mostProfitable)
      : null,
    leastProfitable: summary.leastProfitable
      ? profitService.toLegacyRow(summary.leastProfitable)
      : null,
  };
}

function getTopProfitableVehicles(limit = 5, rows = null) {
  if (rows) {
    return getAssignedRows(rows)
      .filter((r) => r.income > 0 || r.totalExpense > 0)
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
  }
  return profitService.getRankedVehicles(limit).map(profitService.toLegacyRow);
}

function getMostProfitableVehicle(rows = null) {
  const top = getFleetProfitSummary(rows).mostProfitable;
  if (!top) return { plate: "—", netProfit: null, vehicleId: null };
  return {
    plate: top.plate,
    netProfit: top.netProfit,
    vehicleId: top.vehicleId,
    income: top.income,
    totalExpense: top.totalExpense,
    profitMargin: top.profitMargin,
  };
}

function getLeastProfitableVehicle(rows = null) {
  const worst = getFleetProfitSummary(rows).leastProfitable;
  if (!worst) {
    return { plate: "—", netProfit: null, vehicleId: null, income: 0, totalExpense: 0 };
  }
  return {
    plate: worst.plate,
    netProfit: worst.netProfit,
    vehicleId: worst.vehicleId,
    income: worst.income,
    totalExpense: worst.totalExpense,
    profitMargin: worst.profitMargin,
  };
}

function getHighestFuelVehicle(rows = null) {
  const data = rows || getVehicleProfitability();
  const assigned = getAssignedRows(data)
    .filter((r) => r.fuel > 0)
    .sort((a, b) => b.fuel - a.fuel);
  if (!assigned.length) return { plate: "—", amount: null, vehicleId: null };
  return { plate: assigned[0].plate, amount: assigned[0].fuel, vehicleId: assigned[0].vehicleId };
}

function getHighestHgsVehicle(rows = null) {
  const data = rows || getVehicleProfitability();
  const assigned = getAssignedRows(data)
    .filter((r) => r.hgs > 0)
    .sort((a, b) => b.hgs - a.hgs);
  if (!assigned.length) return { plate: "—", amount: null, vehicleId: null };
  return { plate: assigned[0].plate, amount: assigned[0].hgs, vehicleId: assigned[0].vehicleId };
}

function getFleetExpenseBreakdown(rows = null) {
  const data = rows || getVehicleProfitability();
  return {
    fuel: data.reduce((s, r) => s + r.fuel, 0),
    hgs: data.reduce((s, r) => s + r.hgs, 0),
    maintenance: data.reduce((s, r) => s + r.maintenance, 0),
    subcontractor: data.reduce((s, r) => s + (r.subcontractor || 0), 0),
    other: data.reduce((s, r) => s + r.other, 0),
  };
}

function getDashboardProfitMetrics() {
  const rows = getVehicleProfitability();
  const summary = getFleetProfitSummary(rows);
  const top5 = getTopProfitableVehicles(5, rows);
  const mostProfitable = getMostProfitableVehicle(rows);
  const leastProfitable = getLeastProfitableVehicle(rows);
  const highestFuel = getHighestFuelVehicle(rows);
  const highestHgs = getHighestHgsVehicle(rows);
  const expenseBreakdown = getFleetExpenseBreakdown(rows);
  const hasData = hasSufficientData(rows);

  return {
    rows,
    summary,
    top5,
    ranking: top5,
    mostProfitable,
    leastProfitable,
    highestFuel,
    highestHgs,
    expenseBreakdown,
    hasData,
  };
}

function hasSufficientData(rows = null) {
  const data = rows || getVehicleProfitability();
  return data.some((r) => r.income > 0 || r.totalExpense > 0);
}

module.exports = {
  getVehicleProfitability,
  getFleetProfitSummary,
  getTopProfitableVehicles,
  getMostProfitableVehicle,
  getLeastProfitableVehicle,
  getHighestFuelVehicle,
  getHighestHgsVehicle,
  getFleetExpenseBreakdown,
  getDashboardProfitMetrics,
  hasSufficientData,
};
