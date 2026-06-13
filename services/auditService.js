const db = require("../lib/db");

function serialize(val) {
  if (val == null) return null;
  if (typeof val === "string") return val.slice(0, 4000);
  try {
    return JSON.stringify(val).slice(0, 4000);
  } catch {
    return String(val).slice(0, 4000);
  }
}

function log(action, entityType, entityId = null, oldValue = null, newValue = null, note = null) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      action,
      entityType,
      entityId != null ? String(entityId) : null,
      serialize(oldValue),
      serialize(newValue),
      note ? String(note).slice(0, 500) : null
    );
  } catch (e) {
    console.error("Audit log yazılamadı:", e.message);
  }
}

module.exports = { log };
