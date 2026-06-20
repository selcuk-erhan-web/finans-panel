/**
 * FLEETOS AUD-1 — Audit Log Foundation tests
 * node scripts/test-audit-log.js
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

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-aud1-", "test-audit-log.js", CACHE_PATTERNS);

const db = require("../lib/db");
const auditLogService = require("../services/auditLogService");
const maintenanceService = require("../services/maintenanceService");
const tireService = require("../services/tireService");
const { resolveAuditActor } = require("../lib/auditActor");
const { auditLogsPageHtml } = require("../lib/components/auditLogs");
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
  console.log("FLEETOS AUD-1 Audit Log Foundation tests\n");

  test("create audit log", () => {
    const result = auditLogService.createAuditLog({
      module: "system",
      entity_type: "test_entity",
      entity_id: "1",
      action: "create",
      actor_id: "1",
      actor_name: "admin",
      summary: "Test audit kaydı oluşturuldu.",
      metadata: { sample: true },
    });
    assert(result.ok, result.error || "create failed");
    assert(result.id, "missing id");
  });

  test("get audit log", () => {
    const row = auditLogService.getAuditLog(1);
    assert(row, "row missing");
    assert(row.module === "system", row.module);
    assert(row.summary.includes("Test audit"), row.summary);
  });

  test("list audit logs", () => {
    auditLogService.createAuditLog({
      module: "maintenance",
      entity_type: "maintenance_record",
      entity_id: "10",
      action: "update",
      summary: "Bakım güncellendi.",
      metadata: { plate: "16 AUD 01" },
    });
    const rows = auditLogService.listAuditLogs({ limit: 10 });
    assert(rows.length >= 2, `rows ${rows.length}`);
  });

  test("filter by module", () => {
    const rows = auditLogService.listAuditLogs({ module: "maintenance", limit: 20 });
    assert(rows.every((row) => row.module === "maintenance"), "module filter");
    assert(rows.length >= 1, "maintenance rows");
  });

  test("filter by action", () => {
    const rows = auditLogService.listAuditLogs({ action: "update", limit: 20 });
    assert(rows.every((row) => row.action === "update"), "action filter");
  });

  test("filter by entity_type", () => {
    const rows = auditLogService.listAuditLogs({ entity_type: "maintenance_record", limit: 20 });
    assert(rows.every((row) => row.entity_type === "maintenance_record"), "entity_type filter");
  });

  test("date filter works", () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = auditLogService.listAuditLogs({ date_from: today, date_to: today, limit: 50 });
    assert(rows.length >= 1, `today rows ${rows.length}`);
  });

  test("summary total works", () => {
    const summary = auditLogService.buildAuditSummary({ limit: 50 });
    assert(typeof summary.total === "number", "total");
    assert(summary.total >= 2, `total ${summary.total}`);
  });

  test("by_module works", () => {
    const summary = auditLogService.buildAuditSummary({});
    assert(summary.by_module.system >= 1, "system module");
    assert(summary.by_module.maintenance >= 1, "maintenance module");
  });

  test("by_action works", () => {
    const summary = auditLogService.buildAuditSummary({});
    assert(summary.by_action.create >= 1, "create action");
    assert(summary.by_action.update >= 1, "update action");
  });

  test("fail-safe behavior works", () => {
    const bad = auditLogService.createAuditLog({
      module: "invalid_module",
      entity_type: "x",
      action: "create",
      summary: "bad",
    });
    assert(bad.ok === false, "should fail safely");
    assert(bad.error, "error message");
  });

  test("metadata JSON handled safely", () => {
    const result = auditLogService.createAuditLog({
      module: "compliance",
      entity_type: "vehicle_document",
      entity_id: "55",
      action: "import",
      summary: "Belge içe aktarıldı.",
      metadata: { plate: "34 AUD 99", document_type: "inspection" },
    });
    assert(result.ok, result.error);
    const row = auditLogService.getAuditLog(result.id);
    assert(row.metadata && row.metadata.plate === "34 AUD 99", "metadata parsed");
  });

  test("append-only behavior does not expose delete", () => {
    const routeSource = require("fs").readFileSync(
      require("path").join(__dirname, "../routes/auditLogs.js"),
      "utf8"
    );
    assert(!/app\.delete\(\s*["']\/api\/audit-logs/.test(routeSource), "no delete API");
    assert(!/DELETE FROM audit_logs/.test(routeSource), "no delete SQL in route");
  });

  const vehicleId = seedVehicle("16 AUD MNT");

  test("maintenance create emits audit log if integrated", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'maintenance'").get().c;
    maintenanceService.createMaintenanceRecord(
      {
        vehicle_id: vehicleId,
        maintenance_type: "engine_oil",
        maintenance_date: "2026-06-01",
        odometer_km: 45000,
        cost: 8500,
        vendor: "Servis",
      },
      { actor_id: "7", actor_name: "auditor" }
    );
    const after = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'maintenance'").get().c;
    assert(after === before + 1, `maintenance audit ${before} -> ${after}`);
    const latest = auditLogService.listAuditLogs({ module: "maintenance", action: "create", limit: 1 })[0];
    assert(latest.actor_name === "auditor", latest.actor_name);
    assert(latest.summary.includes("16 AUD MNT"), latest.summary);
  });

  test("tire create emits audit log if integrated", () => {
    const before = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'tire'").get().c;
    tireService.createTireRecord(
      {
        vehicle_id: vehicleId,
        season: "summer",
        brand: "Michelin",
        quantity: 4,
        status: "on_vehicle",
        cost: 12000,
      },
      { actor_id: "8", actor_name: "auditor" }
    );
    const after = db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE module = 'tire'").get().c;
    assert(after === before + 1, `tire audit ${before} -> ${after}`);
  });

  test("resolveAuditActor defaults to system", () => {
    const actor = resolveAuditActor({});
    assert(actor.actor_id === "system", actor.actor_id);
    assert(actor.actor_name === "System", actor.actor_name);
  });

  test("UI page renders", () => {
    const summary = auditLogService.buildAuditSummary({});
    const records = auditLogService.listAuditLogs({ limit: 20 });
    const html = auditLogsPageHtml({ summary, records, filters: { limit: "20" } });
    assert(html.includes("İşlem Geçmişi"), "title");
    assert(html.includes("Toplam İşlem"), "summary cards");
    assert(html.includes("İşlem Listesi"), "table");
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
