/**
 * FLEETOS AUD-3 — Before/After Diff Engine tests
 * node scripts/test-audit-diff-engine.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/auditDiffService",
  "/services/auditLogService",
  "/services/maintenanceService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-aud3-",
  "test-audit-diff-engine.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const auditDiffService = require("../services/auditDiffService");
const auditLogService = require("../services/auditLogService");
const maintenanceService = require("../services/maintenanceService");
const { auditLogsPageHtml, renderFormattedChangeGroups } = require("../lib/components/auditLogs");
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
  console.log("FLEETOS AUD-3 Before/After Diff Engine tests\n");

  test("currency formatting works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "cost", old_value: 8500, new_value: 9000 },
    ])[0];
    assert(formatted.old_display === "8.500 TL", formatted.old_display);
    assert(formatted.new_display === "9.000 TL", formatted.new_display);
  });

  test("km formatting works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "odometer_km", old_value: 245000, new_value: 255000 },
    ])[0];
    assert(formatted.old_display === "245.000 km", formatted.old_display);
    assert(formatted.new_display === "255.000 km", formatted.new_display);
  });

  test("date formatting works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "expiry_date", old_value: "2026-09-01", new_value: "2027-09-01" },
    ])[0];
    assert(formatted.old_display === "01.09.2026", formatted.old_display);
    assert(formatted.new_display === "01.09.2027", formatted.new_display);
  });

  test("enum formatting works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "season", old_value: "summer", new_value: "winter" },
      { field: "status", old_value: "in_storage", new_value: "on_vehicle" },
      { field: "change_type", old_value: "installed", new_value: "seasonal_swap" },
    ]);
    assert(formatted[0].old_display === "Yazlık", formatted[0].old_display);
    assert(formatted[0].new_display === "Kışlık", formatted[0].new_display);
    assert(formatted[1].new_display === "Araç Üzerinde", formatted[1].new_display);
    assert(formatted[2].new_display === "Sezon Değişimi", formatted[2].new_display);
  });

  test("added change detected", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "vendor", old_value: null, new_value: "Servis A" },
    ])[0];
    assert(formatted.change_type === "added", formatted.change_type);
  });

  test("removed change detected", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "note", old_value: "Eski not", new_value: "" },
    ])[0];
    assert(formatted.change_type === "removed", formatted.change_type);
  });

  test("modified change detected", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "cost", old_value: 8500, new_value: 9000 },
    ])[0];
    assert(formatted.change_type === "modified", formatted.change_type);
  });

  test("field labels work", () => {
    assert(auditDiffService.fieldLabel("cost") === "Maliyet", "cost");
    assert(auditDiffService.fieldLabel("odometer_km") === "KM", "km");
    assert(auditDiffService.fieldLabel("vendor") === "Servis / Tedarikçi", "vendor");
  });

  test("fallback label works", () => {
    assert(auditDiffService.fieldLabel("custom_field_name") === "Custom Field Name", "fallback");
  });

  test("grouping works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "cost", old_value: 8500, new_value: 9000 },
      { field: "odometer_km", old_value: 245000, new_value: 255000 },
      { field: "status", old_value: "in_storage", new_value: "on_vehicle" },
      { field: "description", old_value: "A", new_value: "B" },
    ]);
    const groups = auditDiffService.groupAuditChanges(formatted);
    const names = groups.map((g) => g.group);
    assert(names.includes("Finans"), names.join(","));
    assert(names.includes("Tarih / KM"), names.join(","));
    assert(names.includes("Durum / Sezon"), names.join(","));
    assert(names.includes("Genel"), names.join(","));
  });

  test("importance important works", () => {
    const formatted = auditDiffService.formatAuditChanges([
      { field: "cost", old_value: 8500, new_value: 9000 },
    ])[0];
    assert(formatted.importance === "important", formatted.importance);
  });

  test("importance critical works", () => {
    const disposed = auditDiffService.formatAuditChanges([
      { field: "status", old_value: "on_vehicle", new_value: "disposed" },
    ])[0];
    assert(disposed.importance === "critical", disposed.importance);

    const pastExpiry = auditDiffService.formatAuditChanges([
      { field: "expiry_date", old_value: "2026-09-01", new_value: "2020-01-01" },
    ])[0];
    assert(pastExpiry.importance === "critical", pastExpiry.importance);
  });

  const vehicleId = seedVehicle("16 AUD D3");
  const maintenance = maintenanceService.createMaintenanceRecord(
    {
      vehicle_id: vehicleId,
      maintenance_type: "engine_oil",
      maintenance_date: "2026-06-01",
      odometer_km: 245000,
      cost: 8500,
      vendor: "Servis",
    },
    { actor_id: "1", actor_name: "admin" }
  );

  maintenanceService.updateMaintenanceRecord(
    maintenance.id,
    { odometer_km: 255000, cost: 9000 },
    { actor_id: "1", actor_name: "admin" }
  );

  test("API includes formatted_changes", () => {
    const row = auditLogService.listAuditLogs({ module: "maintenance", action: "update", limit: 1 })[0];
    assert(Array.isArray(row.formatted_changes), "formatted_changes");
    assert(row.formatted_changes.length >= 2, `count ${row.formatted_changes.length}`);
    assert(row.formatted_changes[0].old_display, "old_display");
    assert(row.formatted_changes[0].new_display, "new_display");
  });

  test("API includes change_groups", () => {
    const row = auditLogService.listAuditLogs({ module: "maintenance", action: "update", limit: 1 })[0];
    assert(Array.isArray(row.change_groups), "change_groups");
    assert(row.change_groups.length >= 1, `groups ${row.change_groups.length}`);
    assert(row.metadata?.changes?.length >= 2, "raw changes preserved");
  });

  test("legacy audit rows still work", () => {
    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, note, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run("maintenance_delete", "maintenance_record", "legacy-diff", "Eski kayıt silindi");
    const row = auditLogService.getAuditLog(
      auditLogService.listAuditLogs({ entity_id: "legacy-diff", limit: 1 })[0].id
    );
    assert(row.summary.includes("silindi"), row.summary);
    assert(row.formatted_changes.length === 0, "no formatted changes");
    assert(row.change_count === 0, "change_count 0");
  });

  test("UI render helper does not crash", () => {
    const row = auditLogService.listAuditLogs({ module: "maintenance", action: "update", limit: 1 })[0];
    const groupedHtml = renderFormattedChangeGroups(row);
    assert(groupedHtml.includes("audit-diff"), "group html");
    const pageHtml = auditLogsPageHtml({
      summary: auditLogService.buildAuditSummary({}),
      records: auditLogService.listAuditLogs({ limit: 10 }),
      filters: { limit: "10" },
    });
    assert(pageHtml.includes("İşlem Geçmişi"), "page title");
    assert(pageHtml.includes("audit-diff") || pageHtml.includes("Değişim detayı"), "diff or empty");
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
