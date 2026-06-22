/**
 * FLEETOS STB-2 — v1.1 Vehicle Intelligence stabilization
 * node scripts/test-v11-stabilization.js
 */
const fs = require("fs");
const path = require("path");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/executiveVehicleDashboardService",
  "/services/vehicleProfitRiskService",
  "/services/vehicleHealthService",
  "/services/vehicleIntelligenceService",
  "/services/vehicleTimelineService",
  "/services/roadmapService",
  "/services/vehicleCenterService",
  "/lib/components/executiveVehicleDashboard",
  "/lib/components/vehicleProfitRisk",
  "/lib/components/vehicleHealth",
  "/lib/components/vehicleIntelligence",
  "/lib/components/vehicleTimeline",
  "/lib/components/vehicleCenter",
  "/lib/components/roadmap",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb2-",
  "test-v11-stabilization.js",
  CACHE_PATTERNS
);

const { NAV_TREE } = require("../lib/navConfig");
const LAYOUT_VERSION = require("../lib/layout-version");
const executiveVehicleDashboardService = require("../services/executiveVehicleDashboardService");
const vehicleProfitRiskService = require("../services/vehicleProfitRiskService");
const vehicleHealthService = require("../services/vehicleHealthService");
const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const vehicleTimelineService = require("../services/vehicleTimelineService");
const roadmapService = require("../services/roadmapService");
const { getVehicleCenterBundle } = require("../services/vehicleCenterService");
const { vehicleIntelligencePageHtml, vehicleIntelligenceSummaryHtml } = require("../lib/components/vehicleIntelligence");
const { vehicleHealthPageHtml, vehicleHealthSummaryHtml, vehicleHealthDashboardWidgetHtml } = require("../lib/components/vehicleHealth");
const { vehicleTimelinePageHtml, vehicleTimelinePreviewHtml } = require("../lib/components/vehicleTimeline");
const { vehicleProfitRiskPageHtml, vehicleProfitRiskSummaryHtml, vehicleProfitRiskDashboardWidgetHtml } = require("../lib/components/vehicleProfitRisk");
const {
  executiveVehicleDashboardPageHtml,
  executiveVehicleDashboardWidgetHtml,
  executiveVehicleDashboardCrossLinkHtml,
} = require("../lib/components/executiveVehicleDashboard");
const { vehicleCenterPageHtml } = require("../lib/components/vehicleCenter");
const { roadmapPageHtml } = require("../lib/components/roadmap");
const { normalizePlate } = require("../utils/plate");

const db = require("../lib/db");
const REF = new Date("2026-06-01T12:00:00");
const results = [];

const V11_ROUTES = [
  ["/roadmap/v1.1", "routes/roadmap.js"],
  ["/api/roadmap/v1.1", "routes/roadmap.js"],
  ["/vehicle-intelligence", "routes/vehicleIntelligence.js"],
  ["/api/vehicle-intelligence", "routes/vehicleIntelligence.js"],
  ["/api/vehicle-intelligence/:vehicleId", "routes/vehicleIntelligence.js"],
  ["/vehicle-health", "routes/vehicleHealth.js"],
  ["/api/vehicle-health", "routes/vehicleHealth.js"],
  ["/api/vehicle-health/:vehicleId", "routes/vehicleHealth.js"],
  ["/vehicle-timeline", "routes/vehicleTimeline.js"],
  ["/api/vehicle-timeline", "routes/vehicleTimeline.js"],
  ["/api/vehicle-timeline/:vehicleId", "routes/vehicleTimeline.js"],
  ["/vehicle-profit-risk", "routes/vehicleProfitRisk.js"],
  ["/api/vehicle-profit-risk", "routes/vehicleProfitRisk.js"],
  ["/api/vehicle-profit-risk/:vehicleId", "routes/vehicleProfitRisk.js"],
  ["/executive-vehicle-dashboard", "routes/executiveVehicleDashboard.js"],
  ["/api/executive-vehicle-dashboard", "routes/executiveVehicleDashboard.js"],
];

const EXPECTED_FLEET_VI = [
  "Araç Merkezi",
  "Araç Zekâsı",
  "Araç Sağlık Skoru",
  "Araç Operasyon Geçmişi",
  "Araç Kâr / Risk Analizi",
  "Yönetici Araç Zekâsı",
];

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

function normalizeRoutePath(pathValue) {
  if (Array.isArray(pathValue)) return pathValue.map(String).join("|");
  return String(pathValue);
}

function createRouteCollector() {
  const routes = [];
  const app = {
    get(pathValue, ...handlers) {
      routes.push({ method: "GET", path: normalizeRoutePath(pathValue), handlers });
    },
    post() {},
    put() {},
    delete() {},
    use() {},
  };
  return { app, routes };
}

function registerV11Routes(app) {
  require("../routes/roadmap")(app);
  require("../routes/vehicleIntelligence")(app);
  require("../routes/vehicleHealth")(app);
  require("../routes/vehicleTimeline")(app);
  require("../routes/vehicleProfitRisk")(app);
  require("../routes/executiveVehicleDashboard")(app);
}

function routePaths(routes) {
  return routes.filter((row) => row.method === "GET").map((row) => row.path);
}

function seedVehicle(plate) {
  const norm = normalizePlate(plate);
  return db
    .prepare("INSERT INTO vehicles (plate, plate_normalized, type, current_km) VALUES (?, ?, 'Servis', ?)")
    .run(plate, norm, 100000).lastInsertRowid;
}

function assertSafeArray(value, label) {
  assert(Array.isArray(value), `${label} must be array`);
}

function main() {
  console.log("FLEETOS STB-2 v1.1 Stabilization tests\n");

  const { app, routes } = createRouteCollector();
  registerV11Routes(app);
  const getPaths = routePaths(routes);
  const duplicates = getPaths.filter((p, i) => getPaths.indexOf(p) !== i);

  test("v1.1 routes registered", () => {
    assert(duplicates.length === 0, `duplicate routes: ${[...new Set(duplicates)].join(", ")}`);
    for (const [routePath, file] of V11_ROUTES) {
      const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      assert(source.includes(routePath.replace(":vehicleId", ":vehicleId")), `source missing ${routePath} in ${file}`);
      assert(getPaths.includes(routePath), `collector missing ${routePath}`);
    }

    const viFleet = getPaths.indexOf("/api/vehicle-intelligence");
    const viSingle = getPaths.indexOf("/api/vehicle-intelligence/:vehicleId");
    assert(viFleet >= 0 && viSingle > viFleet, "vehicle intelligence route order");

    const vhFleet = getPaths.indexOf("/api/vehicle-health");
    const vhSingle = getPaths.indexOf("/api/vehicle-health/:vehicleId");
    assert(vhFleet >= 0 && vhSingle > vhFleet, "vehicle health route order");
  });

  test("v1.1 nav items exist and ordered", () => {
    const fleet = NAV_TREE.find((node) => node.id === "fleet");
    const system = NAV_TREE.find((node) => node.id === "system");
    assert(fleet, "fleet group");

    const labels = fleet.items.map(([, label]) => label);
    for (let i = 0; i < EXPECTED_FLEET_VI.length; i += 1) {
      assert(labels[i] === EXPECTED_FLEET_VI[i], `fleet[${i}] expected ${EXPECTED_FLEET_VI[i]}, got ${labels[i]}`);
    }

    const hrefs = fleet.items.map(([href]) => href);
    const uniqueHrefs = new Set(hrefs);
    assert(uniqueHrefs.size === hrefs.length, "duplicate fleet hrefs");
    const uniqueLabels = new Set(labels);
    assert(uniqueLabels.size === labels.length, "duplicate fleet labels");

    assert(system.items.some(([href, label]) => href === "/audit-logs" && label === "İşlem Geçmişi"), "audit logs");
    assert(system.items.some(([href, label]) => href === "/audit-analytics" && label === "Denetim Analitiği"), "audit analytics");
    assert(system.items.some(([href, label]) => href === "/release" && label === "Release Candidate"), "release");
    assert(system.items.some(([href, label]) => href === "/production" && label === "Production Release"), "production");
    assert(system.items.some(([href, label]) => href === "/roadmap/v1.1" && label === "v1.1 Roadmap"), "roadmap");
  });

  test("dashboard widget hooks exist", () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, "..", "routes/dashboard.js"), "utf8");
    const widgets = [
      "vehicleHealthDashboardWidgetHtml()",
      "vehicleProfitRiskDashboardWidgetHtml()",
      "executiveVehicleDashboardWidgetHtml()",
      "cmd-vi-widget-stack",
    ];
    widgets.forEach((token) => assert(dashboardSource.includes(token), `missing ${token}`));

    const healthIdx = dashboardSource.indexOf(widgets[0]);
    const profitIdx = dashboardSource.indexOf(widgets[1]);
    const execIdx = dashboardSource.indexOf(widgets[2]);
    assert(healthIdx < profitIdx && profitIdx < execIdx, "v1.1 widget order");

    const healthWidget = vehicleHealthDashboardWidgetHtml();
    const profitWidget = vehicleProfitRiskDashboardWidgetHtml();
    const execWidget = executiveVehicleDashboardWidgetHtml();
    assert(healthWidget.includes('id="vehicleHealthDashboardWidget"'), "health widget id");
    assert(profitWidget.includes('id="vehicleProfitRiskDashboardWidget"'), "profit widget id");
    assert(execWidget.includes('id="executiveVehicleDashboardWidget"'), "executive widget id");
    assert(healthWidget.includes("vehicle-health-dashboard.js"), "health script");
    assert(profitWidget.includes("vehicle-profit-risk-dashboard.js"), "profit script");
    assert(execWidget.includes("executive-vehicle-dashboard.js"), "executive script");
  });

  test("vehicle detail integration hooks exist", () => {
    const centerSource = fs.readFileSync(path.join(__dirname, "..", "lib/components/vehicleCenter.js"), "utf8");
    const hooks = [
      "vehicleIntelligenceSummaryHtml",
      "vehicleHealthSummaryHtml",
      "vehicleTimelinePreviewHtml",
      "vehicleProfitRiskSummaryHtml",
      "executiveVehicleDashboardCrossLinkHtml",
    ];
    hooks.forEach((token) => assert(centerSource.includes(token), `missing ${token}`));
  });

  test("v1.1 APIs return safe shapes", () => {
    const vehicleId = seedVehicle("16 STB 01");
    db.prepare(
      "INSERT INTO transactions (vehicle_id, type, category_slug, category, amount, date, note) VALUES (?, 'income', 'service', 'Servis', ?, '2026-05-15', 'gelir')"
    ).run(vehicleId, 100000);

    const intelligence = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const health = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    const timeline = vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF });
    const profitRisk = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const executive = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });
    const roadmap = roadmapService.getV11Roadmap();

    assertSafeArray(intelligence.vehicles, "intelligence.vehicles");
    assertSafeArray(health.vehicles, "health.vehicles");
    assertSafeArray(timeline.vehicles, "timeline.vehicles");
    assertSafeArray(profitRisk.vehicles, "profitRisk.vehicles");
    assertSafeArray(executive.top_performers, "executive.top_performers");
    assertSafeArray(executive.highest_risk, "executive.highest_risk");
    assertSafeArray(executive.action_priorities, "executive.action_priorities");
    assertSafeArray(executive.executive_insights, "executive.executive_insights");

    assert(vehicleIntelligenceService.buildVehicleIntelligence("invalid") === null, "invalid intelligence id");
    assert(vehicleHealthService.buildVehicleHealthReport("0") === null, "invalid health id");
    assert(vehicleTimelineService.buildVehicleTimeline("abc") === null, "invalid timeline id");
    assert(vehicleProfitRiskService.buildVehicleProfitRisk("999999") === null, "missing profit risk id");

    JSON.parse(JSON.stringify({ intelligence, health, timeline, profitRisk, executive, roadmap }));
  });

  test("empty-state render helpers do not crash", () => {
    const emptyPayloads = [
      vehicleIntelligencePageHtml({ summary: {}, vehicles: [] }),
      vehicleHealthPageHtml({ summary: {}, vehicles: [] }),
      vehicleTimelinePageHtml({
        fleet: { summary: {}, vehicles: [] },
        timeline: null,
        vehicles: [],
        filters: { limit: 100 },
      }),
      vehicleProfitRiskPageHtml({ summary: {}, vehicles: [] }),
      executiveVehicleDashboardPageHtml({
        summary: {},
        top_performers: [],
        highest_risk: [],
        action_priorities: [],
        fleet_distribution: { health: {}, profit_risk: {} },
        executive_insights: [{ level: "info", message: "Veri yok." }],
      }),
      roadmapPageHtml(roadmapService.FALLBACK_ROADMAP),
    ];

    emptyPayloads.forEach((html) => {
      assert(typeof html === "string" && html.length > 20, "html length");
      assert(!html.includes("undefined"), "undefined leak");
      assert(!html.includes("null"), "null leak");
    });

    assert(vehicleIntelligenceSummaryHtml(null).includes("Araç Zekâsı Özeti"), "vi summary empty");
    assert(vehicleHealthSummaryHtml(null).includes("Araç Sağlık Skoru"), "vh summary empty");
    assert(vehicleTimelinePreviewHtml(null).includes("Operasyon Geçmişi"), "vt preview empty");
    assert(vehicleProfitRiskSummaryHtml(null).includes("Kâr / Risk Özeti"), "vpr summary empty");
    assert(executiveVehicleDashboardCrossLinkHtml().includes("/executive-vehicle-dashboard"), "cross link");
  });

  test("roadmap page/API still work", () => {
    const roadmap = roadmapService.getV11Roadmap();
    assert(roadmap.version === "1.1.0", roadmap.version);
    assert(Array.isArray(roadmap.phases), "phases");
    const html = roadmapPageHtml(roadmap);
    assert(html.includes("v1.1"), "roadmap page");
    JSON.parse(JSON.stringify(roadmap));
  });

  test("layout version updated", () => {
    assert(LAYOUT_VERSION === "fleetos-stb2-v11-stabilization-01", LAYOUT_VERSION);
  });

  test("Turkish terminology on v1.1 hub pages", () => {
    const intelligence = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: REF });
    const health = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: REF });
    const timeline = vehicleTimelineService.buildFleetTimelineSummary({ referenceDate: REF });
    const profitRisk = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: REF });
    const executive = executiveVehicleDashboardService.buildExecutiveVehicleDashboard({ referenceDate: REF });

    const pages = [
      vehicleIntelligencePageHtml(intelligence),
      vehicleHealthPageHtml(health),
      vehicleTimelinePageHtml({ fleet: timeline, timeline: null, vehicles: [], filters: { limit: 100 } }),
      vehicleProfitRiskPageHtml(profitRisk),
      executiveVehicleDashboardPageHtml(executive),
    ];

    const banned = [
      "Vehicle Intelligence",
      "Vehicle Health",
      "Vehicle Timeline",
      "Profit / Risk Fusion",
      "Executive Vehicle Intelligence",
    ];
    pages.forEach((html, idx) => {
      banned.forEach((term) => assert(!html.includes(term), `page ${idx} contains English term: ${term}`));
    });
  });

  test("vehicle detail page renders v1.1 blocks", () => {
    const vehicleId = seedVehicle("34 STB 02");
    const bundle = getVehicleCenterBundle(vehicleId);
    const html = vehicleCenterPageHtml(bundle);
    assert(html.includes("Araç Zekâsı Özeti"), "intelligence block");
    assert(html.includes("Araç Sağlık Skoru"), "health block");
    assert(html.includes("Operasyon Geçmişi"), "timeline block");
    assert(html.includes("Kâr / Risk Özeti"), "profit risk block");
    assert(html.includes("Yönetici Araç Zekâsı ekranında gör"), "executive link");
    assert(!html.includes("undefined"), "undefined leak");
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
