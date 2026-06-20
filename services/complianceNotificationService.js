const db = require("../lib/db");
const complianceStatusService = require("./complianceStatusService");
const documentService = require("./documentService");
const { normalizePlate } = require("../utils/plate");

const NOTIFY_STATUSES = new Set(["warning", "critical", "expired"]);

const TYPE_SLUG = {
  traffic_insurance: "trafik",
  casco: "kasko",
  seat_insurance: "koltuk",
  inspection: "muayene",
  emission: "egzoz",
  license: "ruhsat",
  authorization_certificate: "yetki",
  license_note: "ruhsat",
  src_psychotechnic: "src",
};

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function typeSlug(documentType) {
  if (!documentType) return "evrak";
  return TYPE_SLUG[documentType] || String(documentType).replace(/_/g, "-");
}

function buildSourceKey(record) {
  const plateNorm = normalizePlate(record.plate || record.plateDetected || "");
  const slug = typeSlug(record.document_type);
  const severity = record.status;
  return `${plateNorm || "unknown"}-${slug}-${severity}`;
}

function buildMessage(record) {
  const label = record.type_label || documentService.typeLabel(record.document_type);
  const plate = record.plate || "—";
  const days = record.days_remaining;

  if (record.status === "expired") {
    const ago = days != null ? Math.abs(days) : null;
    return ago != null
      ? `${plate} · ${label} · süresi ${ago} gün önce doldu`
      : `${plate} · ${label} · süresi doldu`;
  }
  if (record.status === "critical") {
    return days === 0
      ? `${plate} · ${label} · bitiş tarihi bugün`
      : `${plate} · ${label} · ${days} gün kaldı`;
  }
  if (record.status === "warning") {
    return `${plate} · ${label} · ${days} gün kaldı`;
  }
  return `${plate} · ${label}`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    type: row.type,
    severity: row.severity,
    vehicle_id: row.vehicle_id != null ? String(row.vehicle_id) : null,
    plate: row.plate,
    document_type: row.document_type,
    document_id: row.document_id != null ? String(row.document_id) : null,
    message: row.message,
    status: row.status,
    created_at: row.created_at,
    read_at: row.read_at,
    source_key: row.source_key,
  };
}

function generateComplianceNotifications(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const report = complianceStatusService.buildStatusReport(ref);
  const candidates = (report.records || []).filter((row) => NOTIFY_STATUSES.has(row.status));

  let created = 0;
  const insert = db.prepare(`
    INSERT INTO compliance_notifications (
      type, severity, vehicle_id, plate, document_type, document_id,
      message, status, source_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)
  `);

  for (const record of candidates) {
    const source_key = buildSourceKey(record);
    const existing = db
      .prepare("SELECT id FROM compliance_notifications WHERE source_key = ?")
      .get(source_key);
    if (existing) continue;

    try {
      insert.run(
        "compliance",
        record.status,
        record.vehicle_id || null,
        record.plate || null,
        record.document_type || null,
        record.id || null,
        buildMessage(record),
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
    total: getUnreadCount() + getReadCount(),
  };
}

function getReadCount() {
  return db
    .prepare("SELECT COUNT(*) AS c FROM compliance_notifications WHERE status = 'read'")
    .get().c;
}

function getUnreadCount() {
  return db
    .prepare("SELECT COUNT(*) AS c FROM compliance_notifications WHERE status = 'unread'")
    .get().c;
}

function listNotifications(filter = "all") {
  let sql = `SELECT * FROM compliance_notifications WHERE 1=1`;
  const params = [];

  if (filter === "unread") {
    sql += " AND status = 'unread'";
  } else if (["warning", "critical", "expired"].includes(filter)) {
    sql += " AND severity = ?";
    params.push(filter);
  }

  sql += ` ORDER BY
    CASE severity WHEN 'expired' THEN 0 WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    datetime(created_at) DESC,
    id DESC`;

  return db.prepare(sql).all(...params).map(mapRow);
}

function getNotificationById(id) {
  const row = db.prepare("SELECT * FROM compliance_notifications WHERE id = ?").get(Number(id));
  return mapRow(row);
}

function markNotificationRead(id) {
  const existing = getNotificationById(id);
  if (!existing) return null;
  if (existing.status === "read") return existing;

  db.prepare(
    `UPDATE compliance_notifications
     SET status = 'read', read_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(Number(id));

  return getNotificationById(id);
}

function getApiPayload(filter = "all", referenceDate = new Date()) {
  generateComplianceNotifications(referenceDate);
  const notifications = listNotifications(filter);
  return {
    unread_count: getUnreadCount(),
    notifications,
  };
}

module.exports = {
  NOTIFY_STATUSES,
  TYPE_SLUG,
  buildSourceKey,
  buildMessage,
  generateComplianceNotifications,
  listNotifications,
  getNotificationById,
  markNotificationRead,
  getUnreadCount,
  getApiPayload,
  mapRow,
};
