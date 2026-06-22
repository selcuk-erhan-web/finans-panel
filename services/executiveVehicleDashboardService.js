const vehicleIntelligenceService = require("./vehicleIntelligenceService");
const vehicleHealthService = require("./vehicleHealthService");
const vehicleTimelineService = require("./vehicleTimelineService");
const vehicleProfitRiskService = require("./vehicleProfitRiskService");

const ACTION_PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function safeFleet(call, fallback) {
  try {
    return call();
  } catch {
    return fallback;
  }
}

function scoreSortValue(score) {
  return score == null || !Number.isFinite(score) ? -1 : score;
}

function buildTopPerformers(vehicles, limit = 5) {
  return [...vehicles]
    .filter((v) => (v.profitability?.net_profit || 0) > 0)
    .sort((a, b) => {
      const profitDiff = (b.profitability?.net_profit || 0) - (a.profitability?.net_profit || 0);
      if (profitDiff !== 0) return profitDiff;
      return scoreSortValue(b.risk?.health_score) - scoreSortValue(a.risk?.health_score);
    })
    .slice(0, limit)
    .map((v) => ({
      vehicle_id: v.vehicle_id,
      plate: v.plate,
      net_profit: v.profitability?.net_profit || 0,
      health_score: v.risk?.health_score ?? null,
      category: v.fusion?.category || "unknown",
      priority: v.fusion?.priority || "unknown",
    }));
}

function buildHighestRisk(vehicles, limit = 5) {
  return [...vehicles]
    .filter((v) => {
      const priority = v.fusion?.priority;
      return priority === "urgent" || priority === "high";
    })
    .sort((a, b) => {
      const aPriority = ACTION_PRIORITY_ORDER[a.fusion?.priority] ?? 99;
      const bPriority = ACTION_PRIORITY_ORDER[b.fusion?.priority] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aScore = a.risk?.health_score;
      const bScore = b.risk?.health_score;
      const aHealth = aScore == null ? 999 : aScore;
      const bHealth = bScore == null ? 999 : bScore;
      if (aHealth !== bHealth) return aHealth - bHealth;

      return (a.profitability?.net_profit || 0) - (b.profitability?.net_profit || 0);
    })
    .slice(0, limit)
    .map((v) => ({
      vehicle_id: v.vehicle_id,
      plate: v.plate,
      net_profit: v.profitability?.net_profit || 0,
      health_score: v.risk?.health_score ?? null,
      risk_level: v.risk?.risk_level || "unknown",
      category: v.fusion?.category || "unknown",
      priority: v.fusion?.priority || "unknown",
      recommended_action: v.fusion?.recommended_action || "",
    }));
}

function buildActionPriorities(vehicles, limit = 8) {
  return [...vehicles]
    .filter((v) => {
      const priority = v.fusion?.priority;
      return priority === "urgent" || priority === "high" || priority === "medium";
    })
    .sort((a, b) => {
      const aPriority = ACTION_PRIORITY_ORDER[a.fusion?.priority] ?? 99;
      const bPriority = ACTION_PRIORITY_ORDER[b.fusion?.priority] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aHealth = a.risk?.health_score == null ? 999 : a.risk.health_score;
      const bHealth = b.risk?.health_score == null ? 999 : b.risk.health_score;
      if (aHealth !== bHealth) return aHealth - bHealth;

      return (a.profitability?.net_profit || 0) - (b.profitability?.net_profit || 0);
    })
    .slice(0, limit)
    .map((v) => ({
      vehicle_id: v.vehicle_id,
      plate: v.plate,
      priority: v.fusion?.priority || "unknown",
      decision_label: v.fusion?.decision_label || "",
      recommended_action: v.fusion?.recommended_action || "",
      drivers: (v.drivers || []).slice(0, 3),
    }));
}

function buildFleetDistribution(healthSummary, profitRiskSummary) {
  return {
    health: {
      healthy: Number(healthSummary?.healthy) || 0,
      watch: Number(healthSummary?.watch) || 0,
      risk: Number(healthSummary?.risk) || 0,
      critical: Number(healthSummary?.critical) || 0,
      unknown: Number(healthSummary?.unknown) || 0,
    },
    profit_risk: {
      star: Number(profitRiskSummary?.stars) || 0,
      profitable_risk: Number(profitRiskSummary?.profitable_risk) || 0,
      loss_low_risk: Number(profitRiskSummary?.loss_low_risk) || 0,
      loss_high_risk: Number(profitRiskSummary?.loss_high_risk) || 0,
      neutral: Number(profitRiskSummary?.neutral) || 0,
      unknown: Number(profitRiskSummary?.unknown) || 0,
    },
  };
}

function buildExecutiveInsights({
  summary,
  topPerformers,
  highestRisk,
  fleetDistribution,
}) {
  const insights = [];

  if ((summary.urgent_count || 0) > 0) {
    insights.push({
      level: "critical",
      message: `Filoda acil inceleme gerektiren ${summary.urgent_count} araç bulunuyor.`,
    });
  }

  if (topPerformers.length > 0) {
    insights.push({
      level: "success",
      message: `En yüksek net kâr ${topPerformers[0].plate} aracında.`,
    });
  }

  if (summary.average_health_score != null) {
    insights.push({
      level: summary.average_health_score >= 70 ? "info" : "warning",
      message: `Filo ortalama sağlık skoru ${summary.average_health_score}/100.`,
    });
  }

  if ((summary.high_priority_count || 0) > 0) {
    insights.push({
      level: "warning",
      message: `${summary.high_priority_count} araç yüksek öncelikli takip gerektiriyor.`,
    });
  }

  if ((fleetDistribution.profit_risk.unknown || 0) > 0) {
    insights.push({
      level: "info",
      message: "Veri eksikliği bulunan araçlar karar kalitesini düşürüyor.",
    });
  }

  if ((summary.critical_events || 0) > 0) {
    insights.push({
      level: "critical",
      message: `Son dönemde ${summary.critical_events} kritik operasyon olayı kayıtlı.`,
    });
  }

  if (highestRisk.length > 0 && insights.length < 6) {
    const top = highestRisk[0];
    insights.push({
      level: top.priority === "urgent" ? "critical" : "warning",
      message: `${top.plate} plakalı araç en yüksek risk grubunda.`,
    });
  }

  if ((summary.net_profit || 0) < 0) {
    insights.push({
      level: "warning",
      message: "Filo genelinde net zarar görülüyor; gelir-gider yapısı gözden geçirilmeli.",
    });
  } else if ((summary.net_profit || 0) > 0 && insights.length < 6) {
    insights.push({
      level: "success",
      message: "Filo genelinde pozitif net kâr üretiliyor.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      level: "info",
      message: "Filo zekâsı verileri yüklendi; detaylı analiz için alt modülleri inceleyin.",
    });
  }

  return insights.slice(0, 6);
}

function buildDashboardSummary(healthSummary, profitRiskSummary, timelineSummary) {
  return {
    total_vehicles: Number(profitRiskSummary?.total_vehicles) || Number(healthSummary?.total_vehicles) || 0,
    average_health_score: healthSummary?.average_health_score ?? null,
    total_income: Number(profitRiskSummary?.total_income) || 0,
    total_expense: Number(profitRiskSummary?.total_expense) || 0,
    net_profit: Number(profitRiskSummary?.net_profit) || 0,
    stars: Number(profitRiskSummary?.stars) || 0,
    urgent_count: Number(profitRiskSummary?.urgent_count) || 0,
    high_priority_count: Number(profitRiskSummary?.high_priority_count) || 0,
    critical_health_count: Number(healthSummary?.critical) || 0,
    risk_health_count: Number(healthSummary?.risk) || 0,
    vehicles_with_events: Number(timelineSummary?.vehicles_with_events) || 0,
    critical_events: Number(timelineSummary?.critical_events) || 0,
    warning_events: Number(timelineSummary?.warning_events) || 0,
  };
}

function buildExecutiveVehicleDashboard(options = {}) {
  const intelligenceFleet = safeFleet(
    () => vehicleIntelligenceService.buildFleetVehicleIntelligence(options),
    { reference_date: null, vehicles: [], summary: {} }
  );
  const healthFleet = safeFleet(
    () => vehicleHealthService.buildFleetVehicleHealthReport(options),
    { reference_date: null, summary: {}, vehicles: [] }
  );
  const timelineFleet = safeFleet(
    () => vehicleTimelineService.buildFleetTimelineSummary(options),
    { summary: {}, vehicles: [] }
  );
  const profitRiskFleet = safeFleet(
    () => vehicleProfitRiskService.buildFleetVehicleProfitRisk(options),
    { reference_date: null, summary: {}, vehicles: [] }
  );

  const healthSummary = healthFleet.summary || {};
  const profitRiskSummary = profitRiskFleet.summary || {};
  const timelineSummary = timelineFleet.summary || {};
  const vehicles = profitRiskFleet.vehicles || [];

  const summary = buildDashboardSummary(healthSummary, profitRiskSummary, timelineSummary);
  const topPerformers = buildTopPerformers(vehicles);
  const highestRisk = buildHighestRisk(vehicles);
  const actionPriorities = buildActionPriorities(vehicles);
  const fleetDistribution = buildFleetDistribution(healthSummary, profitRiskSummary);
  const executiveInsights = buildExecutiveInsights({
    summary,
    topPerformers,
    highestRisk,
    fleetDistribution,
  });

  return {
    reference_date:
      profitRiskFleet.reference_date ||
      healthFleet.reference_date ||
      intelligenceFleet.reference_date ||
      null,
    summary,
    top_performers: topPerformers,
    highest_risk: highestRisk,
    action_priorities: actionPriorities,
    fleet_distribution: fleetDistribution,
    executive_insights: executiveInsights,
  };
}

module.exports = {
  ACTION_PRIORITY_ORDER,
  buildTopPerformers,
  buildHighestRisk,
  buildActionPriorities,
  buildFleetDistribution,
  buildExecutiveInsights,
  buildExecutiveVehicleDashboard,
};
