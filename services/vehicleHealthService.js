const vehicleIntelligenceService = require("./vehicleIntelligenceService");

const WEIGHTS = {
  compliance: 25,
  maintenance: 25,
  tire: 20,
  finance: 20,
  data_quality: 10,
};

const BASE_SCORE = 100;

const HEALTH_STATUS_ORDER = {
  critical: 0,
  risk: 1,
  watch: 2,
  unknown: 3,
  healthy: 4,
};

function clampScore(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasFinanceData(finance = {}) {
  return (finance.total_income || 0) > 0 || (finance.total_expense || 0) > 0;
}

function hasComplianceData(compliance = {}) {
  const total =
    (compliance.active || 0) +
    (compliance.warning || 0) +
    (compliance.critical || 0) +
    (compliance.expired || 0);
  return total > 0;
}

function hasMaintenanceData(maintenance = {}) {
  return (maintenance.total_records || 0) > 0 || ["ok", "upcoming", "due", "overdue"].includes(maintenance.status);
}

function hasTireData(tire = {}) {
  return (tire.total_records || 0) > 0 || ["ready", "attention", "mismatch"].includes(tire.seasonal_status);
}

function hasMeaningfulData(intelligence) {
  const { compliance, maintenance, tire, finance } = intelligence;
  return (
    hasComplianceData(compliance) ||
    hasMaintenanceData(maintenance) ||
    hasTireData(tire) ||
    hasFinanceData(finance)
  );
}

function scoreCompliance(compliance = {}) {
  const weight = WEIGHTS.compliance;
  let penalty = 0;
  let reason = "Uygunluk durumu normal.";

  if ((compliance.expired || 0) > 0) {
    penalty = weight;
    reason = "Süresi geçmiş evrak bulunuyor.";
  } else if ((compliance.critical || 0) > 0 || compliance.status === "critical") {
    penalty = 20;
    reason = "Kritik uygunluk riski var.";
  } else if ((compliance.warning || 0) > 0 || compliance.status === "warning") {
    penalty = 10;
    reason = "Yaklaşan uygunluk uyarısı var.";
  } else if (compliance.status === "unknown") {
    penalty = 8;
    reason = "Uygunluk verisi eksik veya belirsiz.";
  }

  return {
    score: clampScore(weight - penalty),
    weight,
    status: compliance.status || "unknown",
    penalty,
    reason,
  };
}

function scoreMaintenance(maintenance = {}) {
  const weight = WEIGHTS.maintenance;
  let penalty = 0;
  let reason = "Bakım planı uygun.";

  if ((maintenance.overdue || 0) > 0 || maintenance.status === "overdue") {
    penalty = weight;
    reason = "Geciken bakım bulunuyor.";
  } else if ((maintenance.due || 0) > 0 || maintenance.status === "due") {
    penalty = 18;
    reason = "Vadesi gelen bakım var.";
  } else if ((maintenance.upcoming || 0) > 0 || maintenance.status === "upcoming") {
    penalty = 8;
    reason = "Yaklaşan bakım planı var.";
  } else if (maintenance.status === "unknown") {
    penalty = 8;
    reason = "Bakım verisi eksik veya belirsiz.";
  }

  return {
    score: clampScore(weight - penalty),
    weight,
    status: maintenance.status || "unknown",
    penalty,
    reason,
  };
}

function scoreTire(tire = {}) {
  const weight = WEIGHTS.tire;
  let penalty = 0;
  let reason = "Lastik sezon durumu uygun.";

  if (tire.seasonal_status === "mismatch") {
    penalty = weight;
    reason = "Lastik sezon uyumsuzluğu var.";
  } else if (tire.seasonal_status === "attention") {
    penalty = 10;
    reason = "Lastik sezon takibi gerekiyor.";
  } else if (tire.seasonal_status === "unknown") {
    penalty = 6;
    reason = "Lastik verisi eksik veya belirsiz.";
  }

  return {
    score: clampScore(weight - penalty),
    weight,
    status: tire.seasonal_status || "unknown",
    penalty,
    reason,
  };
}

function scoreFinance(finance = {}) {
  const weight = WEIGHTS.finance;
  let penalty = 0;
  let reason = "Finansal durum kârlı.";

  if ((finance.net_profit || 0) < 0) {
    penalty = weight;
    reason = "Araç zarar üretiyor.";
  } else if ((finance.net_profit || 0) === 0 && (finance.total_income || 0) > 0) {
    penalty = 10;
    reason = "Gelir-gider dengesi sıfır.";
  } else if (!hasFinanceData(finance)) {
    penalty = 8;
    reason = "Finans verisi eksik.";
  }

  return {
    score: clampScore(weight - penalty),
    weight,
    status:
      (finance.net_profit || 0) < 0
        ? "loss"
        : hasFinanceData(finance)
          ? (finance.net_profit || 0) > 0
            ? "profit"
            : "neutral"
          : "unknown",
    penalty,
    reason,
  };
}

function scoreDataQuality(intelligence) {
  const weight = WEIGHTS.data_quality;
  let penalty = 0;
  const gaps = [];

  if (!hasComplianceData(intelligence.compliance)) {
    penalty += 3;
    gaps.push("uygunluk");
  }
  if (!hasMaintenanceData(intelligence.maintenance)) {
    penalty += 3;
    gaps.push("bakım");
  }
  if (!hasTireData(intelligence.tire)) {
    penalty += 3;
    gaps.push("lastik");
  }
  if (!hasFinanceData(intelligence.finance)) {
    penalty += 1;
    gaps.push("finans");
  }

  penalty = Math.min(weight, penalty);

  return {
    score: clampScore(weight - penalty),
    weight,
    status: penalty === 0 ? "complete" : penalty >= 8 ? "poor" : "partial",
    penalty,
    reason:
      gaps.length > 0
        ? `Eksik veri alanları: ${gaps.join(", ")}.`
        : "Veri kalitesi yeterli.",
  };
}

function mapHealthStatus(score) {
  if (score == null) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function mapRiskLevel(healthStatus) {
  const map = {
    healthy: "low",
    watch: "medium",
    risk: "high",
    critical: "critical",
    unknown: "unknown",
  };
  return map[healthStatus] || "unknown";
}

function buildTopRisks(breakdown, intelligence) {
  const risks = [];

  if (breakdown.compliance.penalty >= 20) {
    risks.push({ level: "critical", message: breakdown.compliance.reason });
  } else if (breakdown.compliance.penalty > 0) {
    risks.push({ level: breakdown.compliance.penalty >= 10 ? "warning" : "info", message: breakdown.compliance.reason });
  }

  if (breakdown.maintenance.penalty >= 18) {
    risks.push({ level: "critical", message: breakdown.maintenance.reason });
  } else if (breakdown.maintenance.penalty > 0) {
    risks.push({ level: breakdown.maintenance.penalty >= 8 ? "warning" : "info", message: breakdown.maintenance.reason });
  }

  if (breakdown.tire.penalty >= 20) {
    risks.push({ level: "critical", message: breakdown.tire.reason });
  } else if (breakdown.tire.penalty > 0) {
    risks.push({ level: "warning", message: breakdown.tire.reason });
  }

  if (breakdown.finance.penalty >= 20) {
    risks.push({ level: "critical", message: breakdown.finance.reason });
  } else if (breakdown.finance.penalty > 0) {
    risks.push({ level: "warning", message: breakdown.finance.reason });
  }

  if (breakdown.data_quality.penalty >= 6) {
    risks.push({ level: "info", message: breakdown.data_quality.reason });
  }

  (intelligence.signals || []).forEach((signal) => {
    if (risks.length >= 3) return;
    if (!risks.some((r) => r.message === signal.message)) {
      risks.push({ level: signal.level || "info", message: signal.message });
    }
  });

  return risks.slice(0, 3);
}

function buildRecommendation(breakdown, healthStatus) {
  if (healthStatus === "healthy") {
    return "Bu araç kârlı ve operasyonel olarak sağlıklı görünüyor.";
  }

  if (breakdown.compliance.penalty >= 20) {
    return "Bu araç için öncelik: süresi geçmiş evrak kontrolü.";
  }
  if (breakdown.maintenance.penalty >= 18) {
    return "Bu araç için öncelik: geciken bakımın kapatılması.";
  }
  if (breakdown.tire.penalty >= 20) {
    return "Bu araç için lastik sezon uyumsuzluğu kontrol edilmeli.";
  }
  if (breakdown.finance.penalty >= 20) {
    return "Bu araç için öncelik: zarar üreten giderlerin incelenmesi.";
  }
  if (breakdown.data_quality.penalty >= 6) {
    return "Bu araç için veri eksikleri tamamlanmalı.";
  }
  if (healthStatus === "watch") {
    return "Bu araç izleme listesinde; operasyonel sinyaller takip edilmeli.";
  }
  if (healthStatus === "risk") {
    return "Bu araç risk bandında; öncelikli müdahale gerekiyor.";
  }
  if (healthStatus === "critical") {
    return "Bu araç kritik sağlık bandında; acil operasyonel kontrol önerilir.";
  }
  return "Bu araç için veri eksikleri tamamlanmalı.";
}

function calculateVehicleHealth(vehicleIntelligence) {
  if (!vehicleIntelligence) return null;

  const breakdown = {
    compliance: scoreCompliance(vehicleIntelligence.compliance),
    maintenance: scoreMaintenance(vehicleIntelligence.maintenance),
    tire: scoreTire(vehicleIntelligence.tire),
    finance: scoreFinance(vehicleIntelligence.finance),
    data_quality: scoreDataQuality(vehicleIntelligence),
  };

  const totalPenalty =
    breakdown.compliance.penalty +
    breakdown.maintenance.penalty +
    breakdown.tire.penalty +
    breakdown.finance.penalty +
    breakdown.data_quality.penalty;

  const hasData = hasMeaningfulData(vehicleIntelligence);
  const healthScore = hasData ? clampScore(BASE_SCORE - totalPenalty) : null;
  const healthStatus = mapHealthStatus(healthScore);
  const riskLevel = mapRiskLevel(healthStatus);
  const topRisks = buildTopRisks(breakdown, vehicleIntelligence);
  const recommendation = buildRecommendation(breakdown, healthStatus);

  return {
    vehicle_id: String(vehicleIntelligence.vehicle_id),
    plate: vehicleIntelligence.plate,
    health_score: healthScore,
    health_status: healthStatus,
    risk_level: riskLevel,
    breakdown,
    top_risks: topRisks,
    recommendation,
  };
}

function sortHealthVehicles(vehicles) {
  return [...vehicles].sort((a, b) => {
    const aOrder = HEALTH_STATUS_ORDER[a.health_status] ?? 99;
    const bOrder = HEALTH_STATUS_ORDER[b.health_status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aScore = a.health_score == null ? 999 : a.health_score;
    const bScore = b.health_score == null ? 999 : b.health_score;
    if (aScore !== bScore) return aScore - bScore;

    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function vehicleSnapshot(vehicle) {
  return {
    vehicle_id: vehicle.vehicle_id,
    plate: vehicle.plate,
    health_score: vehicle.health_score,
    risk_level: vehicle.risk_level,
  };
}

function buildFleetHealthSummary(vehicles) {
  const scored = vehicles.filter((v) => v.health_score != null);
  const average =
    scored.length > 0
      ? Math.round(scored.reduce((sum, v) => sum + v.health_score, 0) / scored.length)
      : null;

  const highestRisk =
    vehicles.find((v) => v.health_status === "critical" || v.health_status === "risk") ||
    vehicles.find((v) => v.health_score != null) ||
    vehicles[0] ||
    null;

  const bestHealth =
    [...vehicles]
      .filter((v) => v.health_score != null)
      .sort((a, b) => b.health_score - a.health_score)[0] || null;

  return {
    total_vehicles: vehicles.length,
    average_health_score: average,
    healthy: vehicles.filter((v) => v.health_status === "healthy").length,
    watch: vehicles.filter((v) => v.health_status === "watch").length,
    risk: vehicles.filter((v) => v.health_status === "risk").length,
    critical: vehicles.filter((v) => v.health_status === "critical").length,
    unknown: vehicles.filter((v) => v.health_status === "unknown").length,
    highest_risk_vehicle: highestRisk ? vehicleSnapshot(highestRisk) : null,
    best_health_vehicle: bestHealth ? vehicleSnapshot(bestHealth) : null,
  };
}

function buildVehicleHealthReport(vehicleId, options = {}) {
  const intelligence = vehicleIntelligenceService.buildVehicleIntelligence(vehicleId, options);
  if (!intelligence) return null;
  return calculateVehicleHealth(intelligence);
}

function buildFleetVehicleHealthReport(options = {}) {
  const fleet = vehicleIntelligenceService.buildFleetVehicleIntelligence(options);
  const vehicles = sortHealthVehicles(
    (fleet.vehicles || []).map((row) => calculateVehicleHealth(row))
  );

  return {
    reference_date: fleet.reference_date,
    summary: buildFleetHealthSummary(vehicles),
    vehicles,
  };
}

module.exports = {
  WEIGHTS,
  BASE_SCORE,
  calculateVehicleHealth,
  buildVehicleHealthReport,
  buildFleetVehicleHealthReport,
  sortHealthVehicles,
  mapHealthStatus,
  mapRiskLevel,
  scoreCompliance,
  scoreMaintenance,
  scoreTire,
  scoreFinance,
  scoreDataQuality,
};
