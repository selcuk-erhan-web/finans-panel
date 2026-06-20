const db = require("../lib/db");
const auditLogService = require("./auditLogService");
const { MODULE_LABELS, ACTION_LABELS } = auditLogService;

const LATEST_LIMIT = 8;
const SCAN_LIMIT = 1000;

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

function hasCriticalChange(row) {
  return (row.formatted_changes || []).some((change) => change.importance === "critical");
}

function hasImportantChange(row) {
  return (row.formatted_changes || []).some((change) => change.importance === "important");
}

function loadRecentAuditRecords(limit = SCAN_LIMIT) {
  const rows = db
    .prepare(`SELECT * FROM audit_logs ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`)
    .all(limit);
  return rows.map((row) => auditLogService.normalizeAuditRow(row)).filter(Boolean);
}

function buildModuleActivity(records) {
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

function buildActionActivity(records) {
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

function mapLatestActivity(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    module: row.module,
    module_label: row.module_label,
    action: row.action,
    action_label: row.action_label,
    actor_name: row.actor_name,
    summary: row.summary,
    change_count: row.change_count || 0,
    has_critical_change: hasCriticalChange(row),
    has_important_change: hasImportantChange(row),
  };
}

function buildExecutiveInsights(summary, moduleActivity, actionActivity) {
  const insights = [];

  if (summary.last_24h_total === 0) {
    insights.push({
      level: "info",
      message: "Son 24 saatte kayıtlı işlem bulunmuyor.",
    });
    return insights;
  }

  insights.push({
    level: "info",
    message: `Son 24 saatte ${summary.last_24h_total} işlem kaydedildi.`,
  });

  if (summary.critical_change_count > 0) {
    insights.push({
      level: "critical",
      message: `Kritik değişiklik içeren ${summary.critical_change_count} kayıt var.`,
    });
  }

  if (summary.important_change_count > 0) {
    insights.push({
      level: "warning",
      message: `Önemli değişiklik içeren ${summary.important_change_count} kayıt var.`,
    });
  }

  const topModule = moduleActivity[0];
  if (topModule && topModule.count > 0) {
    insights.push({
      level: topModule.count >= 5 ? "warning" : "info",
      message: `En aktif modül: ${topModule.label} (${topModule.count} işlem).`,
    });
  }

  const topAction = actionActivity[0];
  if (topAction && topAction.count > 0 && topAction.action === "update") {
    insights.push({
      level: "info",
      message: `Son 24 saatte ${topAction.count} güncelleme işlemi yapıldı.`,
    });
  }

  if (summary.delete_count > 0) {
    insights.push({
      level: summary.delete_count >= 3 ? "warning" : "info",
      message: `Son 24 saatte ${summary.delete_count} silme işlemi kaydedildi.`,
    });
  }

  if (!insights.length) {
    insights.push({
      level: "info",
      message: "İşlem aktivitesi normal seviyede.",
    });
  }

  return insights;
}

function buildExecutiveAuditDashboard(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const refDay = localDayKey(ref);
  const last24hCutoff = new Date(ref.getTime() - 24 * 60 * 60 * 1000);

  const allRecords = loadRecentAuditRecords();
  const last24hRecords = [];
  let today_total = 0;

  for (const row of allRecords) {
    const created = parseCreatedAt(row.created_at);
    if (!created) continue;
    if (String(row.created_at || "").slice(0, 10) === refDay || localDayKey(created) === refDay) {
      today_total += 1;
    }
    if (created >= last24hCutoff && created <= ref) {
      last24hRecords.push(row);
    }
  }

  const summary = {
    last_24h_total: last24hRecords.length,
    today_total,
    create_count: 0,
    update_count: 0,
    delete_count: 0,
    import_count: 0,
    critical_change_count: 0,
    important_change_count: 0,
  };

  for (const row of last24hRecords) {
    if (row.action === "create") summary.create_count += 1;
    if (row.action === "update") summary.update_count += 1;
    if (row.action === "delete") summary.delete_count += 1;
    if (row.action === "import") summary.import_count += 1;
    if (hasCriticalChange(row)) summary.critical_change_count += 1;
    if (hasImportantChange(row)) summary.important_change_count += 1;
  }

  const module_activity = buildModuleActivity(last24hRecords);
  const action_activity = buildActionActivity(last24hRecords);
  const latest_activity = last24hRecords.slice(0, LATEST_LIMIT).map(mapLatestActivity);
  const executive_insights = buildExecutiveInsights(summary, module_activity, action_activity);

  return {
    reference_date: refDay,
    summary,
    module_activity,
    action_activity,
    latest_activity,
    executive_insights,
  };
}

function emptyDashboard(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const refDay = localDayKey(ref);
  return {
    reference_date: refDay,
    summary: {
      last_24h_total: 0,
      today_total: 0,
      create_count: 0,
      update_count: 0,
      delete_count: 0,
      import_count: 0,
      critical_change_count: 0,
      important_change_count: 0,
    },
    module_activity: [],
    action_activity: [],
    latest_activity: [],
    executive_insights: [{ level: "info", message: "İşlem aktivitesi alınamadı." }],
  };
}

module.exports = {
  LATEST_LIMIT,
  buildExecutiveAuditDashboard,
  emptyDashboard,
  hasCriticalChange,
  hasImportantChange,
};
