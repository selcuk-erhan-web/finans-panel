const db = require("../lib/db");
const tireSeasonalSchedulerService = require("./tireSeasonalSchedulerService");
const { seasonLabel } = require("./tireService");
const { normalizePlate } = require("../utils/plate");

const ALERT_STATUSES = new Set(["attention", "mismatch", "unknown"]);

const SEVERITY_LABELS = {
  mismatch: "Uyumsuz",
  attention: "Dikkat",
  unknown: "Bilinmiyor",
};

const READ_STATUS_LABELS = {
  read: "Okundu",
  unread: "Okunmadı",
};

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function buildSourceKey(row) {
  const plateNorm = normalizePlate(row.plate || "") || "unknown";
  const season = row.current_required_season || row.current_season || "unknown";
  const severity = row.status;
  return `${plateNorm}-${season}-${severity}`;
}

function buildMessage(row) {
  const plate = row.plate || "—";
  const required = row.current_required_season;

  if (row.status === "unknown") {
    return `${plate} için lastik sezon verisi bilinmiyor.`;
  }

  if (row.status === "attention") {
    if (required === "transition") {
      return `${plate} için sezon geçiş hazırlığı gerekiyor.`;
    }
    if (required === "winter") {
      return `${plate} için kışlık lastik montajı veya sezon hazırlığı gerekiyor.`;
    }
    if (required === "summer") {
      return `${plate} için yazlık lastik montajı veya sezon hazırlığı gerekiyor.`;
    }
    return `${plate} için lastik sezon hazırlığı gerekiyor.`;
  }

  if (row.status === "mismatch") {
    if (required === "winter") {
      return `${plate} için kışlık lastik uyumsuzluğu var.`;
    }
    if (required === "summer") {
      return `${plate} için yazlık lastik uyumsuzluğu var.`;
    }
    return `${plate} için lastik sezon uyumsuzluğu var.`;
  }

  return row.message || `${plate} için lastik uyarısı.`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    vehicle_id: row.vehicle_id != null ? String(row.vehicle_id) : null,
    plate: row.plate || "",
    severity: row.severity,
    severity_label: SEVERITY_LABELS[row.severity] || row.severity,
    current_season: row.current_season,
    current_season_label:
      tireSeasonalSchedulerService.PERIOD_LABELS[row.current_season] || row.current_season,
    required_tire_season: row.required_tire_season || null,
    required_tire_season_label:
      tireSeasonalSchedulerService.PERIOD_LABELS[row.required_tire_season] ||
      (row.required_tire_season ? seasonLabel(row.required_tire_season) : null),
    current_tire_season: row.current_tire_season || null,
    current_tire_season_label:
      row.current_tire_season && row.current_tire_season !== "unknown"
        ? seasonLabel(row.current_tire_season)
        : "Bilinmiyor",
    message: row.message,
    status: row.status,
    status_label: READ_STATUS_LABELS[row.status] || row.status,
    source_key: row.source_key,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    read_at: row.read_at,
  };
}

function generateTireAlerts(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref);
  const candidates = (report.vehicles || []).filter((row) => ALERT_STATUSES.has(row.status));

  let created = 0;
  const insert = db.prepare(`
    INSERT INTO tire_alerts (
      vehicle_id, plate, severity, current_season, required_tire_season,
      current_tire_season, message, status, source_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)
  `);

  for (const vehicleRow of candidates) {
    const source_key = buildSourceKey({
      ...vehicleRow,
      current_season: report.current_season,
    });
    const existing = db.prepare("SELECT id FROM tire_alerts WHERE source_key = ?").get(source_key);
    if (existing) continue;

    try {
      insert.run(
        vehicleRow.vehicle_id || null,
        vehicleRow.plate || null,
        vehicleRow.status,
        report.current_season,
        vehicleRow.current_required_season || report.current_season,
        vehicleRow.current_tire_season || "unknown",
        buildMessage({ ...vehicleRow, current_required_season: vehicleRow.current_required_season }),
        source_key
      );
      created += 1;
    } catch (err) {
      if (!String(err.message || "").includes("UNIQUE")) throw err;
    }
  }

  return {
    created,
    scanned: candidates.length,
    unread_count: getUnreadTireAlertCount(),
  };
}

function getUnreadTireAlertCount() {
  return db.prepare("SELECT COUNT(*) AS c FROM tire_alerts WHERE status = 'unread'").get().c;
}

function listTireAlerts(filters = {}) {
  const filter = String(filters.filter || filters.status || "all").trim().toLowerCase();
  let sql = "SELECT * FROM tire_alerts WHERE 1=1";
  const params = [];

  if (filter === "unread") {
    sql += " AND status = 'unread'";
  } else if (ALERT_STATUSES.has(filter)) {
    sql += " AND severity = ?";
    params.push(filter);
  }

  if (filters.vehicle_id) {
    sql += " AND vehicle_id = ?";
    params.push(Number(filters.vehicle_id));
  }

  sql += ` ORDER BY
    CASE severity WHEN 'mismatch' THEN 0 WHEN 'attention' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
    datetime(created_at) DESC,
    id DESC`;

  return db.prepare(sql).all(...params).map(mapRow);
}

function getTireAlertById(id) {
  const row = db.prepare("SELECT * FROM tire_alerts WHERE id = ?").get(Number(id));
  return mapRow(row);
}

function markTireAlertRead(id) {
  const existing = getTireAlertById(id);
  if (!existing) return null;
  if (existing.status === "read") return existing;

  db.prepare(
    `UPDATE tire_alerts
     SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(Number(id));

  return getTireAlertById(id);
}

function buildTireAlertPayload(filters = {}, referenceDate = new Date()) {
  generateTireAlerts(referenceDate);
  const alerts = listTireAlerts(filters);
  return {
    unread_count: getUnreadTireAlertCount(),
    alerts,
  };
}

module.exports = {
  ALERT_STATUSES,
  SEVERITY_LABELS,
  READ_STATUS_LABELS,
  buildSourceKey,
  buildMessage,
  generateTireAlerts,
  listTireAlerts,
  getTireAlertById,
  markTireAlertRead,
  getUnreadTireAlertCount,
  buildTireAlertPayload,
  mapRow,
};
