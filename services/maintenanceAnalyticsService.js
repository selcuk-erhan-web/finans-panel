const maintenanceService = require("./maintenanceService");
const maintenanceSchedulerService = require("./maintenanceSchedulerService");

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function maintenanceHealthStatusFromScore(score) {
  if (score == null || !Number.isFinite(score)) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function maintenanceHealthLabel(status) {
  const labels = {
    healthy: "Sağlıklı",
    watch: "İzleme",
    risk: "Risk",
    critical: "Kritik",
    unknown: "Bilinmiyor",
  };
  return labels[status] || status;
}

function computeMaintenanceHealthScore(riskSummary) {
  const overdue = Number(riskSummary?.overdue || 0);
  const due = Number(riskSummary?.due || 0);
  const upcoming = Number(riskSummary?.upcoming || 0);
  const totalTracked =
    overdue + due + upcoming + Number(riskSummary?.ok || 0) + Number(riskSummary?.unknown || 0);

  if (totalTracked === 0) return null;

  const score = 100 - overdue * 25 - due * 15 - upcoming * 5;
  return Math.max(0, Math.min(100, score));
}

function buildVehicleCostRanking(records, schedules) {
  const scheduleByVehicle = new Map();

  for (const row of schedules || []) {
    const key = String(row.vehicle_id);
    if (!scheduleByVehicle.has(key)) {
      scheduleByVehicle.set(key, {
        overdue_count: 0,
        due_count: 0,
        upcoming_count: 0,
      });
    }
    const bucket = scheduleByVehicle.get(key);
    if (row.status === "overdue") bucket.overdue_count += 1;
    else if (row.status === "due") bucket.due_count += 1;
    else if (row.status === "upcoming") bucket.upcoming_count += 1;
  }

  const grouped = new Map();
  for (const row of records || []) {
    const key = String(row.vehicle_id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        vehicle_id: key,
        plate: row.plate || "—",
        record_count: 0,
        total_cost: 0,
        last_maintenance_date: null,
        last_odometer_km: null,
      });
    }
    const bucket = grouped.get(key);
    bucket.record_count += 1;
    bucket.total_cost += Number(row.cost || 0);
    if (row.plate) bucket.plate = row.plate;
    if (
      !bucket.last_maintenance_date ||
      String(row.maintenance_date || "") > String(bucket.last_maintenance_date)
    ) {
      bucket.last_maintenance_date = row.maintenance_date || null;
      bucket.last_odometer_km = row.odometer_km ?? null;
    }
  }

  return [...grouped.values()]
    .map((row) => {
      const sched = scheduleByVehicle.get(row.vehicle_id) || {
        overdue_count: 0,
        due_count: 0,
        upcoming_count: 0,
      };
      return {
        vehicle_id: row.vehicle_id,
        plate: row.plate,
        record_count: row.record_count,
        total_cost: row.total_cost,
        average_cost: row.record_count > 0 ? Math.round(row.total_cost / row.record_count) : 0,
        last_maintenance_date: row.last_maintenance_date,
        last_odometer_km: row.last_odometer_km,
        overdue_count: sched.overdue_count,
        due_count: sched.due_count,
        upcoming_count: sched.upcoming_count,
      };
    })
    .sort((a, b) => {
      if (b.total_cost !== a.total_cost) return b.total_cost - a.total_cost;
      if (b.overdue_count !== a.overdue_count) return b.overdue_count - a.overdue_count;
      if (b.due_count !== a.due_count) return b.due_count - a.due_count;
      return String(a.plate).localeCompare(String(b.plate), "tr");
    });
}

function buildMaintenanceTypeDistribution(records) {
  const grouped = new Map();

  for (const row of records || []) {
    const key = row.maintenance_type || "unknown";
    if (!grouped.has(key)) {
      grouped.set(key, {
        maintenance_type: key,
        maintenance_type_label:
          row.maintenance_type_label || maintenanceService.typeLabel(key),
        record_count: 0,
        total_cost: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.record_count += 1;
    bucket.total_cost += Number(row.cost || 0);
  }

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      average_cost: row.record_count > 0 ? Math.round(row.total_cost / row.record_count) : 0,
    }))
    .sort((a, b) => {
      if (b.total_cost !== a.total_cost) return b.total_cost - a.total_cost;
      return String(a.maintenance_type_label).localeCompare(String(b.maintenance_type_label), "tr");
    });
}

function buildMonthlyCostTrend(records, referenceDate) {
  const ref = normalizeRefDate(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setMonth(cutoff.getMonth() - 11);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

  const grouped = new Map();
  for (const row of records || []) {
    const month = monthKey(row.maintenance_date);
    if (!month || month.length !== 7 || month < cutoffKey) continue;
    if (!grouped.has(month)) {
      grouped.set(month, { month, record_count: 0, total_cost: 0 });
    }
    const bucket = grouped.get(month);
    bucket.record_count += 1;
    bucket.total_cost += Number(row.cost || 0);
  }

  return [...grouped.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function buildInsights(health, vehicleRanking, typeDistribution, riskSummary) {
  const insights = [];

  if (health.total_records === 0) {
    insights.push({
      level: "info",
      message: "Analiz için henüz bakım kaydı yok.",
    });
    return insights;
  }

  const topVehicle = vehicleRanking[0];
  if (topVehicle && topVehicle.total_cost > 0) {
    insights.push({
      level: topVehicle.overdue_count > 0 ? "critical" : topVehicle.due_count > 0 ? "warning" : "info",
      message: `Bakım maliyeti en yüksek araç ${topVehicle.plate}.`,
    });
  }

  const overdueTotal = Number(riskSummary?.overdue || 0);
  const dueTotal = Number(riskSummary?.due || 0);
  const upcomingTotal = Number(riskSummary?.upcoming || 0);

  if (overdueTotal > 0) {
    insights.push({
      level: "critical",
      message: `Geciken ${overdueTotal} bakım kalemi bulunuyor.`,
    });
  }

  if (dueTotal > 0) {
    insights.push({
      level: "warning",
      message: `Günü gelen ${dueTotal} bakım kalemi bulunuyor.`,
    });
  }

  if (upcomingTotal > 0 && overdueTotal === 0) {
    insights.push({
      level: "info",
      message: `Yaklaşan ${upcomingTotal} bakım kalemi izleniyor.`,
    });
  }

  const topType = typeDistribution[0];
  if (topType && topType.total_cost > 0) {
    insights.push({
      level: "info",
      message: `En yüksek maliyet kategorisi ${topType.maintenance_type_label}.`,
    });
  }

  if (health.maintenance_health_status === "healthy") {
    insights.push({
      level: "info",
      message: "Bakım sağlığı iyi durumda.",
    });
  } else if (health.maintenance_health_status === "watch") {
    insights.push({
      level: "info",
      message: "Bakım sağlığı izleme seviyesinde.",
    });
  } else if (health.maintenance_health_status === "risk") {
    insights.push({
      level: "warning",
      message: "Bakım sağlığı risk bölgesinde.",
    });
  } else if (health.maintenance_health_status === "critical") {
    insights.push({
      level: "critical",
      message: "Bakım sağlığı kritik seviyede.",
    });
  }

  if (!insights.length) {
    insights.push({
      level: "info",
      message: "Bakım analitiği için yeterli veri bulunmuyor.",
    });
  }

  return insights;
}

function buildMaintenanceAnalytics(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const records = maintenanceService.listMaintenanceRecords();
  const scheduleReport = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref);
  const risk_summary = {
    ok: scheduleReport.summary.ok || 0,
    upcoming: scheduleReport.summary.upcoming || 0,
    due: scheduleReport.summary.due || 0,
    overdue: scheduleReport.summary.overdue || 0,
    unknown: scheduleReport.summary.unknown || 0,
  };

  const total_records = records.length;
  const total_cost = records.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const vehicleIds = new Set(records.map((row) => row.vehicle_id));
  const average_cost_per_record =
    total_records > 0 ? Math.round(total_cost / total_records) : 0;

  const maintenance_health_score = computeMaintenanceHealthScore(risk_summary);
  const maintenance_health_status = maintenanceHealthStatusFromScore(maintenance_health_score);

  const health = {
    total_records,
    total_cost,
    vehicles_with_maintenance: vehicleIds.size,
    average_cost_per_record,
    upcoming_count: risk_summary.upcoming,
    due_count: risk_summary.due,
    overdue_count: risk_summary.overdue,
    maintenance_health_score,
    maintenance_health_status,
    maintenance_health_label: maintenanceHealthLabel(maintenance_health_status),
  };

  const vehicle_cost_ranking = buildVehicleCostRanking(records, scheduleReport.schedules);
  const maintenance_type_distribution = buildMaintenanceTypeDistribution(records);
  const monthly_cost_trend = buildMonthlyCostTrend(records, ref);
  const insights = buildInsights(
    health,
    vehicle_cost_ranking,
    maintenance_type_distribution,
    risk_summary
  );

  return {
    reference_date: ref.toISOString().slice(0, 10),
    health,
    vehicle_cost_ranking,
    maintenance_type_distribution,
    monthly_cost_trend,
    risk_summary,
    insights,
  };
}

module.exports = {
  maintenanceHealthStatusFromScore,
  maintenanceHealthLabel,
  computeMaintenanceHealthScore,
  buildMaintenanceAnalytics,
};
