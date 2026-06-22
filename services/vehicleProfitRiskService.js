const db = require("../lib/db");
const vehicleIntelligenceService = require("./vehicleIntelligenceService");
const vehicleHealthService = require("./vehicleHealthService");
const vehicleTimelineService = require("./vehicleTimelineService");

const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  unknown: 3,
  low: 4,
};

const FUSION_COPY = {
  star: {
    decision_label: "Kârlı ve Sağlıklı Araç",
    executive_summary: "Bu araç hem kârlı hem de operasyonel olarak sağlıklı görünüyor.",
    recommended_action: "Mevcut hatta/işte korunması önerilir.",
  },
  profitable_risk: {
    decision_label: "Kârlı ama Riskli Araç",
    executive_summary:
      "Bu araç kâr üretiyor ancak bakım, evrak veya lastik riski yükselmiş.",
    recommended_action: "Kârlılığı korumak için risk kalemleri öncelikli kapatılmalı.",
  },
  loss_low_risk: {
    decision_label: "Zarar Eden ama Operasyonel Olarak Temiz Araç",
    executive_summary:
      "Bu araç operasyonel olarak sorunlu görünmüyor ancak finansal performansı zayıf.",
    recommended_action: "Gelir-gider yapısı ve çalıştığı hat/iş yeniden değerlendirilmeli.",
  },
  loss_high_risk: {
    decision_label: "Zarar Eden ve Riskli Araç",
    executive_summary: "Bu araç hem finansal zarar üretiyor hem de operasyonel risk taşıyor.",
    recommended_action: "Acil yönetim incelemesine alınmalı.",
  },
  neutral: {
    decision_label: "İzleme Gerektiren Araç",
    executive_summary: "Bu araç için karar vermek adına daha fazla veri veya takip gerekiyor.",
    recommended_action: "Veri girişleri tamamlanmalı ve kısa dönem izlenmeli.",
  },
  unknown: {
    decision_label: "Veri Eksik",
    executive_summary: "Bu araç için yeterli finans veya operasyon verisi bulunmuyor.",
    recommended_action:
      "Gelir, gider, bakım, lastik ve evrak verileri tamamlanmalı.",
  },
};

function safeGetVehicle(vehicleId) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) return null;
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) || null;
}

function computeProfitMargin(totalIncome, netProfit) {
  const income = Number(totalIncome) || 0;
  if (income <= 0) return null;
  return Math.round((netProfit / income) * 10000) / 100;
}

function computeProfitStatus(finance = {}) {
  const income = Number(finance.total_income) || 0;
  const expense = Number(finance.total_expense) || 0;
  const net = Number(finance.net_profit) || 0;

  if (income === 0 && expense === 0) return "unknown";
  if (net > 0) return "profitable";
  if (net === 0 && income > 0) return "break_even";
  if (net < 0) return "loss";
  return "unknown";
}

function isLowRisk(riskLevel) {
  return riskLevel === "low" || riskLevel === "medium";
}

function isHighRisk(riskLevel) {
  return riskLevel === "high" || riskLevel === "critical";
}

function hasInsufficientData(profitStatus, healthScore, riskLevel) {
  return profitStatus === "unknown" && healthScore == null && riskLevel === "unknown";
}

function determineFusionCategory(profitStatus, profitMargin, riskLevel) {
  if (hasInsufficientData(profitStatus, null, riskLevel) && profitStatus === "unknown") {
    if (riskLevel === "unknown") return "unknown";
  }

  if (profitStatus === "unknown" && riskLevel === "unknown") return "unknown";

  if (profitStatus === "break_even") return "neutral";

  if (profitStatus === "profitable") {
    if (isHighRisk(riskLevel)) return "profitable_risk";
    const marginOk = profitMargin != null && profitMargin >= 30;
    if (marginOk && isLowRisk(riskLevel)) return "star";
    return "neutral";
  }

  if (profitStatus === "loss") {
    if (isHighRisk(riskLevel)) return "loss_high_risk";
    if (isLowRisk(riskLevel)) return "loss_low_risk";
    return riskLevel === "unknown" ? "neutral" : "loss_high_risk";
  }

  return "neutral";
}

function determinePriority(category, riskLevel) {
  if (category === "unknown") return "unknown";
  if (category === "loss_high_risk" || riskLevel === "critical") return "urgent";
  if (category === "profitable_risk" || category === "loss_low_risk" || riskLevel === "high") {
    return "high";
  }
  if (category === "neutral" || riskLevel === "medium") return "medium";
  if (category === "star" || riskLevel === "low") return "low";
  return "unknown";
}

function countSignals(signals, level) {
  return (signals || []).filter((s) => s.level === level).length;
}

function buildProfitability(intelligence) {
  const finance = intelligence?.finance || {};
  const totalIncome = Number(finance.total_income) || 0;
  const totalExpense = Number(finance.total_expense) || 0;
  const netProfit = Number(finance.net_profit) || 0;
  const profitStatus = computeProfitStatus(finance);

  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: netProfit,
    profit_margin: computeProfitMargin(totalIncome, netProfit),
    profit_status: profitStatus,
  };
}

function buildRisk(intelligence, health, timeline) {
  const signals = intelligence?.signals || [];
  const timelineSummary = timeline?.summary || {};

  return {
    health_score: health?.health_score ?? null,
    risk_level: health?.risk_level || "unknown",
    critical_signals: countSignals(signals, "critical"),
    warning_signals: countSignals(signals, "warning"),
    critical_timeline_events: Number(timelineSummary.critical_events) || 0,
    warning_timeline_events: Number(timelineSummary.warning_events) || 0,
  };
}

function buildDrivers(profitability, risk, intelligence, health) {
  const drivers = [];

  if (profitability.profit_status === "profitable") {
    drivers.push({ type: "profit", level: "success", message: "Araç kâr üretiyor." });
  } else if (profitability.profit_status === "loss") {
    drivers.push({ type: "profit", level: "critical", message: "Araç zarar ediyor." });
  } else if (profitability.profit_status === "break_even") {
    drivers.push({ type: "profit", level: "warning", message: "Araç gelir-gider dengesinde." });
  } else {
    drivers.push({ type: "finance", level: "info", message: "Finans verisi eksik." });
  }

  if (risk.health_score != null && risk.health_score < 70) {
    drivers.push({
      type: "risk",
      level: risk.health_score < 40 ? "critical" : "warning",
      message: "Araç sağlık skoru düşük.",
    });
  }

  if (risk.critical_signals > 0 || risk.critical_timeline_events > 0) {
    drivers.push({
      type: "risk",
      level: "critical",
      message: "Kritik operasyonel sinyal mevcut.",
    });
  }

  const compliance = intelligence?.compliance;
  if (
    compliance &&
    (compliance.expired > 0 || compliance.critical > 0 || compliance.status === "critical")
  ) {
    drivers.push({
      type: "compliance",
      level: "critical",
      message: "Bakım / evrak / lastik riski kârlılığı tehdit ediyor.",
    });
  } else if (intelligence?.maintenance?.overdue > 0 || intelligence?.maintenance?.status === "overdue") {
    drivers.push({
      type: "maintenance",
      level: "critical",
      message: "Geciken bakım kârlılığı tehdit ediyor.",
    });
  } else if (intelligence?.tire?.seasonal_status === "mismatch") {
    drivers.push({
      type: "tire",
      level: "critical",
      message: "Lastik sezon riski kârlılığı tehdit ediyor.",
    });
  } else if (risk.warning_signals > 0 || risk.warning_timeline_events > 0) {
    drivers.push({
      type: "risk",
      level: "warning",
      message: "Operasyonel uyarı sinyalleri mevcut.",
    });
  }

  if (health?.breakdown?.data_quality?.penalty >= 6) {
    drivers.push({ type: "data", level: "info", message: "Operasyon verisi eksik." });
  }

  const unique = [];
  const seen = new Set();
  drivers.forEach((driver) => {
    const key = driver.message;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(driver);
  });

  return unique.slice(0, 6);
}

function buildFusionBlock(category, priority) {
  const copy = FUSION_COPY[category] || FUSION_COPY.unknown;
  return {
    category,
    priority,
    decision_label: copy.decision_label,
    executive_summary: copy.executive_summary,
    recommended_action: copy.recommended_action,
  };
}

function buildVehicleProfitRiskFromContext(vehicleId, plate, intelligence, health, timeline) {
  const profitability = buildProfitability(intelligence);
  const risk = buildRisk(intelligence, health, timeline);

  let category = determineFusionCategory(
    profitability.profit_status,
    profitability.profit_margin,
    risk.risk_level
  );

  if (
    hasInsufficientData(
      profitability.profit_status,
      risk.health_score,
      risk.risk_level
    )
  ) {
    category = "unknown";
  }

  const priority = determinePriority(category, risk.risk_level);
  const fusion = buildFusionBlock(category, priority);
  const drivers = buildDrivers(profitability, risk, intelligence, health);

  return {
    vehicle_id: String(vehicleId),
    plate,
    profitability,
    risk,
    fusion,
    drivers,
  };
}

function buildVehicleProfitRisk(vehicleId, options = {}) {
  const vehicle = safeGetVehicle(vehicleId);
  if (!vehicle) return null;

  const intelligence = vehicleIntelligenceService.buildVehicleIntelligence(vehicle.id, options);
  if (!intelligence) return null;

  const health = vehicleHealthService.calculateVehicleHealth(intelligence);
  const timeline = vehicleTimelineService.buildVehicleTimeline(vehicle.id, options);

  return buildVehicleProfitRiskFromContext(vehicle.id, vehicle.plate, intelligence, health, timeline);
}

function sortProfitRiskVehicles(vehicles) {
  return [...vehicles].sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.fusion?.priority] ?? 99;
    const bPriority = PRIORITY_ORDER[b.fusion?.priority] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;

    if (a.profitability.net_profit !== b.profitability.net_profit) {
      return a.profitability.net_profit - b.profitability.net_profit;
    }

    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function buildFleetSummary(vehicles) {
  const margins = vehicles
    .map((v) => v.profitability.profit_margin)
    .filter((m) => m != null && Number.isFinite(m));

  return {
    total_vehicles: vehicles.length,
    stars: vehicles.filter((v) => v.fusion.category === "star").length,
    profitable_risk: vehicles.filter((v) => v.fusion.category === "profitable_risk").length,
    loss_low_risk: vehicles.filter((v) => v.fusion.category === "loss_low_risk").length,
    loss_high_risk: vehicles.filter((v) => v.fusion.category === "loss_high_risk").length,
    neutral: vehicles.filter((v) => v.fusion.category === "neutral").length,
    unknown: vehicles.filter((v) => v.fusion.category === "unknown").length,
    total_income: vehicles.reduce((sum, v) => sum + (v.profitability.total_income || 0), 0),
    total_expense: vehicles.reduce((sum, v) => sum + (v.profitability.total_expense || 0), 0),
    net_profit: vehicles.reduce((sum, v) => sum + (v.profitability.net_profit || 0), 0),
    average_profit_margin:
      margins.length > 0
        ? Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 100) / 100
        : null,
    urgent_count: vehicles.filter((v) => v.fusion.priority === "urgent").length,
    high_priority_count: vehicles.filter((v) => v.fusion.priority === "high").length,
  };
}

function buildFleetVehicleProfitRisk(options = {}) {
  const intelligenceFleet = vehicleIntelligenceService.buildFleetVehicleIntelligence(options);
  const healthFleet = vehicleHealthService.buildFleetVehicleHealthReport(options);

  const healthById = new Map(
    (healthFleet.vehicles || []).map((row) => [String(row.vehicle_id), row])
  );

  const vehicles = (intelligenceFleet.vehicles || []).map((intelligence) => {
    const vehicleId = intelligence.vehicle_id;
    const health =
      healthById.get(String(vehicleId)) ||
      vehicleHealthService.calculateVehicleHealth(intelligence);
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleId, options);
    return buildVehicleProfitRiskFromContext(
      vehicleId,
      intelligence.plate,
      intelligence,
      health,
      timeline
    );
  });

  const sorted = sortProfitRiskVehicles(vehicles);

  return {
    reference_date: intelligenceFleet.reference_date,
    summary: buildFleetSummary(sorted),
    vehicles: sorted,
  };
}

module.exports = {
  PRIORITY_ORDER,
  FUSION_COPY,
  computeProfitMargin,
  computeProfitStatus,
  determineFusionCategory,
  determinePriority,
  buildProfitability,
  buildRisk,
  buildDrivers,
  buildVehicleProfitRiskFromContext,
  buildVehicleProfitRisk,
  buildFleetVehicleProfitRisk,
  sortProfitRiskVehicles,
};
