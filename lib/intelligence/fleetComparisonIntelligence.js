const db = require("../db");
const documentService = require("../../services/documentService");
const { getVehicleCenterBundle } = require("../../services/vehicleCenterService");
const { buildVehicleActionIntelligence } = require("./vehicleActionIntelligence");
const { buildPredictiveMaintenanceIntelligence } = require("./predictiveMaintenanceIntelligence");

function resolveProfitabilityNet(bundle) {
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
  let netAmount = useMonthly
    ? monthIncome - monthExpense
    : Number(profit.netProfit ?? bundle.summary?.net ?? 0);
  if (incomeAmount === 0 && expenseAmount > 0) netAmount = -expenseAmount;
  return netAmount;
}

function resolveComplianceRisk(complianceDocs) {
  if (!complianceDocs.length) return 3;
  return complianceDocs.filter((doc) =>
    ["expired", "critical", "warning"].includes(doc.status)
  ).length;
}

function buildFleetComparisonFleet() {
  const vehicles = db.prepare("SELECT id FROM vehicles ORDER BY id ASC").all();
  return vehicles
    .map((row) => {
      const bundle = getVehicleCenterBundle(row.id);
      if (!bundle) return null;
      const complianceDocs = documentService.listByVehicle(row.id);
      const actionIntel = buildVehicleActionIntelligence(bundle, complianceDocs);
      const maintIntel = buildPredictiveMaintenanceIntelligence(bundle);
      return {
        vehicleId: row.id,
        healthScore: actionIntel.score,
        maintenanceScore: maintIntel.score,
        profitability: resolveProfitabilityNet(bundle),
        complianceRisk: resolveComplianceRisk(complianceDocs),
        totalCost: Number(bundle.profit?.totalExpense || 0),
      };
    })
    .filter(Boolean);
}

function rankByMetric(fleet, vehicleId, getter, higherIsBetter = true) {
  if (!fleet.length) return null;
  const sorted = [...fleet].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av === bv) return a.vehicleId - b.vehicleId;
    return higherIsBetter ? bv - av : av - bv;
  });
  const index = sorted.findIndex((row) => row.vehicleId === vehicleId);
  return index >= 0 ? index + 1 : null;
}

function percentileFromRank(rank, fleetSize) {
  if (!rank || !fleetSize || fleetSize <= 1) return 100;
  return Math.round(((fleetSize - rank + 1) / fleetSize) * 100);
}

function normalizeToBar(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 50;
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
}

function complianceToScore(risk, minRisk, maxRisk) {
  if (maxRisk === minRisk) return 100 - risk * 10;
  return Math.round(((maxRisk - risk) / (maxRisk - minRisk)) * 100);
}

function overallComposite(entry, fleet) {
  const healthValues = fleet.map((row) => row.healthScore);
  const profitValues = fleet.map((row) => row.profitability);
  const maintValues = fleet.map((row) => row.maintenanceScore);
  const compValues = fleet.map((row) => row.complianceRisk);

  const profitNorm = normalizeToBar(
    entry.profitability,
    Math.min(...profitValues),
    Math.max(...profitValues)
  );
  const complianceScore = complianceToScore(
    entry.complianceRisk,
    Math.min(...compValues),
    Math.max(...compValues)
  );

  return (
    entry.healthScore * 0.35 +
    profitNorm * 0.25 +
    entry.maintenanceScore * 0.2 +
    complianceScore * 0.2
  );
}

function buildSummary(ranks, fleetSize) {
  const topHalf = Math.ceil(fleetSize / 2);
  const bottomQuarter = Math.floor(fleetSize * 0.75);
  const topQuarter = Math.max(1, Math.ceil(fleetSize * 0.25));
  const topTen = Math.max(1, Math.ceil(fleetSize * 0.1));

  if (ranks.healthRank <= topTen) {
    return "Bu araç filodaki en sağlıklı araçlardan biri.";
  }
  if (ranks.maintenanceRank > bottomQuarter) {
    return "Bu araç öncelikli bakım gerektiriyor.";
  }
  if (ranks.profitabilityRank > topHalf) {
    return "Bu araç finansal olarak filo ortalamasının altında.";
  }
  if (ranks.overallRank > bottomQuarter) {
    return "Bu araç en yüksek risk grubunda.";
  }
  if (ranks.overallRank <= topHalf) {
    return "Bu araç filo ortalamasının üzerinde performans gösteriyor.";
  }
  return "Bu araç filo içinde izlenmeli konumda.";
}

function buildBadges(ranks, fleetSize) {
  const badges = [];
  const bottomQuarter = Math.floor(fleetSize * 0.75);
  const topQuarter = Math.max(1, Math.ceil(fleetSize * 0.25));

  if (percentileFromRank(ranks.overallRank, fleetSize) >= 90) badges.push("İLK %10");
  else if (percentileFromRank(ranks.healthRank, fleetSize) >= 75) badges.push("İLK %25");

  if (ranks.healthRank === 1) badges.push("Sağlık Lideri");
  if (ranks.profitabilityRank === 1) badges.push("Yüksek Kâr");
  if (ranks.profitabilityRank === fleetSize && fleetSize > 1) badges.push("En Düşük Kâr");
  if (ranks.costRank === fleetSize && fleetSize > 1) badges.push("En Yüksek Maliyet");
  if (ranks.maintenanceRank > bottomQuarter) badges.push("Yüksek Bakım Riski");
  if (ranks.complianceRank > bottomQuarter) badges.push("Uygunluk Riski");

  return [...new Set(badges)];
}

function buildRecommendation(ranks, fleetSize, bundle) {
  const bottomQuarter = Math.floor(fleetSize * 0.75);
  const weaknesses = [
    { key: "maintenance", rank: ranks.maintenanceRank, score: ranks.maintenanceRank },
    { key: "compliance", rank: ranks.complianceRank, score: ranks.complianceRank },
    { key: "profitability", rank: ranks.profitabilityRank, score: ranks.profitabilityRank },
    { key: "cost", rank: ranks.costRank, score: ranks.costRank },
  ].sort((a, b) => b.score - a.score);

  const worst = weaknesses[0];
  if (!worst || fleetSize <= 1) return "Normal operasyona devam edin.";

  if (worst.key === "maintenance" && worst.rank > bottomQuarter) {
    return "Bakımı önceliklendirin.";
  }
  if (worst.key === "compliance" && worst.rank > bottomQuarter) {
    return "Uygunluk kayıtlarını tamamlayın.";
  }
  if (worst.key === "profitability" && worst.rank > bottomQuarter) {
    const profit = bundle.profit || {};
    if ((profit.fuel || 0) >= (profit.maintenance || 0) && (profit.fuel || 0) > 0) {
      return "Yakıt giderlerini azaltın.";
    }
    return "Finansal performansı izleyin.";
  }
  if (ranks.overallRank <= Math.ceil(fleetSize / 2)) {
    return "Normal operasyona devam edin.";
  }
  return "Finansal performansı izleyin.";
}

function buildComparisonBars(current, fleet) {
  const avg = (getter) => {
    const values = fleet.map(getter);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  const profitValues = fleet.map((row) => row.profitability);
  const compValues = fleet.map((row) => row.complianceRisk);

  const vehicleProfitBar = normalizeToBar(
    current.profitability,
    Math.min(...profitValues),
    Math.max(...profitValues)
  );
  const fleetProfitBar = normalizeToBar(
    avg((row) => row.profitability),
    Math.min(...profitValues),
    Math.max(...profitValues)
  );

  return {
    health: {
      vehicle: current.healthScore,
      fleet: avg((row) => row.healthScore),
    },
    profitability: {
      vehicle: vehicleProfitBar,
      fleet: fleetProfitBar,
    },
    maintenance: {
      vehicle: current.maintenanceScore,
      fleet: avg((row) => row.maintenanceScore),
    },
    compliance: {
      vehicle: complianceToScore(
        current.complianceRisk,
        Math.min(...compValues),
        Math.max(...compValues)
      ),
      fleet: complianceToScore(
        avg((row) => row.complianceRisk),
        Math.min(...compValues),
        Math.max(...compValues)
      ),
    },
  };
}

function buildFleetComparisonIntelligence(bundle, fleet) {
  const fleetRows = Array.isArray(fleet) && fleet.length ? fleet : buildFleetComparisonFleet();
  const fleetSize = fleetRows.length;
  const vehicleId = bundle.vehicle?.id;

  if (!vehicleId || !fleetSize) {
    return {
      healthRank: null,
      costRank: null,
      maintenanceRank: null,
      complianceRank: null,
      profitabilityRank: null,
      overallRank: null,
      fleetSize: fleetSize || 0,
      healthPercentile: 0,
      profitabilityPercentile: 0,
      summary: "Filo karşılaştırması için yeterli veri yok.",
      recommendation: "Filo kayıtları tamamlandıktan sonra karşılaştırma yapılacak.",
      badges: [],
      bars: {
        health: { vehicle: 0, fleet: 0 },
        profitability: { vehicle: 0, fleet: 0 },
        maintenance: { vehicle: 0, fleet: 0 },
        compliance: { vehicle: 0, fleet: 0 },
      },
    };
  }

  const current =
    fleetRows.find((row) => row.vehicleId === vehicleId) ||
    (() => {
      const complianceDocs = documentService.listByVehicle(vehicleId);
      const actionIntel = buildVehicleActionIntelligence(bundle, complianceDocs);
      const maintIntel = buildPredictiveMaintenanceIntelligence(bundle);
      return {
        vehicleId,
        healthScore: actionIntel.score,
        maintenanceScore: maintIntel.score,
        profitability: resolveProfitabilityNet(bundle),
        complianceRisk: resolveComplianceRisk(complianceDocs),
        totalCost: Number(bundle.profit?.totalExpense || 0),
      };
    })();

  const healthRank = rankByMetric(fleetRows, vehicleId, (row) => row.healthScore, true);
  const maintenanceRank = rankByMetric(fleetRows, vehicleId, (row) => row.maintenanceScore, true);
  const profitabilityRank = rankByMetric(fleetRows, vehicleId, (row) => row.profitability, true);
  const complianceRank = rankByMetric(fleetRows, vehicleId, (row) => row.complianceRisk, false);
  const costRank = rankByMetric(fleetRows, vehicleId, (row) => row.totalCost, false);

  const compositeFleet = fleetRows.map((row) => ({
    ...row,
    composite: overallComposite(row, fleetRows),
  }));
  const overallRank = rankByMetric(compositeFleet, vehicleId, (row) => row.composite, true);

  const ranks = {
    healthRank,
    costRank,
    maintenanceRank,
    complianceRank,
    profitabilityRank,
    overallRank,
  };

  return {
    ...ranks,
    fleetSize,
    healthPercentile: percentileFromRank(healthRank, fleetSize),
    profitabilityPercentile: percentileFromRank(profitabilityRank, fleetSize),
    summary: buildSummary(ranks, fleetSize),
    recommendation: buildRecommendation(ranks, fleetSize, bundle),
    badges: buildBadges(ranks, fleetSize),
    bars: buildComparisonBars(current, fleetRows),
  };
}

module.exports = {
  buildFleetComparisonIntelligence,
  buildFleetComparisonFleet,
  resolveProfitabilityNet,
  resolveComplianceRisk,
  rankByMetric,
  percentileFromRank,
};
