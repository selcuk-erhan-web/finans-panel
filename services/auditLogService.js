const db = require("../lib/db");

const VALID_MODULES = new Set([
  "compliance",
  "maintenance",
  "tire",
  "vehicle",
  "fuel",
  "hgs",
  "income",
  "system",
]);

const VALID_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "import",
  "read",
  "status_change",
  "system",
]);

const LEGACY_ACTION_MAP = {
  maintenance_delete: "delete",
  vehicle_delete: "delete",
  fuel_delete: "delete",
  expense_delete: "delete",
  income_delete: "delete",
  fuel_import: "import",
  hakedis_import: "import",
  fuel_link_plate: "update",
  demo_purge: "system",
};

const MODULE_LABELS = {
  compliance: "Uygunluk",
  maintenance: "Bakım",
  tire: "Lastik",
  vehicle: "Araç",
  fuel: "Yakıt",
  hgs: "HGS",
  income: "Gelir",
  system: "Sistem",
};

const ACTION_LABELS = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  import: "Import",
  read: "Okuma",
  status_change: "Durum",
  system: "Sistem",
};

function sanitizeText(value, max = 500) {
  if (value == null) return null;
  return String(value).slice(0, max);
}

function serializeMetadata(metadata) {
  if (metadata == null) return null;
  if (typeof metadata === "string") return metadata.slice(0, 4000);
  try {
    return JSON.stringify(metadata).slice(0, 4000);
  } catch {
    return null;
  }
}

function parseMetadata(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: String(raw).slice(0, 500) };
  }
}

function normalizeAction(action) {
  const key = String(action || "").trim();
  if (VALID_ACTIONS.has(key)) return key;
  if (LEGACY_ACTION_MAP[key]) return LEGACY_ACTION_MAP[key];
  if (key.endsWith("_delete")) return "delete";
  if (key.endsWith("_import")) return "import";
  if (key.endsWith("_create")) return "create";
  if (key.endsWith("_update")) return "update";
  return key || "system";
}

function inferModule(row) {
  if (row.module) return row.module;
  const entityType = String(row.entity_type || "");
  const action = String(row.action || "");

  if (entityType.includes("maintenance") || action.includes("maintenance")) return "maintenance";
  if (entityType.includes("tire") || action.includes("tire")) return "tire";
  if (entityType.includes("document") || entityType.includes("compliance")) return "compliance";
  if (entityType.includes("vehicle") || action.includes("vehicle")) return "vehicle";
  if (entityType.includes("fuel") || action.includes("fuel")) return "fuel";
  if (action.includes("hgs") || action.includes("hakedis")) return action.includes("hgs") ? "hgs" : "income";
  return "system";
}

function legacySummary(row) {
  if (row.note) return String(row.note);
  const action = normalizeAction(row.action);
  const entity = row.entity_type || "kayıt";
  return `${entity} ${ACTION_LABELS[action] || action}`.trim();
}

function normalizeAuditRow(row) {
  if (!row) return null;
  const metadata = parseMetadata(row.metadata);
  const parsedLegacy = !metadata && row.new_value ? parseMetadata(row.new_value) : null;

  return {
    id: String(row.id),
    module: inferModule(row),
    module_label: MODULE_LABELS[inferModule(row)] || inferModule(row),
    entity_type: row.entity_type || null,
    entity_id: row.entity_id != null ? String(row.entity_id) : null,
    action: normalizeAction(row.action),
    action_label: ACTION_LABELS[normalizeAction(row.action)] || normalizeAction(row.action),
    actor_id: row.actor_id || "system",
    actor_name: row.actor_name || "System",
    summary: row.summary || legacySummary(row),
    metadata: metadata || parsedLegacy,
    metadata_raw: row.metadata || row.new_value || null,
    created_at: row.created_at,
  };
}

function buildWhere(filters = {}) {
  const clauses = ["1=1"];
  const params = [];

  if (filters.module) {
    clauses.push("(module = ? OR (module IS NULL AND entity_type LIKE ?))");
    params.push(filters.module, `%${filters.module}%`);
  }
  if (filters.entity_type) {
    clauses.push("entity_type = ?");
    params.push(filters.entity_type);
  }
  if (filters.entity_id) {
    clauses.push("entity_id = ?");
    params.push(String(filters.entity_id));
  }
  if (filters.action) {
    clauses.push("(action = ? OR action LIKE ?)");
    params.push(filters.action, `%${filters.action}%`);
  }
  if (filters.actor_id) {
    clauses.push("actor_id = ?");
    params.push(String(filters.actor_id));
  }
  if (filters.date_from) {
    clauses.push("date(created_at) >= date(?)");
    params.push(String(filters.date_from).slice(0, 10));
  }
  if (filters.date_to) {
    clauses.push("date(created_at) <= date(?)");
    params.push(String(filters.date_to).slice(0, 10));
  }

  return { where: clauses.join(" AND "), params };
}

function createAuditLog(entry) {
  try {
    const module = sanitizeText(entry?.module, 64);
    const entity_type = sanitizeText(entry?.entity_type, 128);
    const action = sanitizeText(entry?.action, 64);

    if (!module || !VALID_MODULES.has(module)) {
      return { ok: false, error: "Geçersiz modül." };
    }
    if (!entity_type) {
      return { ok: false, error: "entity_type zorunlu." };
    }
    if (!action || !VALID_ACTIONS.has(action)) {
      return { ok: false, error: "Geçersiz işlem." };
    }

    const info = db
      .prepare(
        `INSERT INTO audit_logs (
          module, entity_type, entity_id, action, actor_id, actor_name, summary, metadata, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        module,
        entity_type,
        entry.entity_id != null ? String(entry.entity_id) : null,
        action,
        sanitizeText(entry.actor_id || "system", 64) || "system",
        sanitizeText(entry.actor_name || "System", 128) || "System",
        sanitizeText(entry.summary, 500),
        serializeMetadata(entry.metadata),
        sanitizeText(entry.summary, 500)
      );

    return { ok: true, id: String(info.lastInsertRowid) };
  } catch (err) {
    console.error("createAuditLog:", err.message);
    return { ok: false, error: err.message || "Audit log yazılamadı." };
  }
}

function listAuditLogs(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 500);
  const { where, params } = buildWhere(filters);
  const rows = db
    .prepare(
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`
    )
    .all(...params, limit);

  return rows.map(normalizeAuditRow);
}

function getAuditLog(id) {
  const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
  return normalizeAuditRow(row);
}

function buildAuditSummary(filters = {}) {
  const { where, params } = buildWhere(filters);
  const rows = db
    .prepare(`SELECT * FROM audit_logs WHERE ${where} ORDER BY datetime(created_at) DESC, id DESC`)
    .all(...params);

  const normalized = rows.map(normalizeAuditRow);
  const by_module = {};
  const by_action = {};
  const todayKey = new Date().toISOString().slice(0, 10);
  let today = 0;

  for (const row of normalized) {
    by_module[row.module] = (by_module[row.module] || 0) + 1;
    by_action[row.action] = (by_action[row.action] || 0) + 1;
    if (String(row.created_at || "").slice(0, 10) === todayKey) today += 1;
  }

  return {
    total: normalized.length,
    today,
    by_module,
    by_action,
    latest: normalized.slice(0, 10),
  };
}

module.exports = {
  VALID_MODULES,
  VALID_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  normalizeAction,
  normalizeAuditRow,
  createAuditLog,
  listAuditLogs,
  getAuditLog,
  buildAuditSummary,
};
