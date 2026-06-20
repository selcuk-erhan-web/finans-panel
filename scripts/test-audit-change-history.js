/**
 * FLEETOS AUD-2 — Change History tests
 * node scripts/test-audit-change-history.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/auditLogService",
  "/services/maintenanceService",
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/documentService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-aud2-",
  "test-audit-change-history.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const auditLogService = require("../services/auditLogService");
const maintenanceService = require("../services/maintenanceService");
const tireService = require("../services/tireService");
const tireHistoryService = require("../services/tireHistoryService");
const documentService = require("../services/documentService");
const { normalizePlate } = require("../utils/plate");

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, error: err.message || String(err) });
  console.error(`✗ ${name}: ${err.message || err}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function main() {
  console.log("FLEETOS AUD-2 Change History tests\n");

  test("computeChanges detects changed fields", () => {
    const changes = auditLogService.computeChanges(
      { cost: 8500, odometer_km: 245000, plate: "16 AUD 01" },
      { cost: 9000, odometer_km: 255000, plate: "16 AUD 01" }
    );
    assert(changes.length === 2, `changes ${changes.length}`);
    assert(changes.some((row) => row.field === "cost"), "cost");
    assert(changes.some((row) => row.field === "odometer_km"), "odometer_km");
  });

  test("unchanged fields ignored", () => {
    const changes = auditLogService.computeChanges(
      { cost: 8500, vendor: "Servis A" },
      { cost: 8500, vendor: "Servis A" }
    );
    assert(changes.length === 0, `changes ${changes.length}`);
  });

  test("created_at ignored", () => {
    const changes = auditLogService.computeChanges(
      { cost: 8500, created_at: "2026-01-01" },
      { cost: 9000, created_at: "2026-06-01" }
    );
    assert(changes.length === 1 && changes[0].field === "cost", "only cost");
  });

  test("updated_at ignored", () => {
    const changes = auditLogService.computeChanges(
      { cost: 8500, updated_at: "2026-01-01" },
      { cost: 9000, updated_at: "2026-06-01" }
    );
    assert(changes.length === 1 && changes[0].field === "cost", "only cost");
  });

  test("update audit log stores changes", () => {
    const result = auditLogService.createUpdateAuditLog({
      module: "system",
      entity_type: "test_entity",
      entity_id: "99",
      actor: { actor_id: "1", actor_name: "admin" },
      before: { cost: 8500, odometer_km: 245000 },
      after: { cost: 9000, odometer_km: 255000 },
      summary: "Test güncelleme",
    });
    assert(result.ok, result.error);
    const row = auditLogService.getAuditLog(result.id);
    assert(Array.isArray(row.metadata.changes), "changes array");
    assert(row.metadata.changes.length === 2, `changes ${row.metadata.changes.length}`);
  });

  test("no changes = no audit row", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get().c;
    const result = auditLogService.createUpdateAuditLog({
      module: "system",
      entity_type: "test_entity",
      entity_id: "100",
      actor: { actor_id: "1", actor_name: "admin" },
      before: { cost: 8500 },
      after: { cost: 8500 },
      summary: "Boş güncelleme",
    });
    const after = db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get().c;
    assert(result.skipped === true, "skipped");
    assert(before === after, "no new row");
  });

  const vehicleId = seedVehicle("16 AUD CH");
  const actor = { actor_id: "5", actor_name: "auditor" };

  const maintenance = maintenanceService.createMaintenanceRecord(
    {
      vehicle_id: vehicleId,
      maintenance_type: "engine_oil",
      maintenance_date: "2026-06-01",
      odometer_km: 245000,
      cost: 8500,
      vendor: "Servis",
    },
    actor
  );

  test("maintenance update emits change history", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'update' AND module = 'maintenance'").get().c;
    maintenanceService.updateMaintenanceRecord(
      maintenance.id,
      { odometer_km: 255000, cost: 9000 },
      actor
    );
    const after = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'update' AND module = 'maintenance'").get().c;
    assert(after === before + 1, `maintenance update audit ${before} -> ${after}`);
    const row = auditLogService.listAuditLogs({ module: "maintenance", action: "update", limit: 1 })[0];
    assert(row.metadata.changes.some((c) => c.field === "cost"), "cost change");
    assert(row.metadata.changes.some((c) => c.field === "odometer_km"), "km change");
  });

  const tire = tireService.createTireRecord(
    {
      vehicle_id: vehicleId,
      season: "summer",
      brand: "Michelin",
      quantity: 4,
      status: "on_vehicle",
      cost: 12000,
    },
    actor
  );

  test("tire update emits change history", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE entity_type = 'tire_record' AND action = 'update'").get().c;
    tireService.updateTireRecord(tire.id, { cost: 13500, brand: "Bridgestone" }, actor);
    const after = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE entity_type = 'tire_record' AND action = 'update'").get().c;
    assert(after === before + 1, "tire update audit");
    const row = auditLogService.listAuditLogs({ entity_type: "tire_record", action: "update", limit: 1 })[0];
    assert(row.metadata.changes.length >= 2, "tire changes");
  });

  const tireHistory = tireHistoryService.createTireChangeRecord(
    {
      vehicle_id: vehicleId,
      change_type: "seasonal_swap",
      change_date: "2026-05-01",
      season: "summer",
      quantity: 4,
      cost: 500,
    },
    actor
  );

  test("tire history update emits change history", () => {
    const before = db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE entity_type = 'tire_change_record' AND action = 'update'")
      .get().c;
    tireHistoryService.updateTireChangeRecord(tireHistory.id, { cost: 900, odometer_km: 255000 }, actor);
    const after = db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE entity_type = 'tire_change_record' AND action = 'update'")
      .get().c;
    assert(after === before + 1, "tire history update audit");
  });

  const document = documentService.create(
    {
      vehicle_id: vehicleId,
      document_type: "inspection",
      expiry_date: "2026-12-31",
      title: "Muayene",
    },
    actor
  );

  test("compliance update emits change history", () => {
    const before = db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'compliance' AND action = 'update'")
      .get().c;
    documentService.update(document.id, { expiry_date: "2027-06-30", note: "Uzatıldı" }, actor);
    const after = db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'compliance' AND action = 'update'")
      .get().c;
    assert(after === before + 1, "compliance update audit");
    const row = auditLogService.listAuditLogs({ module: "compliance", action: "update", limit: 1 })[0];
    assert(row.metadata.changes.some((c) => c.field === "expiry_date"), "expiry change");
  });

  test("entity-history endpoint works", () => {
    const payload = auditLogService.getEntityAuditHistory({
      module: "maintenance",
      entity_type: "maintenance_record",
      entity_id: maintenance.id,
    });
    assert(payload.entity.entity_id === String(maintenance.id), "entity id");
    assert(Array.isArray(payload.history), "history");
    assert(payload.history.length >= 2, `history ${payload.history.length}`);
  });

  test("legacy audit rows still readable", () => {
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, note, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run("maintenance_delete", "maintenance_record", "legacy-1", "Eski bakım kaydı silindi");
    const row = auditLogService.listAuditLogs({ entity_id: "legacy-1", limit: 1 })[0];
    assert(row.action === "delete", row.action);
    assert(row.summary.includes("silindi"), row.summary);
  });

  test("metadata safely parsed", () => {
    const row = auditLogService.getAuditLog(
      auditLogService.listAuditLogs({ module: "maintenance", action: "update", limit: 1 })[0].id
    );
    assert(row.metadata && Array.isArray(row.metadata.changes), "parsed metadata");
  });

  test("empty change list handled", () => {
    auditLogService.createAuditLog({
      module: "system",
      entity_type: "test_entity",
      entity_id: "empty",
      action: "update",
      summary: "Eski format güncelleme",
      metadata: { plate: "16 AUD CH" },
    });
    const row = auditLogService.getAuditLog(
      auditLogService.listAuditLogs({ entity_id: "empty", limit: 1 })[0].id
    );
    assert(!row.metadata?.changes?.length, "no changes");
  });

  console.log("\n--- PASS/FAIL SUMMARY ---");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`PASS: ${passed}/${results.length}`);
  if (failed.length) {
    console.log(`FAIL: ${failed.length}`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    cleanupTestDatabase(tmpDir);
    process.exit(1);
  }
  console.log("ALL TESTS PASSED");
  cleanupTestDatabase(tmpDir);
}

main();
