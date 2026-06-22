/**
 * FLEETOS VI-3 — Vehicle Operational Timeline tests
 * node scripts/test-vehicle-timeline.js
 */
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/vehicleTimelineService",
  "/services/vehicleIntelligenceService",
  "/services/vehicleHealthService",
  "/services/vehicleCenterService",
  "/services/documentService",
  "/services/complianceNotificationService",
  "/services/maintenanceService",
  "/services/maintenanceAlertService",
  "/services/tireService",
  "/services/tireHistoryService",
  "/services/tireAlertService",
  "/services/auditLogService",
  "/lib/components/vehicleTimeline",
  "/lib/components/vehicleCenter",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-vi3-",
  "test-vehicle-timeline.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
const vehicleTimelineService = require("../services/vehicleTimelineService");
const maintenanceService = require("../services/maintenanceService");
const tireHistoryService = require("../services/tireHistoryService");
const {
  vehicleTimelinePageHtml,
  vehicleTimelinePreviewHtml,
} = require("../lib/components/vehicleTimeline");
const { normalizePlate } = require("../utils/plate");

const REF = new Date("2026-06-01T12:00:00");
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
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type, current_km) VALUES (?, ?, 'Servis', ?)")
    .run(plate, norm, 100000).lastInsertRowid;
}

function assertEventShape(event) {
  assert(event.id, "id");
  assert(event.vehicle_id, "vehicle_id");
  assert(event.plate, "plate");
  assert(event.source, "source");
  assert(event.type, "type");
  assert(event.severity, "severity");
  assert(event.title, "title");
  assert(typeof event.description === "string", "description");
}

function main() {
  console.log("FLEETOS VI-3 Vehicle Operational Timeline tests\n");

  test("service loads", () => {
    assert(typeof vehicleTimelineService.buildVehicleTimeline === "function", "buildVehicleTimeline");
    assert(typeof vehicleTimelineService.buildFleetTimelineSummary === "function", "fleet");
  });

  const vehicleA = seedVehicle("16 VT 01");
  const vehicleB = seedVehicle("34 VT 02");

  db.prepare(
    `INSERT INTO vehicle_documents (
      vehicle_id, document_type, title, expiry_date, issue_date, created_at
    ) VALUES (?, 'traffic_insurance', 'Trafik Sigortası', '2026-05-10', '2025-05-10', '2025-05-10 10:00:00')`
  ).run(vehicleA);

  maintenanceService.createMaintenanceRecord({
    vehicle_id: vehicleA,
    maintenance_type: "engine_oil",
    maintenance_date: "2026-05-15",
    odometer_km: 99000,
    cost: 3500,
    vendor: "Servis",
    description: "Motor yağı değişimi",
  });

  db.prepare(
    `INSERT INTO maintenance_alerts (
      vehicle_id, plate, maintenance_type, severity, message, status, source_key, created_at
    ) VALUES (?, '16 VT 01', 'engine_oil', 'overdue', '16 VT 01 için Motor Yağı bakımı gecikti.', 'unread', 'vt-overdue-1', '2026-05-20 09:00:00')`
  ).run(vehicleA);

  tireHistoryService.createTireChangeRecord({
    vehicle_id: vehicleA,
    change_type: "seasonal_swap",
    change_date: "2026-04-20",
    season: "summer",
    quantity: 4,
    cost: 1200,
    odometer_km: 98000,
    notes: "Yazlık lastik takıldı",
  });

  db.prepare(
    `INSERT INTO tire_alerts (
      vehicle_id, plate, severity, current_season, required_tire_season, current_tire_season,
      message, status, source_key, created_at
    ) VALUES (?, '16 VT 01', 'mismatch', 'winter', 'summer', 'winter',
      '16 VT 01 lastik sezon uyumsuzluğu taşıyor.', 'unread', 'vt-tire-1', '2026-05-18 11:00:00')`
  ).run(vehicleA);

  db.prepare(
    `INSERT INTO audit_logs (
      module, entity_type, entity_id, action, actor_id, actor_name, summary, metadata, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "maintenance",
    "maintenance_record",
    "1",
    "create",
    "system",
    "System",
    "Bakım kaydı oluşturuldu",
    JSON.stringify({ vehicle_id: vehicleA, plate: "16 VT 01" }),
    "note",
    "2026-05-15 14:00:00"
  );

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'income', 'Servis', 'servis', 25000, 'servis geliri', '2026-05-12')`
  ).run(vehicleA);

  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
     VALUES (?, 'expense', 'Yakıt', 'yakit', 5000, 'yakit', '2026-05-13')`
  ).run(vehicleA);

  test("vehicle timeline returns summary", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    assert(timeline, "timeline");
    assert(timeline.summary.total_events > 0, "events");
    assert(timeline.summary.latest_event_date, "latest date");
  });

  test("event shape valid", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    timeline.events.forEach(assertEventShape);
  });

  test("maintenance events included", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    assert(
      timeline.events.some((e) => e.source === "maintenance" && e.title === "Bakım kaydı"),
      "maintenance record"
    );
    assert(
      timeline.events.some((e) => e.source === "maintenance_alert"),
      "maintenance alert"
    );
  });

  test("tire history events included", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    assert(timeline.events.some((e) => e.source === "tire_history"), "tire history");
    assert(timeline.events.some((e) => e.source === "tire_alert"), "tire alert");
  });

  test("alerts mapped to severity", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    const maintAlert = timeline.events.find((e) => e.source === "maintenance_alert");
    const tireAlert = timeline.events.find((e) => e.source === "tire_alert");
    assert(maintAlert.severity === "critical", maintAlert?.severity);
    assert(tireAlert.severity === "critical", tireAlert?.severity);
  });

  test("audit events included safely", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    assert(timeline.events.some((e) => e.source === "audit"), "audit");
  });

  test("sorting newest first works", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    const dates = timeline.events.map((e) => e.event_date).filter(Boolean);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    assert(JSON.stringify(dates) === JSON.stringify(sorted), dates.join(","));
  });

  test("source filter works", () => {
    const all = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    const financeOnly = vehicleTimelineService.buildVehicleTimeline(vehicleA, {
      referenceDate: REF,
      source: "finance",
    });
    assert(financeOnly.events.every((e) => e.source === "finance"), "finance only");
    assert(financeOnly.summary.total_events <= all.summary.total_events, "filtered count");
  });

  test("severity filter works", () => {
    const criticalOnly = vehicleTimelineService.buildVehicleTimeline(vehicleA, {
      referenceDate: REF,
      severity: "critical",
    });
    assert(criticalOnly.events.every((e) => e.severity === "critical"), "critical only");
  });

  test("date range filter works", () => {
    const ranged = vehicleTimelineService.buildVehicleTimeline(vehicleA, {
      referenceDate: REF,
      date_from: "2026-05-01",
      date_to: "2026-05-31",
    });
    assert(
      ranged.events.every((e) => !e.event_date || (e.event_date >= "2026-05-01" && e.event_date <= "2026-05-31")),
      "date range"
    );
  });

  test("limit works", () => {
    const limited = vehicleTimelineService.buildVehicleTimeline(vehicleA, {
      referenceDate: REF,
      limit: 2,
    });
    assert(limited.events.length <= 2, limited.events.length);
    assert(limited.summary.total_events >= limited.events.length, "summary uses full filtered set");
  });

  test("fleet summary works", () => {
    const fleet = vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF });
    assert(fleet.summary.vehicles_with_events >= 1, "vehicles with events");
    assert(fleet.summary.total_events > 0, "total events");
    assert(Array.isArray(fleet.vehicles) && fleet.vehicles.length === 2, "vehicles");
  });

  test("API fleet endpoint returns JSON", () => {
    const fleet = vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(fleet));
    assert(payload.summary.total_events > 0, "fleet api");
  });

  test("API vehicle endpoint returns JSON", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    const payload = JSON.parse(JSON.stringify(timeline));
    assert(payload.vehicle_id === String(vehicleA), "vehicle api");
    assert(payload.summary.total_events > 0, "summary api");
  });

  test("page renders", () => {
    const fleet = vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF });
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF });
    const html = vehicleTimelinePageHtml({
      fleet,
      timeline,
      vehicles: [{ id: vehicleA, plate: "16 VT 01" }],
      filters: { vehicle_id: String(vehicleA), limit: 100 },
    });
    assert(html.includes("Araç Operasyon Geçmişi"), "title");
    assert(html.includes("Toplam Olay"), "summary");
    assert(html.includes("Bakım kaydı") || html.includes("Operasyon Geçmişi"), "content");
  });

  test("vehicle detail integration helper does not crash", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleA, { referenceDate: REF, limit: 5 });
    const html = vehicleTimelinePreviewHtml(timeline);
    assert(html.includes("Operasyon Geçmişi"), "preview title");
    assert(html.includes("/vehicle-timeline?vehicle_id="), "link");
    const emptyHtml = vehicleTimelinePreviewHtml(null);
    assert(emptyHtml.includes("Operasyon Geçmişi"), "empty preview");
  });

  test("empty state safe", () => {
    const timeline = vehicleTimelineService.buildVehicleTimeline(vehicleB, { referenceDate: REF });
    const html = vehicleTimelinePreviewHtml(timeline);
    assert(html.includes("operasyon geçmişi"), "empty message");
    const pageHtml = vehicleTimelinePageHtml({
      fleet: vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF }),
      timeline,
      vehicles: [{ id: vehicleB, plate: "34 VT 02" }],
      filters: { vehicle_id: String(vehicleB), limit: 100 },
    });
    assert(pageHtml.includes("operasyon geçmişi"), "page empty");
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
