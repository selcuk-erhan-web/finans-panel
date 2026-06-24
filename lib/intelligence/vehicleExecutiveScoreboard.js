function formatSignedMoney(n) {
  const amount = Number(n) || 0;
  if (!Number.isFinite(amount)) return "0 TL";
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded).toLocaleString("tr-TR");
  if (rounded < 0) return `-${formatted} TL`;
  return `${formatted} TL`;
}

function complianceRiskyOrMissing(complianceDocs) {
  if (!complianceDocs.length) return true;
  return complianceDocs.some((d) => ["expired", "critical", "warning"].includes(d.status));
}

function tireMissingOrRisky(bundle) {
  const tireMissing = !(bundle.tireStatus?.records || []).length;
  const tireWarn =
    (bundle.tireSeasonalStatus?.alerts || []).length > 0 ||
    bundle.tireSeasonalStatus?.status === "attention" ||
    ["mismatch", "overdue", "critical", "warning"].includes(bundle.tireSeasonalStatus?.status);
  return tireMissing || tireWarn;
}

function maintenanceHighOrCritical(bundle, maintenanceIntel) {
  if (!maintenanceIntel) return false;
  if (["Kritik", "Yüksek Risk"].includes(maintenanceIntel.status)) return true;
  if (!(bundle.maintenanceHistory?.records || []).length) return true;
  return (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue");
}

function operationalDataMissing(bundle, complianceDocs) {
  const gaps = [
    !complianceDocs.length,
    !(bundle.maintenanceHistory?.records || []).length,
    !(bundle.tireStatus?.records || []).length,
    !bundle.hasFinancialData,
  ].filter(Boolean).length;
  return gaps >= 2;
}

function buildCriticalRiskDomains(bundle, complianceDocs, maintenanceIntel) {
  const domains = [];
  const net = bundle.profit?.netProfit ?? bundle.summary?.net ?? 0;

  if (complianceRiskyOrMissing(complianceDocs)) domains.push("Uygunluk");
  if (tireMissingOrRisky(bundle)) domains.push("Lastik");
  if (maintenanceHighOrCritical(bundle, maintenanceIntel)) domains.push("Bakım");
  if (net < 0) domains.push("Finans");
  if (operationalDataMissing(bundle, complianceDocs)) domains.push("Operasyon");

  return domains;
}

function resolveMonthlyProfitability(bundle) {
  const profit = bundle.profit || {};
  const monthly = bundle.monthly || {};
  const incomeSeries = monthly.incomeData || [];
  const expenseSeries = monthly.expenseData || [];
  const hasMonthly = incomeSeries.length > 0;
  const lastIdx = hasMonthly ? incomeSeries.length - 1 : 0;
  const monthIncome = hasMonthly ? Number(incomeSeries[lastIdx] || 0) : 0;
  const monthExpense = hasMonthly ? Number(expenseSeries[lastIdx] || 0) : 0;
  const useMonthly = hasMonthly && (monthIncome > 0 || monthExpense > 0);

  const incomeAmount = useMonthly ? monthIncome : Number(profit.income || 0);
  const expenseAmount = useMonthly ? monthExpense : Number(profit.totalExpense || 0);

  let netAmount = useMonthly ? monthIncome - monthExpense : Number(profit.netProfit ?? bundle.summary?.net ?? 0);
  if (incomeAmount === 0 && expenseAmount > 0) {
    netAmount = -expenseAmount;
  }

  let meta = "İzlenmeli";
  let tone = "warning";
  if (netAmount > 0) {
    meta = "Kârlı";
    tone = "success";
  } else if (netAmount < 0) {
    meta = "Zararda";
    tone = "danger";
  } else if (!bundle.hasFinancialData && incomeAmount === 0 && expenseAmount === 0) {
    meta = "İzlenmeli";
    tone = "neutral";
  }

  return { value: formatSignedMoney(netAmount), meta, tone };
}

function resolveFleetRanking(bundle) {
  const fleetSize = Number(bundle.benchmarks?.vehicleCount) || 0;
  const rank =
    bundle.profitRisk?.fleet_rank ??
    bundle.profitRisk?.rank ??
    bundle.benchmarks?.profitRank ??
    null;

  if (rank != null && fleetSize > 0) {
    return {
      value: `${rank} / ${fleetSize}`,
      meta: "Kârlılık / risk sıralaması",
      tone: "info",
    };
  }

  return {
    value: fleetSize > 0 ? `— / ${fleetSize}` : "— / —",
    meta: "Filo karşılaştırması bekleniyor",
    tone: "neutral",
  };
}

function buildVehicleExecutiveScoreboard(bundle, actionIntel, healthIntel, maintenanceIntel, complianceDocs) {
  const action = actionIntel || {};
  const health = healthIntel || {};
  const maint = maintenanceIntel || {};

  let healthValue = "—";
  let healthMeta = "Veri bekleniyor";
  let healthTone = "neutral";
  if (action.score != null) {
    healthValue = `${action.score} / 100`;
    healthMeta = action.status || "—";
    healthTone = action.tone || "neutral";
  } else if (health.healthScore?.score != null) {
    healthValue = `${health.healthScore.score} / 100`;
    healthMeta = health.healthScore.statusLabel || "—";
    healthTone = health.healthScore.tone || "neutral";
  }

  const riskDomains = buildCriticalRiskDomains(bundle, complianceDocs || [], maint);
  const openTasks =
    (action.criticalActions || []).length +
    (action.financialActions || []).length +
    (action.operationalActions || []).length +
    (maint.riskFactors || []).length;

  const profitability = resolveMonthlyProfitability(bundle);
  const fleetRanking = resolveFleetRanking(bundle);

  const cards = [
    {
      key: "health",
      label: "Araç Sağlığı",
      value: healthValue,
      meta: healthMeta,
      tone: healthTone,
    },
    {
      key: "risk",
      label: "Kritik Risk",
      value: String(riskDomains.length),
      meta: riskDomains.length ? riskDomains.join(" · ") : "Kritik sinyal yok",
      tone: riskDomains.length >= 3 ? "danger" : riskDomains.length > 0 ? "warning" : "success",
    },
    {
      key: "tasks",
      label: "Açık Görev",
      value: String(openTasks),
      meta: "Tamamlanması gereken aksiyon",
      tone: openTasks >= 4 ? "danger" : openTasks > 0 ? "warning" : "success",
    },
    {
      key: "profit",
      label: "Aylık Kârlılık",
      value: profitability.value,
      meta: profitability.meta,
      tone: profitability.tone,
    },
    {
      key: "fleet",
      label: "Filo Sıralaması",
      value: fleetRanking.value,
      meta: fleetRanking.meta,
      tone: fleetRanking.tone,
    },
  ];

  return { cards };
}

module.exports = {
  buildVehicleExecutiveScoreboard,
  buildCriticalRiskDomains,
  resolveMonthlyProfitability,
  resolveFleetRanking,
};
