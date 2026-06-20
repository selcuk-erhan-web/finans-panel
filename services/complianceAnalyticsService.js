const complianceStatusService = require("./complianceStatusService");
const documentService = require("./documentService");

const STATUS_ORDER = {
  expired: 0,
  critical: 1,
  warning: 2,
  active: 3,
  unknown: 4,
};

const RENEWAL_STATUSES = new Set(["warning", "critical", "expired"]);

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function fleetHealthStatusFromScore(score) {
  if (score == null || !Number.isFinite(score)) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function fleetHealthLabel(status) {
  const labels = {
    healthy: "Healthy",
    watch: "Watch",
    risk: "Risk",
    critical: "Critical",
    unknown: "Unknown",
  };
  return labels[status] || status;
}

function averageFleetScore(vehicleScores) {
  const numeric = (vehicleScores || [])
    .map((row) => row.score)
    .filter((score) => score != null && Number.isFinite(score));

  if (!numeric.length) return null;
  return Math.round(numeric.reduce((sum, score) => sum + score, 0) / numeric.length);
}

function buildVehicleRiskRanking(records, vehicleScores, referenceDate) {
  const grouped = new Map();

  for (const row of records || []) {
    if (!grouped.has(row.vehicle_id)) {
      grouped.set(row.vehicle_id, {
        vehicle_id: String(row.vehicle_id),
        plate: row.plate || "—",
        warning_count: 0,
        critical_count: 0,
        expired_count: 0,
      });
    }
    const bucket = grouped.get(row.vehicle_id);
    if (row.status === "warning") bucket.warning_count += 1;
    if (row.status === "critical") bucket.critical_count += 1;
    if (row.status === "expired") bucket.expired_count += 1;
    if (row.plate) bucket.plate = row.plate;
  }

  const scoreMap = new Map(
    (vehicleScores || []).map((row) => [String(row.vehicle_id), row])
  );

  const ranking = [...grouped.values()].map((row) => {
    const scoreRow = scoreMap.get(String(row.vehicle_id));
    const risk_count = row.warning_count + row.critical_count + row.expired_count;
    return {
      vehicle_id: row.vehicle_id,
      plate: row.plate,
      score: scoreRow?.score ?? null,
      status: scoreRow?.status || "unknown",
      risk_count,
      expired_count: row.expired_count,
      critical_count: row.critical_count,
      warning_count: row.warning_count,
    };
  });

  return ranking.sort((a, b) => {
    const statusA = STATUS_ORDER[a.status] ?? 99;
    const statusB = STATUS_ORDER[b.status] ?? 99;
    if (statusA !== statusB) return statusA - statusB;

    const scoreA = a.score != null ? a.score : 9999;
    const scoreB = b.score != null ? b.score : 9999;
    if (scoreA !== scoreB) return scoreA - scoreB;

    return String(a.plate).localeCompare(String(b.plate), "tr");
  });
}

function buildDocumentTypeDistribution(records) {
  const grouped = new Map();

  for (const row of records || []) {
    const key = row.document_type || "unknown";
    if (!grouped.has(key)) {
      grouped.set(key, {
        document_type: key,
        type_label: row.type_label || documentService.typeLabel(key),
        total: 0,
        active: 0,
        warning: 0,
        critical: 0,
        expired: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.total += 1;
    if (Object.prototype.hasOwnProperty.call(bucket, row.status)) {
      bucket[row.status] += 1;
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const riskA = a.expired * 100 + a.critical * 10 + a.warning;
    const riskB = b.expired * 100 + b.critical * 10 + b.warning;
    if (riskB !== riskA) return riskB - riskA;
    return String(a.type_label).localeCompare(String(b.type_label), "tr");
  });
}

function buildUpcomingRenewals(records) {
  return (records || [])
    .filter((row) => RENEWAL_STATUSES.has(row.status))
    .sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 99;
      const statusB = STATUS_ORDER[b.status] ?? 99;
      if (statusA !== statusB) return statusA - statusB;

      const daysA = a.days_remaining != null ? a.days_remaining : 9999;
      const daysB = b.days_remaining != null ? b.days_remaining : 9999;
      if (daysA !== daysB) return daysA - daysB;

      return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
    })
    .slice(0, 20)
    .map((row) => ({
      vehicle_id: String(row.vehicle_id),
      plate: row.plate || "—",
      document_type: row.document_type,
      type_label: row.type_label || documentService.typeLabel(row.document_type),
      expiration_date: row.expiry_date,
      days_remaining: row.days_remaining,
      status: row.status,
    }));
}

function buildInsights(health, vehicleRanking, typeDistribution) {
  const insights = [];

  const expiredVehicles = vehicleRanking.filter((row) => row.expired_count > 0).length;
  const criticalVehicles = vehicleRanking.filter((row) => row.critical_count > 0).length;
  const warningVehicles = vehicleRanking.filter((row) => row.warning_count > 0).length;

  if (expiredVehicles > 0) {
    insights.push({
      level: "critical",
      message: `${expiredVehicles} araçta süresi dolmuş uygunluk belgesi var.`,
    });
  }

  if (criticalVehicles > 0) {
    insights.push({
      level: "critical",
      message: `${criticalVehicles} araçta 30 gün içinde bitecek kritik uygunluk belgesi var.`,
    });
  }

  if (warningVehicles > 0) {
    insights.push({
      level: "warning",
      message: `${warningVehicles} araçta 60 gün içinde bitecek uygunluk belgesi var.`,
    });
  }

  const topRiskType = [...typeDistribution].sort((a, b) => {
    const riskA = a.expired * 100 + a.critical * 10 + a.warning;
    const riskB = b.expired * 100 + b.critical * 10 + b.warning;
    return riskB - riskA;
  })[0];

  if (topRiskType && topRiskType.expired + topRiskType.critical + topRiskType.warning > 0) {
    insights.push({
      level: topRiskType.expired > 0 ? "critical" : topRiskType.critical > 0 ? "critical" : "warning",
      message: `${topRiskType.type_label} en yüksek riskli belge kategorisi.`,
    });
  }

  if (health.fleet_health_status === "healthy") {
    insights.push({
      level: "info",
      message: "Filo uygunluk sağlığı iyi durumda.",
    });
  } else if (health.fleet_health_status === "watch") {
    insights.push({
      level: "info",
      message: "Filo uygunluk sağlığı izlenmeli.",
    });
  } else if (health.fleet_health_status === "risk") {
    insights.push({
      level: "warning",
      message: "Filo uygunluk sağlığı risk bölgesinde.",
    });
  } else if (health.fleet_health_status === "critical") {
    insights.push({
      level: "critical",
      message: "Filo uygunluk sağlığı kritik seviyede.",
    });
  } else if (health.total_documents === 0) {
    insights.push({
      level: "info",
      message: "Analiz için henüz uygunluk belgesi kaydı yok.",
    });
  }

  if (!insights.length) {
    insights.push({
      level: "info",
      message: "Uygunluk analitiği için yeterli veri bulunmuyor.",
    });
  }

  return insights;
}

function buildComplianceAnalytics(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const report = complianceStatusService.buildStatusReport(ref);
  const records = (report.records || []).filter((row) => row.status !== "unknown");
  const datedRecords = records.filter((row) => row.expiry_date);
  const summary = complianceStatusService.summarizeRecords(datedRecords);
  const fleetHealthScore = averageFleetScore(report.vehicle_scores);
  const fleetHealthStatus = fleetHealthStatusFromScore(fleetHealthScore);

  const health = {
    total_documents: datedRecords.length,
    active: summary.active,
    warning: summary.warning,
    critical: summary.critical,
    expired: summary.expired,
    fleet_health_score: fleetHealthScore,
    fleet_health_status: fleetHealthStatus,
    fleet_health_label: fleetHealthLabel(fleetHealthStatus),
  };

  const vehicle_risk_ranking = buildVehicleRiskRanking(datedRecords, report.vehicle_scores, ref);
  const document_type_distribution = buildDocumentTypeDistribution(datedRecords);
  const upcoming_renewals = buildUpcomingRenewals(datedRecords);
  const insights = buildInsights(health, vehicle_risk_ranking, document_type_distribution);

  return {
    reference_date: ref.toISOString().slice(0, 10),
    health,
    vehicle_risk_ranking,
    document_type_distribution,
    upcoming_renewals,
    insights,
  };
}

module.exports = {
  STATUS_ORDER,
  fleetHealthStatusFromScore,
  fleetHealthLabel,
  buildComplianceAnalytics,
};
