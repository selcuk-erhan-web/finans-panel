const tireService = require("./tireService");
const tireHistoryService = require("./tireHistoryService");
const tireSeasonalSchedulerService = require("./tireSeasonalSchedulerService");
const tireAlertService = require("./tireAlertService");
const { seasonLabel, statusLabel } = require("./tireService");
const { TIRE_SEASONS, TIRE_STATUSES } = require("../lib/constants");

const SEASONAL_STATUS_RANK = { mismatch: 0, attention: 1, unknown: 2, ready: 3 };

const SEASON_LABELS = Object.fromEntries(TIRE_SEASONS);
const STATUS_LABELS = Object.fromEntries(TIRE_STATUSES);

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function tireHealthStatusFromScore(score) {
  if (score == null || !Number.isFinite(score)) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function tireHealthLabel(status) {
  const labels = {
    healthy: "Sağlıklı",
    watch: "İzleme",
    risk: "Risk",
    critical: "Kritik",
    unknown: "Bilinmiyor",
  };
  return labels[status] || status;
}

function seasonalStatusLabel(status) {
  return tireSeasonalSchedulerService.STATUS_LABELS[status] || status;
}

function computeTireHealthScore(counts, hasTireData) {
  if (!hasTireData) return null;

  const score =
    100 -
    Number(counts.season_mismatch_count || 0) * 25 -
    Number(counts.attention_count || 0) * 10 -
    Number(counts.unknown_count || 0) * 5 -
    Number(counts.unread_alert_count || 0) * 3;

  return Math.max(0, Math.min(100, score));
}

function buildSeasonDistribution(records) {
  const grouped = new Map();

  for (const row of records || []) {
    const key = row.season || "unknown";
    if (!grouped.has(key)) {
      grouped.set(key, {
        season: key,
        season_label: SEASON_LABELS[key] || seasonLabel(key) || "Bilinmiyor",
        quantity: 0,
        record_count: 0,
        total_cost: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.record_count += 1;
    bucket.quantity += Number(row.quantity || 0);
    bucket.total_cost += Number(row.cost || 0);
  }

  return [...grouped.values()].sort((a, b) => b.quantity - a.quantity);
}

function buildStatusDistribution(records) {
  const grouped = new Map();

  for (const row of records || []) {
    const key = row.status || "unknown";
    if (!grouped.has(key)) {
      grouped.set(key, {
        status: key,
        status_label: STATUS_LABELS[key] || statusLabel(key) || key,
        quantity: 0,
        record_count: 0,
        total_cost: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.record_count += 1;
    bucket.quantity += Number(row.quantity || 0);
    bucket.total_cost += Number(row.cost || 0);
  }

  return [...grouped.values()].sort((a, b) => b.quantity - a.quantity);
}

function buildMonthlyTireCostTrend(records, historyRecords, referenceDate) {
  const ref = normalizeRefDate(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setMonth(cutoff.getMonth() - 11);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

  const grouped = new Map();

  const addCost = (dateStr, cost) => {
    const month = monthKey(dateStr);
    if (!month || month.length !== 7 || month < cutoffKey) return;
    const amount = Number(cost || 0);
    if (amount <= 0) return;
    if (!grouped.has(month)) {
      grouped.set(month, { month, record_count: 0, total_cost: 0 });
    }
    const bucket = grouped.get(month);
    bucket.record_count += 1;
    bucket.total_cost += amount;
  };

  for (const row of records || []) {
    addCost(row.purchase_date || row.created_at, row.cost);
  }

  for (const row of historyRecords || []) {
    addCost(row.change_date, row.cost);
  }

  return [...grouped.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function buildVehicleTireRanking(records, scheduleVehicles, alerts, historyRecords) {
  const scheduleByVehicle = new Map(
    (scheduleVehicles || []).map((row) => [String(row.vehicle_id), row])
  );

  const alertCountByVehicle = new Map();
  for (const alert of alerts || []) {
    const key = String(alert.vehicle_id);
    alertCountByVehicle.set(key, (alertCountByVehicle.get(key) || 0) + 1);
  }

  const historyByVehicle = new Map();
  for (const row of historyRecords || []) {
    const key = String(row.vehicle_id);
    const current = historyByVehicle.get(key);
    if (!current || String(row.change_date || "") > String(current.change_date || "")) {
      historyByVehicle.set(key, row);
    }
  }

  const grouped = new Map();
  for (const row of records || []) {
    const key = String(row.vehicle_id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        vehicle_id: key,
        plate: row.plate || "—",
        tire_record_count: 0,
        tire_quantity: 0,
        total_cost: 0,
        on_vehicle_quantity: 0,
        in_storage_quantity: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.tire_record_count += 1;
    bucket.tire_quantity += Number(row.quantity || 0);
    bucket.total_cost += Number(row.cost || 0);
    if (row.status === "on_vehicle") bucket.on_vehicle_quantity += Number(row.quantity || 0);
    if (row.status === "in_storage") bucket.in_storage_quantity += Number(row.quantity || 0);
    if (row.plate) bucket.plate = row.plate;
  }

  for (const scheduleRow of scheduleVehicles || []) {
    const key = String(scheduleRow.vehicle_id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        vehicle_id: key,
        plate: scheduleRow.plate || "—",
        tire_record_count: 0,
        tire_quantity: 0,
        total_cost: 0,
        on_vehicle_quantity: scheduleRow.on_vehicle_quantity || 0,
        in_storage_quantity: scheduleRow.storage_quantity_for_required_season || 0,
      });
    }
  }

  return [...grouped.values()]
    .map((row) => {
      const schedule = scheduleByVehicle.get(row.vehicle_id);
      const history = historyByVehicle.get(row.vehicle_id);
      const seasonalStatus = schedule?.status || "unknown";
      return {
        vehicle_id: row.vehicle_id,
        plate: row.plate,
        tire_record_count: row.tire_record_count,
        tire_quantity: row.tire_quantity,
        total_cost: row.total_cost,
        on_vehicle_quantity: row.on_vehicle_quantity,
        in_storage_quantity: row.in_storage_quantity,
        seasonal_status: seasonalStatus,
        seasonal_status_label: seasonalStatusLabel(seasonalStatus),
        current_tire_season: schedule?.current_tire_season || "unknown",
        current_tire_season_label:
          schedule?.current_tire_season && schedule.current_tire_season !== "unknown"
            ? seasonLabel(schedule.current_tire_season)
            : "Bilinmiyor",
        last_change_date: history?.change_date || schedule?.last_change_date || null,
        alert_count: alertCountByVehicle.get(row.vehicle_id) || 0,
      };
    })
    .sort((a, b) => {
      const rankA = SEASONAL_STATUS_RANK[a.seasonal_status] ?? 9;
      const rankB = SEASONAL_STATUS_RANK[b.seasonal_status] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      if (b.total_cost !== a.total_cost) return b.total_cost - a.total_cost;
      return String(a.plate).localeCompare(String(b.plate), "tr");
    });
}

function buildInsights(health, vehicleRanking) {
  const insights = [];

  if (health.total_tire_records === 0) {
    insights.push({
      level: "info",
      message: "Analiz için henüz lastik kaydı yok.",
    });
    return insights;
  }

  if (health.season_mismatch_count > 0) {
    insights.push({
      level: "critical",
      message: `Lastik sezon uyumsuzluğu olan ${health.season_mismatch_count} araç var.`,
    });
  }

  if (health.attention_count > 0) {
    insights.push({
      level: "warning",
      message: `Sezon hazırlığı gerektiren ${health.attention_count} araç var.`,
    });
  }

  if (health.unknown_count > 0) {
    insights.push({
      level: "info",
      message: `${health.unknown_count} araç için lastik sezon verisi bilinmiyor.`,
    });
  }

  if (health.in_storage_quantity > 0) {
    insights.push({
      level: "info",
      message: `Depoda ${Number(health.in_storage_quantity).toLocaleString("tr-TR")} adet lastik bulunuyor.`,
    });
  }

  const topByCost = [...vehicleRanking].sort((a, b) => b.total_cost - a.total_cost)[0];
  if (topByCost && topByCost.total_cost > 0) {
    insights.push({
      level: topByCost.seasonal_status === "mismatch" ? "critical" : "info",
      message: `En yüksek lastik maliyeti ${topByCost.plate} aracında.`,
    });
  }

  if (health.unread_alert_count > 0) {
    insights.push({
      level: "warning",
      message: `${health.unread_alert_count} okunmamış lastik uyarısı bulunuyor.`,
    });
  }

  if (health.tire_health_status === "healthy") {
    insights.push({ level: "info", message: "Lastik sağlığı iyi durumda." });
  } else if (health.tire_health_status === "watch") {
    insights.push({ level: "info", message: "Lastik sağlığı izleme seviyesinde." });
  } else if (health.tire_health_status === "risk") {
    insights.push({ level: "warning", message: "Lastik sağlığı risk bölgesinde." });
  } else if (health.tire_health_status === "critical") {
    insights.push({ level: "critical", message: "Lastik sağlığı kritik seviyede." });
  }

  if (!insights.length) {
    insights.push({
      level: "info",
      message: "Lastik analitiği için yeterli veri bulunmuyor.",
    });
  }

  return insights;
}

function buildTireAnalytics(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const records = tireService.listTireRecords();
  const historyRecords = tireHistoryService.listTireChangeRecords();
  const scheduleReport = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref);
  const alertPayload = tireAlertService.buildTireAlertPayload({}, ref);

  const seasonal_risk_summary = {
    ready: scheduleReport.summary.ready || 0,
    attention: scheduleReport.summary.attention || 0,
    mismatch: scheduleReport.summary.mismatch || 0,
    unknown: scheduleReport.summary.unknown || 0,
  };

  const total_tire_records = records.length;
  const total_quantity = records.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const total_cost = records.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const vehicleIds = new Set(records.map((row) => row.vehicle_id));

  const on_vehicle_quantity = records
    .filter((row) => row.status === "on_vehicle")
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const in_storage_quantity = records
    .filter((row) => row.status === "in_storage")
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const disposed_quantity = records
    .filter((row) => row.status === "disposed")
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  const unread_alert_count = alertPayload.unread_count || 0;
  const hasTireData = total_tire_records > 0;

  const scoreInputs = {
    season_mismatch_count: seasonal_risk_summary.mismatch,
    attention_count: seasonal_risk_summary.attention,
    unknown_count: seasonal_risk_summary.unknown,
    unread_alert_count,
  };

  const tire_health_score = computeTireHealthScore(scoreInputs, hasTireData);
  const tire_health_status = tireHealthStatusFromScore(tire_health_score);

  const health = {
    total_tire_records,
    total_quantity,
    total_cost,
    vehicles_with_tires: vehicleIds.size,
    on_vehicle_quantity,
    in_storage_quantity,
    disposed_quantity,
    season_mismatch_count: seasonal_risk_summary.mismatch,
    attention_count: seasonal_risk_summary.attention,
    unknown_count: seasonal_risk_summary.unknown,
    unread_alert_count,
    tire_health_score,
    tire_health_status,
    tire_health_label: tireHealthLabel(tire_health_status),
  };

  const vehicle_tire_ranking = buildVehicleTireRanking(
    records,
    scheduleReport.vehicles,
    alertPayload.alerts,
    historyRecords
  );
  const season_distribution = buildSeasonDistribution(records);
  const status_distribution = buildStatusDistribution(records);
  const monthly_tire_cost_trend = buildMonthlyTireCostTrend(records, historyRecords, ref);
  const insights = buildInsights(health, vehicle_tire_ranking);

  return {
    reference_date: ref.toISOString().slice(0, 10),
    health,
    vehicle_tire_ranking,
    season_distribution,
    status_distribution,
    monthly_tire_cost_trend,
    seasonal_risk_summary,
    insights,
  };
}

module.exports = {
  tireHealthStatusFromScore,
  tireHealthLabel,
  computeTireHealthScore,
  buildTireAnalytics,
  SEASONAL_STATUS_RANK,
};
