/**
 * FLEETOS STB-1 — Stabilization & QA Sprint
 * node scripts/test-stabilization.js
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/lib/db.js",
  "/services/",
  "/routes/",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb1-",
  "test-stabilization.js",
  CACHE_PATTERNS
);

const { NAV_TREE } = require("../lib/navConfig");
const LAYOUT_VERSION = require("../lib/layout-version");
const { auditDashboardWidgetHtml } = require("../lib/components/auditDashboard");
const { complianceDashboardWidgetHtml } = require("../lib/components/complianceDashboard");
const { maintenanceDashboardWidgetHtml } = require("../lib/components/maintenanceDashboard");
const { tireDashboardWidgetHtml } = require("../lib/components/tireDashboard");
const { documentsPageHtml } = require("../lib/components/documents");
const { complianceAnalyticsPageHtml } = require("../lib/components/complianceAnalytics");
const { maintenanceCenterPageHtml } = require("../lib/components/maintenanceCenter");
const { maintenanceSchedulePageHtml } = require("../lib/components/maintenanceSchedule");
const { maintenanceAlertsPageHtml } = require("../lib/components/maintenanceAlerts");
const { maintenanceAnalyticsPageHtml } = require("../lib/components/maintenanceAnalytics");
const { tireCenterPageHtml } = require("../lib/components/tireCenter");
const { tireHistoryPageHtml } = require("../lib/components/tireHistory");
const { tireSeasonalSchedulePageHtml } = require("../lib/components/tireSeasonalSchedule");
const { tireAlertsPageHtml } = require("../lib/components/tireAlerts");
const { tireAnalyticsPageHtml } = require("../lib/components/tireAnalytics");
const { auditLogsPageHtml } = require("../lib/components/auditLogs");
const { auditAnalyticsPageHtml } = require("../lib/components/auditAnalytics");
const auditAnalyticsService = require("../services/auditAnalyticsService");
const auditDashboardService = require("../services/auditDashboardService");
const complianceAnalyticsService = require("../services/complianceAnalyticsService");
const tireSeasonalSchedulerService = require("../services/tireSeasonalSchedulerService");

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
    post(pathValue, ...handlers) {
      routes.push({ method: "POST", path: normalizeRoutePath(pathValue), handlers });
    },
    put(pathValue, ...handlers) {
      routes.push({ method: "PUT", path: normalizeRoutePath(pathValue), handlers });
    },
    delete(pathValue, ...handlers) {
      routes.push({ method: "DELETE", path: normalizeRoutePath(pathValue), handlers });
    },
    use() {},
  };
  return { app, routes };
}

function registerAllRoutes(app) {
  require("../routes/dashboard")(app);
  require("../routes/vehicles").registerVehicles(app);
  require("../routes/maintenanceAnalytics")(app);
  require("../routes/tireAnalytics")(app);
  require("../routes/tireSeasonalSchedule")(app);
  require("../routes/tires")(app);
  require("../routes/tireHistory")(app);
  require("../routes/tireAlerts")(app);
  require("../routes/maintenanceSchedule")(app);
  require("../routes/maintenanceAlerts")(app);
  require("../routes/maintenance")(app);
  require("../routes/documents")(app);
  require("../routes/notifications")(app);
  require("../routes/complianceAnalytics")(app);
  require("../routes/auditLogs")(app);
  require("../routes/auditDashboard")(app);
  require("../routes/auditAnalytics")(app);
}

function routeIndex(routes, method, pathValue) {
  return routes.findIndex((row) => row.method === method && row.path === pathValue);
}

function assertRouteBefore(routes, staticPath, paramPath, label) {
  const staticIdx = routeIndex(routes, "GET", staticPath);
  const paramIdx = routeIndex(routes, "GET", paramPath);
  assert(staticIdx >= 0, `${label}: missing ${staticPath}`);
  assert(paramIdx >= 0, `${label}: missing ${paramPath}`);
  assert(staticIdx < paramIdx, `${label}: ${staticPath} must register before ${paramPath}`);
}

function fleetGroup() {
  return NAV_TREE.find((node) => node.id === "fleet");
}

function systemGroup() {
  return NAV_TREE.find((node) => node.id === "system");
}

function main() {
  console.log("FLEETOS STB-1 Stabilization & QA tests\n");

  const { app, routes } = createRouteCollector();
  registerAllRoutes(app);

  test("route registration audit", () => {
    const getPaths = routes.filter((row) => row.method === "GET").map((row) => row.path);
    const duplicates = getPaths.filter((pathValue, idx) => getPaths.indexOf(pathValue) !== idx);
    assert(duplicates.length === 0, `duplicate GET routes: ${[...new Set(duplicates)].join(", ")}`);

    assertRouteBefore(routes, "/api/tires/analytics", "/api/tires/:id", "tire analytics");
    assertRouteBefore(routes, "/api/tires/seasonal-schedule", "/api/tires/:id", "tire seasonal");
    assertRouteBefore(routes, "/api/maintenance/analytics", "/api/maintenance/:id", "maintenance analytics");
    assertRouteBefore(routes, "/api/maintenance/schedule", "/api/maintenance/:id", "maintenance schedule");
    assertRouteBefore(routes, "/api/audit-logs/entity-history", "/api/audit-logs/:id", "audit entity history");
  });

  test("navigation links audit", () => {
    const fleet = fleetGroup();
    const system = systemGroup();
    assert(fleet, "fleet group");
    assert(system, "system group");

    const fleetLabels = fleet.items.map(([, label]) => label);
    const expectedFleet = [
      "Araç Merkezi",
      "Araç Zekâsı",
      "Araç Sağlık Skoru",
      "Araç Operasyon Geçmişi",
      "Araç Kâr / Risk Analizi",
      "Yönetici Araç Zekâsı",
      "Uygunluk Merkezi",
      "Uygunluk Bildirimleri",
      "Uygunluk Analitiği",
      "Bakım Merkezi",
      "Bakım Planı",
      "Bakım Uyarıları",
      "Bakım Analitiği",
      "Lastik Merkezi",
      "Lastik Değişim Geçmişi",
      "Lastik Sezon Planı",
      "Lastik Uyarıları",
      "Lastik Analitiği",
    ];
    assert(
      JSON.stringify(fleetLabels) === JSON.stringify(expectedFleet),
      `fleet order mismatch: ${fleetLabels.join(" | ")}`
    );

    assert(
      system.items.some(([href, label]) => href === "/audit-logs" && label === "İşlem Geçmişi"),
      "audit logs nav"
    );
    assert(
      system.items.some(([href, label]) => href === "/audit-analytics" && label === "Denetim Analitiği"),
      "audit analytics nav"
    );

    const allHrefs = [];
    for (const node of NAV_TREE) {
      if (node.type === "link") allHrefs.push(node.href);
      if (node.type === "group") node.items.forEach(([href]) => allHrefs.push(href));
    }
    const routeFiles = [
      ["/documents", "routes/documents.js"],
      ["/maintenance", "routes/maintenance.js"],
      ["/tires", "routes/tires.js"],
      ["/audit-logs", "routes/auditLogs.js"],
      ["/audit-analytics", "routes/auditAnalytics.js"],
      ["/compliance-analytics", "routes/complianceAnalytics.js"],
    ];
    for (const [href, file] of routeFiles) {
      const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      assert(source.includes(`"${href}"`), `missing route file for ${href}`);
      assert(allHrefs.includes(href), `missing nav href ${href}`);
    }
  });

  test("dashboard widgets exist", () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, "..", "routes/dashboard.js"), "utf8");
    const widgets = [
      "complianceDashboardWidgetHtml()",
      "maintenanceDashboardWidgetHtml()",
      "tireDashboardWidgetHtml()",
      "auditDashboardWidgetHtml()",
    ];
    for (const token of widgets) {
      assert(dashboardSource.includes(token), `missing ${token}`);
      assert(dashboardSource.indexOf(token) === dashboardSource.indexOf(token), token);
    }
    const complianceIdx = dashboardSource.indexOf(widgets[0]);
    const maintenanceIdx = dashboardSource.indexOf(widgets[1]);
    const tireIdx = dashboardSource.indexOf(widgets[2]);
    const auditIdx = dashboardSource.indexOf(widgets[3]);
    assert(complianceIdx < maintenanceIdx, "widget order compliance");
    assert(maintenanceIdx < tireIdx, "widget order maintenance");
    assert(tireIdx < auditIdx, "widget order tire");

    const complianceHtml = complianceDashboardWidgetHtml();
    const maintenanceHtml = maintenanceDashboardWidgetHtml();
    const tireHtml = tireDashboardWidgetHtml();
    const auditHtml = auditDashboardWidgetHtml();
    assert(complianceHtml.includes("complianceDashboardWidget"), "compliance widget id");
    assert(maintenanceHtml.includes("maintenanceDashboardWidget"), "maintenance widget id");
    assert(tireHtml.includes("tireDashboardWidget"), "tire widget id");
    assert(auditHtml.includes("auditDashboardWidget"), "audit widget id");
    assert(auditHtml.includes("/audit-analytics"), "audit analytics link");
  });

  test("major pages render", () => {
    const emptyVehicles = [];
    const emptyFilters = {};
    const emptyKpi = { expired: 0, within7: 0, within30: 0, within60: 0 };
    const emptyReport = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date(), {});
    const pages = [
      documentsPageHtml({
        kpi: emptyKpi,
        upcoming: [],
        rows: [],
        vehicles: emptyVehicles,
        filters: emptyFilters,
      }),
      complianceAnalyticsPageHtml(complianceAnalyticsService.buildComplianceAnalytics(new Date())),
      maintenanceCenterPageHtml({ summary: {}, rows: [], vehicles: emptyVehicles, filters: emptyFilters }),
      maintenanceSchedulePageHtml({
        summary: {},
        schedules: [],
        vehicles: emptyVehicles,
        filters: emptyFilters,
        selectedVehiclePlate: "",
      }),
      maintenanceAlertsPageHtml({ alerts: [], unreadCount: 0, filter: "all" }),
      maintenanceAnalyticsPageHtml({
        health: {},
        vehicle_cost_ranking: [],
        maintenance_type_distribution: [],
        monthly_cost_trend: [],
        risk_summary: {},
        insights: [{ level: "info", message: "Test" }],
      }),
      tireCenterPageHtml({ summary: {}, rows: [], vehicles: emptyVehicles, filters: emptyFilters }),
      tireHistoryPageHtml({
        summary: {},
        rows: [],
        vehicles: emptyVehicles,
        tires: [],
        filters: emptyFilters,
        selectedVehiclePlate: "",
      }),
      tireSeasonalSchedulePageHtml({
        report: emptyReport,
        vehicles: emptyVehicles,
        filters: emptyFilters,
        selectedVehiclePlate: "",
      }),
      tireAlertsPageHtml({ alerts: [], unreadCount: 0, filter: "all" }),
      tireAnalyticsPageHtml({
        health: {},
        vehicle_tire_ranking: [],
        season_distribution: [],
        status_distribution: [],
        monthly_tire_cost_trend: [],
        seasonal_risk_summary: {},
        insights: [{ level: "info", message: "Test" }],
      }),
      auditLogsPageHtml({ summary: { total: 0, today: 0, by_module: {}, by_action: {} }, records: [], filters: { limit: "50" } }),
      auditAnalyticsPageHtml(auditAnalyticsService.emptyAnalytics(new Date())),
    ];
    for (const html of pages) {
      assert(typeof html === "string" && html.length > 50, "page html");
      assert(!html.includes("undefined"), "undefined leak");
    }
  });

  test("empty states safe", () => {
    const html = maintenanceCenterPageHtml({ summary: {}, rows: [], vehicles: [], filters: {} });
    assert(html.includes("data-table__empty"), "maintenance empty");
    const tireHtml = tireCenterPageHtml({ summary: {}, rows: [], vehicles: [], filters: {} });
    assert(tireHtml.includes("data-table__empty"), "tire empty");
    const auditHtml = auditAnalyticsPageHtml(auditAnalyticsService.emptyAnalytics(new Date()));
    assert(auditHtml.includes("bulunmuyor"), "audit analytics empty copy");
  });

  test("API endpoints respond", () => {
    const auditAnalytics = auditAnalyticsService.buildAuditAnalytics(new Date());
    const auditDashboard = auditDashboardService.buildExecutiveAuditDashboard(new Date());
    const complianceAnalytics = complianceAnalyticsService.buildComplianceAnalytics(new Date());
    JSON.stringify(auditAnalytics);
    JSON.stringify(auditDashboard);
    JSON.stringify(complianceAnalytics);
    assert(auditAnalytics.health, "audit analytics health");
    assert(auditDashboard.summary, "audit dashboard summary");
    assert(complianceAnalytics.health, "compliance analytics health");
  });

  test("layout version present", () => {
    assert(typeof LAYOUT_VERSION === "string" && LAYOUT_VERSION.length > 0, LAYOUT_VERSION);
    assert(LAYOUT_VERSION === "fleetos-rc2-v11-release-01", LAYOUT_VERSION);
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
