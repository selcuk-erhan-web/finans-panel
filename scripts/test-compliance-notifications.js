/**
 * FLEETOS CC-5 — Compliance notification center tests
 * node scripts/test-compliance-notifications.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/complianceStatusService",
  "/services/complianceNotificationService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-cc5-",
  "test-compliance-notifications.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const documentService = require("../services/documentService");
const complianceNotificationService = require("../services/complianceNotificationService");
const { notificationsPageHtml } = require("../lib/components/notifications");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");
const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  PASS  ${name}`);
}

function fail(name, msg) {
  results.push({ name, ok: false, err: msg });
  console.log(`  FAIL  ${name}: ${msg}`);
}

function assert(name, cond, msg) {
  if (cond) pass(name);
  else fail(name, msg);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')")
    .run(plate, norm).lastInsertRowid;
}

function seedDoc(vehicleId, expiryDate, suffix, type = "traffic_insurance") {
  return documentService.create({
    vehicle_id: vehicleId,
    document_type: type,
    expiry_date: expiryDate,
    policy_number: `CC5-${suffix}`,
  });
}

function countBySeverity(severity) {
  return db
    .prepare("SELECT COUNT(*) AS c FROM compliance_notifications WHERE severity = ?")
    .get(severity).c;
}

function main() {
  console.log("FLEETOS CC-5 Compliance Notification Center\n");

  const vehicleId = seedVehicle("16 CC5 01");
  seedDoc(vehicleId, addDays(REF, 45), "warning", "traffic_insurance");
  seedDoc(vehicleId, addDays(REF, 15), "critical", "casco");
  seedDoc(vehicleId, addDays(REF, -1), "expired", "inspection");

  console.log("1) Notification creation");
  const firstRun = complianceNotificationService.generateComplianceNotifications(REF);
  assert("warning notification created", countBySeverity("warning") === 1, `got ${countBySeverity("warning")}`);
  assert("critical notification created", countBySeverity("critical") === 1, `got ${countBySeverity("critical")}`);
  assert("expired notification created", countBySeverity("expired") === 1, `got ${countBySeverity("expired")}`);
  assert("generator created rows", firstRun.created === 3, `created ${firstRun.created}`);

  console.log("\n2) Duplicate prevention");
  const secondRun = complianceNotificationService.generateComplianceNotifications(REF);
  assert("repeated generator creates zero", secondRun.created === 0, `created ${secondRun.created}`);
  assert(
    "total notifications remain 3",
    db.prepare("SELECT COUNT(*) AS c FROM compliance_notifications").get().c === 3,
    "duplicate rows inserted"
  );

  console.log("\n3) Unread count and read state");
  assert(
    "unread count",
    complianceNotificationService.getUnreadCount() === 3,
    `got ${complianceNotificationService.getUnreadCount()}`
  );

  const unread = complianceNotificationService.listNotifications("unread");
  const target = unread[0];
  assert("list unread returns items", unread.length === 3, `got ${unread.length}`);

  const marked = complianceNotificationService.markNotificationRead(target.id);
  assert("mark read updates status", marked?.status === "read", `status ${marked?.status}`);
  assert(
    "unread count decreases",
    complianceNotificationService.getUnreadCount() === 2,
    `got ${complianceNotificationService.getUnreadCount()}`
  );
  assert(
    "read notification remains stored",
    complianceNotificationService.getNotificationById(target.id)?.status === "read",
    "missing read row"
  );

  console.log("\n4) API payload validation");
  const payload = complianceNotificationService.getApiPayload("all", REF);
  assert("payload unread_count", typeof payload.unread_count === "number", "missing unread_count");
  assert("payload notifications array", Array.isArray(payload.notifications), "missing notifications");
  assert(
    "payload fields present on items",
    payload.notifications.every((n) => n.id && n.severity && n.message && n.status),
    "invalid notification shape"
  );
  assert(
    "source_key stored",
    payload.notifications.every((n) => n.source_key),
    "missing source_key"
  );

  console.log("\n5) Filters and empty state");
  const warningOnly = complianceNotificationService.listNotifications("warning");
  assert("warning filter", warningOnly.every((n) => n.severity === "warning"), "warning filter failed");

  seedVehicle("16 CC5 EMPTY");
  complianceNotificationService.generateComplianceNotifications(REF);
  pass("empty vehicle does not crash generator");

  const pageHtml = notificationsPageHtml({
    notifications: payload.notifications,
    unreadCount: payload.unread_count,
    filter: "all",
  });
  assert("notification page renders", pageHtml.includes("Compliance Notifications"), "missing page title");
  assert("unread filter UI", pageHtml.includes("Okunmamış"), "missing unread filter");

  const failed = results.filter((row) => !row.ok);
  console.log("\n" + "=".repeat(48));
  if (failed.length) {
    console.log(`RESULT: FAIL (${failed.length}/${results.length} checks failed)`);
    process.exitCode = 1;
  } else {
    console.log(`RESULT: PASS (${results.length}/${results.length} checks passed)`);
  }
}

try {
  main();
} catch (err) {
  console.error("\nUnexpected error:", err.message);
  process.exit(1);
} finally {
  cleanupTestDatabase(tmpDir);
}
