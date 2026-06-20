const auditLogService = require("./auditLogService");
const auditDashboardService = require("./auditDashboardService");
const { MODULE_LABELS, ACTION_LABELS } = auditLogService;

const TREND_DAYS = 14;
const SCAN_LIMIT = 500;
const CRITICAL_LIMIT = 20;

function localDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function parseCreatedAt(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function recordDayKey(row) {
  const created = parseCreatedAt(row.created_at);
  if (created) return localDayKey(created);
  return String(row.created_at || "").slice(0, 10);
}

function hasCriticalChange(row) {
  return auditDashboardService.hasCriticalChange(row);
}

function hasImportantChange(row) {
  return auditDashboardService.hasImportantChange(row);
}

function auditHealthStatusFromScore(score) {
  if (score == null || !Number.isFinite(score)) return "unknown";
  if (score >= 90) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function auditHealthLabel(status) {
  const labels = {
    healthy: "Sağlıklı",
    watch: "İzleme",
    risk: "Risk",
    critical: "Kritik",
    unknown: "Bilinmiyor",
  };
  return labels[status] || status;
}

function computeAuditHealthScore(critical, important, deleteCount, hasLogs) {
  if (!hasLogs) return null;
  const score = 100 - critical * 10 - deleteCount * 5 - important * 2;
  return Math.max(0, Math.min(100, score));
}

function resolveQueryFilters(filters = {}, ref = new Date()) {
  const refDay = localDayKey(ref);
  let date_to = String(filters.date_to || filters.date || refDay).slice(0, 10);
  let date_from = String(filters.date_from || "").slice(0, 10);

  if (!date_from) {
    const start = new Date(ref);
    start.setDate(start.getDate() - (TREND_DAYS - 1));
    date_from = localDayKey(start);
  }

  if (date_from > date_to) {
    const tmp = date_from;
    date_from = date_to;
    date_to = tmp;
  }

  return {
    module: filters.module || "",
    action: filters.action || "",
    actor_id: filters.actor_id || "",
    date_from,
    date_to,
    limit: SCAN_LIMIT,
  };
}

function loadRecords(filters) {
  return auditLogService.listAuditLogs(filters);
}

function buildModuleDistribution(records) {
  const grouped = new Map();
  for (const row of records) {
    const key = row.module || "system";
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return [...grouped.entries()]
    .map(([module, count]) => ({
      module,
      label: MODULE_LABELS[module] || module,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));
}

function buildActionDistribution(records) {
  const grouped = new Map();
  for (const row of records) {
    const key = row.action || "system";
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return [...grouped.entries()]
    .map(([action, count]) => ({
      action,
      label: ACTION_LABELS[action] || action,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));
}

function buildActorActivity(records) {
  const grouped = new Map();

  for (const row of records) {
    const actor_id = row.actor_id || "system";
    if (!grouped.has(actor_id)) {
      grouped.set(actor_id, {
        actor_id,
        actor_name: row.actor_name || "System",
        count: 0,
        create_count: 0,
        update_count: 0,
        delete_count: 0,
        import_count: 0,
      });
    }
    const bucket = grouped.get(actor_id);
    bucket.count += 1;
    if (row.actor_name) bucket.actor_name = row.actor_name;
    if (row.action === "create") bucket.create_count += 1;
    if (row.action === "update") bucket.update_count += 1;
    if (row.action === "delete") bucket.delete_count += 1;
    if (row.action === "import") bucket.import_count += 1;
  }

  return [...grouped.values()].sort(
    (a, b) => b.count - a.count || a.actor_name.localeCompare(b.actor_name, "tr")
  );
}

function buildEntityTypeDistribution(records) {
  const grouped = new Map();
  for (const row of records) {
    const key = row.entity_type || "unknown";
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return [...grouped.entries()]
    .map(([entity_type, count]) => ({ entity_type, count }))
    .sort((a, b) => b.count - a.count || a.entity_type.localeCompare(b.entity_type, "tr"));
}

function buildDailyActivityTrend(records, ref, dateFrom, dateTo) {
  const trend = new Map();
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = localDayKey(cursor);
    trend.set(key, { date: key, count: 0, critical_count: 0, important_count: 0 });
  }

  for (const row of records) {
    const key = recordDayKey(row);
    if (!trend.has(key)) continue;
    const bucket = trend.get(key);
    bucket.count += 1;
    if (hasCriticalChange(row)) bucket.critical_count += 1;
    if (hasImportantChange(row)) bucket.important_count += 1;
  }

  return [...trend.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function buildCriticalChanges(records) {
  return records
    .filter((row) => hasCriticalChange(row))
    .slice(0, CRITICAL_LIMIT)
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      module: row.module,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_name: row.actor_name,
      summary: row.summary,
      formatted_changes: row.formatted_changes || [],
    }));
}

function buildHealth(records, ref) {
  const refDay = localDayKey(ref);
  const last7Start = new Date(ref);
  last7Start.setDate(last7Start.getDate() - 6);
  const last7Key = localDayKey(last7Start);

  let today_total = 0;
  let last_7_days_total = 0;
  let critical_change_count = 0;
  let important_change_count = 0;
  let delete_count = 0;
  let import_count = 0;

  for (const row of records) {
    const dayKey = recordDayKey(row);
    if (dayKey === refDay) today_total += 1;
    if (dayKey >= last7Key && dayKey <= refDay) last_7_days_total += 1;
    if (hasCriticalChange(row)) critical_change_count += 1;
    if (hasImportantChange(row)) important_change_count += 1;
    if (row.action === "delete") delete_count += 1;
    if (row.action === "import") import_count += 1;
  }

  const total_logs = records.length;
  const audit_health_score = computeAuditHealthScore(
    critical_change_count,
    important_change_count,
    delete_count,
    total_logs > 0
  );
  const audit_health_status = auditHealthStatusFromScore(audit_health_score);

  return {
    total_logs,
    today_total,
    last_7_days_total,
    critical_change_count,
    important_change_count,
    delete_count,
    import_count,
    audit_health_score,
    audit_health_status,
    audit_health_label: auditHealthLabel(audit_health_status),
  };
}

function buildInsights(health, moduleDistribution, actorActivity) {
  const insights = [];

  if (!health.total_logs) {
    insights.push({
      level: "info",
      message: "Seçilen aralıkta işlem kaydı bulunmuyor.",
    });
    return insights;
  }

  insights.push({
    level: "info",
    message: `Son 7 günde ${health.last_7_days_total} işlem yapıldı.`,
  });

  const topModule = moduleDistribution[0];
  if (topModule && topModule.count > 0) {
    insights.push({
      level: topModule.count >= 5 ? "warning" : "info",
      message: `En yoğun işlem modülü ${topModule.label}.`,
    });
  }

  if (health.critical_change_count > 0) {
    insights.push({
      level: "critical",
      message: `${health.critical_change_count} kritik değişiklik kaydı bulunuyor.`,
    });
  } else {
    insights.push({
      level: "info",
      message: "Kritik değişiklik bulunmuyor.",
    });
  }

  const topActor = actorActivity[0];
  if (topActor && topActor.count > 0 && topActor.actor_id !== "system") {
    insights.push({
      level: "info",
      message: `En aktif kullanıcı ${topActor.actor_name}.`,
    });
  }

  if (health.delete_count > 0) {
    insights.push({
      level: health.delete_count >= 3 ? "warning" : "info",
      message: `Analiz aralığında ${health.delete_count} silme işlemi kaydedildi.`,
    });
  }

  if (health.import_count > 0) {
    insights.push({
      level: "info",
      message: `${health.import_count} import işlemi gerçekleştirildi.`,
    });
  }

  return insights;
}

function buildAuditAnalytics(referenceDate = new Date(), filters = {}) {
  const ref = normalizeRefDate(referenceDate);
  const queryFilters = resolveQueryFilters(filters, ref);
  const records = loadRecords(queryFilters);

  const module_distribution = buildModuleDistribution(records);
  const action_distribution = buildActionDistribution(records);
  const actor_activity = buildActorActivity(records);
  const entity_type_distribution = buildEntityTypeDistribution(records);
  const daily_activity_trend = buildDailyActivityTrend(
    records,
    ref,
    queryFilters.date_from,
    queryFilters.date_to
  );
  const critical_changes = buildCriticalChanges(records);
  const health = buildHealth(records, ref);
  const insights = buildInsights(health, module_distribution, actor_activity);

  return {
    reference_date: localDayKey(ref),
    health,
    module_distribution,
    action_distribution,
    actor_activity,
    entity_type_distribution,
    daily_activity_trend,
    critical_changes,
    insights,
    filters: {
      module: queryFilters.module,
      action: queryFilters.action,
      actor_id: queryFilters.actor_id,
      date_from: queryFilters.date_from,
      date_to: queryFilters.date_to,
    },
  };
}

function emptyAnalytics(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const queryFilters = resolveQueryFilters({}, ref);
  return {
    reference_date: localDayKey(ref),
    health: {
      total_logs: 0,
      today_total: 0,
      last_7_days_total: 0,
      critical_change_count: 0,
      important_change_count: 0,
      delete_count: 0,
      import_count: 0,
      audit_health_score: null,
      audit_health_status: "unknown",
      audit_health_label: auditHealthLabel("unknown"),
    },
    module_distribution: [],
    action_distribution: [],
    actor_activity: [],
    entity_type_distribution: [],
    daily_activity_trend: buildDailyActivityTrend([], ref, queryFilters.date_from, queryFilters.date_to),
    critical_changes: [],
    insights: [{ level: "info", message: "Denetim analitiği alınamadı." }],
    filters: {
      module: "",
      action: "",
      actor_id: "",
      date_from: queryFilters.date_from,
      date_to: queryFilters.date_to,
    },
  };
}

module.exports = {
  TREND_DAYS,
  SCAN_LIMIT,
  buildAuditAnalytics,
  emptyAnalytics,
  auditHealthStatusFromScore,
  auditHealthLabel,
  computeAuditHealthScore,
};
