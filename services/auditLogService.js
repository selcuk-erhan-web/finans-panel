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

const DEFAULT_IGNORE_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
]);

const DERIVED_FIELD_SUFFIX = "_label";

function normalizeCompareValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEqual(a, b) {
  const left = normalizeCompareValue(a);
  const right = normalizeCompareValue(b);
  if (left === right) return true;
  if (left == null && right == null) return true;
  return false;
}

function computeChanges(beforeRecord, afterRecord, options = {}) {
  const ignore = new Set([...DEFAULT_IGNORE_FIELDS, ...(options.ignore || [])]);
  const before = beforeRecord && typeof beforeRecord === "object" ? beforeRecord : {};
  const after = afterRecord && typeof afterRecord === "object" ? afterRecord : {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];

  for (const field of keys) {
    if (ignore.has(field)) continue;
    if (field.endsWith(DERIVED_FIELD_SUFFIX)) continue;
    const oldVal = before[field];
    const newVal = after[field];
    if (valuesEqual(oldVal, newVal)) continue;
    changes.push({
      field,
      old_value: oldVal === undefined ? null : oldVal,
      new_value: newVal === undefined ? null : newVal,
    });
  }

  const maxChanges = Number(options.maxChanges) > 0 ? Number(options.maxChanges) : 50;
  return changes.slice(0, maxChanges);
}

function sanitizeChangeValue(value) {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  try {
    const text = JSON.stringify(value);
    return text.length <= 500 ? JSON.parse(text) : text.slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

function compactChanges(changes) {
  return (changes || []).map((row) => ({
    field: row.field,
    old_value: sanitizeChangeValue(row.old_value),
    new_value: sanitizeChangeValue(row.new_value),
  }));
}

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

function createUpdateAuditLog({
  module,
  entity_type,
  entity_id,
  actor,
  before,
  after,
  summary,
  metadata = {},
}) {
  try {
    const changes = compactChanges(computeChanges(before, after));
    if (!changes.length) {
      return { ok: true, skipped: true, reason: "no_changes" };
    }

    const actor_id = sanitizeText(actor?.actor_id || "system", 64) || "system";
    const actor_name = sanitizeText(actor?.actor_name || "System", 128) || "System";

    return createAuditLog({
      module,
      entity_type,
      entity_id,
      action: "update",
      actor_id,
      actor_name,
      summary,
      metadata: {
        ...metadata,
        changes,
      },
    });
  } catch (err) {
    console.error("createUpdateAuditLog:", err.message);
    return { ok: false, error: err.message || "Güncelleme audit kaydı yazılamadı." };
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

function getEntityAuditHistory(filters = {}) {
  const module = sanitizeText(filters.module, 64);
  const entity_type = sanitizeText(filters.entity_type, 128);
  const entity_id = filters.entity_id != null ? String(filters.entity_id) : "";

  if (!module || !entity_type || !entity_id) {
    throw new Error("module, entity_type ve entity_id zorunlu.");
  }

  const history = listAuditLogs({
    module,
    entity_type,
    entity_id,
    limit: filters.limit || 100,
  });

  return {
    entity: {
      module,
      entity_type,
      entity_id,
    },
    history,
  };
}

module.exports = {
  VALID_MODULES,
  VALID_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  DEFAULT_IGNORE_FIELDS,
  normalizeAction,
  normalizeAuditRow,
  computeChanges,
  createAuditLog,
  createUpdateAuditLog,
  listAuditLogs,
  getAuditLog,
  buildAuditSummary,
  getEntityAuditHistory,
};
