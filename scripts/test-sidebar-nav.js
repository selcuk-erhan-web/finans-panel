/**
 * FleetOS stabilization nav smoke test
 * node scripts/test-sidebar-nav.js
 */
const { renderNav, isNavActive } = require("../lib/components/layout");
const { renderModuleTabs, MODULE_TABS } = require("../lib/components/moduleTabs");
const { getOpenGroupId, NAV_TREE } = require("../lib/navConfig");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const systemGroup = NAV_TREE.find((n) => n.id === "system");
assert(systemGroup, "system group exists");
assert(
  systemGroup.items.some(([href, label]) => href === "/audit-logs" && label === "İşlem Geçmişi"),
  "audit logs in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/audit-analytics" && label === "Denetim Analitiği"),
  "audit analytics in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/release" && label === "Release Candidate"),
  "release candidate in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/production" && label === "Production Release"),
  "production release in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/roadmap/v1.1" && label === "v1.1 Roadmap"),
  "v1.1 roadmap in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/release/v1.1" && label === "v1.1 Release Candidate"),
  "v1.1 release candidate in system group"
);
assert(
  systemGroup.items.some(([href, label]) => href === "/production/v1.1" && label === "v1.1 Production Release"),
  "v1.1 production release in system group"
);

const fleetGroup = NAV_TREE.find((n) => n.id === "fleet");
assert(fleetGroup.items.length === 5, `fleet should have 5 items, got ${fleetGroup.items.length}`);
assert(fleetGroup.items[0][0] === "/vehicles" && fleetGroup.items[0][1] === "Araçlar", "fleet starts with Araçlar");
assert(fleetGroup.items[1][0] === "/vehicle-intelligence" && fleetGroup.items[1][1] === "Araç Zekâsı", "vehicle intelligence second");
assert(fleetGroup.items[2][0] === "/documents" && fleetGroup.items[2][1] === "Uygunluk", "compliance third");
assert(fleetGroup.items[3][0] === "/maintenance" && fleetGroup.items[3][1] === "Bakım", "maintenance fourth");
assert(fleetGroup.items[4][0] === "/tires" && fleetGroup.items[4][1] === "Lastik", "tires fifth");
assert(
  !fleetGroup.items.some(([href]) => href === "/vehicle-health"),
  "vehicle health removed from fleet sidebar"
);
assert(
  !fleetGroup.items.some(([href]) => href === "/maintenance-analytics"),
  "maintenance analytics removed from fleet sidebar"
);
assert(
  !fleetGroup.items.some(([href]) => href === "/tire-analytics"),
  "tire analytics removed from fleet sidebar"
);

const expenseGroup = NAV_TREE.find((n) => n.id === "expense");
assert(
  expenseGroup.items.some(([href, label]) => href === "/maintenance" && label === "Bakım Merkezi"),
  "maintenance center also under giderler"
);
assert(
  expenseGroup.items.some(([href, label]) => href === "/tires" && label === "Lastik Merkezi"),
  "tire center also under giderler"
);
assert(
  expenseGroup.items.some(([href, label]) => href === "/tire-history" && label === "Lastik Değişim Geçmişi"),
  "tire history also under giderler"
);
assert(
  expenseGroup.items.some(([href, label]) => href === "/tire-seasonal-schedule" && label === "Lastik Sezon Planı"),
  "tire seasonal schedule also under giderler"
);
assert(
  expenseGroup.items.some(([href, label]) => href === "/tire-alerts" && label === "Lastik Uyarıları"),
  "tire alerts also under giderler"
);
assert(
  expenseGroup.items.some(([href, label]) => href === "/tire-analytics" && label === "Lastik Analitiği"),
  "tire analytics also under giderler"
);

const financeGroup = NAV_TREE.find((n) => n.id === "finance");
assert(financeGroup, "finance group exists");
assert(financeGroup.items.some(([href]) => href === "/cashflow"), "cashflow under finance");

const opsGroup = NAV_TREE.find((n) => n.id === "operations");
assert(!opsGroup.items.some(([href]) => href === "/cashflow"), "cashflow removed from operasyon");

const homeHtml = renderNav("/");
assert(homeHtml.includes('href="/"') && homeHtml.includes("is-active"), "home active");
assert(homeHtml.includes('data-nav-group="finance"'), "finance group in nav");

const viHtml = renderNav("/vehicle-intelligence");
assert(getOpenGroupId("/vehicle-intelligence") === "fleet", "vehicle intelligence opens fleet group");
assert(viHtml.includes("Araç Zekâsı"), "vehicle intelligence label in nav");

const vhHtml = renderNav("/vehicle-health");
assert(getOpenGroupId("/vehicle-health") === "fleet", "vehicle health opens fleet group");
assert(isNavActive("/vehicle-intelligence", "/vehicle-health"), "vehicle health highlights Araç Zekâsı");
assert(vhHtml.includes("Araç Zekâsı") && vhHtml.includes("is-active"), "Araç Zekâsı active on vehicle health");

const vtHtml = renderNav("/vehicle-timeline");
assert(getOpenGroupId("/vehicle-timeline") === "fleet", "vehicle timeline opens fleet group");
assert(isNavActive("/vehicle-intelligence", "/vehicle-timeline"), "vehicle timeline highlights Araç Zekâsı");

const vprHtml = renderNav("/vehicle-profit-risk");
assert(getOpenGroupId("/vehicle-profit-risk") === "fleet", "vehicle profit risk opens fleet group");
assert(isNavActive("/vehicle-intelligence", "/vehicle-profit-risk"), "vehicle profit risk highlights Araç Zekâsı");

const evdHtml = renderNav("/executive-vehicle-dashboard");
assert(getOpenGroupId("/executive-vehicle-dashboard") === "fleet", "executive vehicle dashboard opens fleet group");
assert(isNavActive("/vehicle-intelligence", "/executive-vehicle-dashboard"), "executive dashboard highlights Araç Zekâsı");

const incomeHubHtml = renderNav("/income");
assert(getOpenGroupId("/income") === "income", "income group open on hub");
assert(isNavActive("/income", "/income"), "income hub active");

const cashflowHtml = renderNav("/cashflow");
assert(getOpenGroupId("/cashflow") === "finance", "cashflow opens finance group");
assert(cashflowHtml.includes('data-nav-group="finance"') && cashflowHtml.includes("is-open"), "finance expanded");

const maintHtml = renderNav("/maintenance");
assert(getOpenGroupId("/maintenance") === "fleet", "maintenance opens fleet group first");
assert(maintHtml.includes('data-nav-group="fleet"') && maintHtml.includes("is-open"), "fleet expanded on maintenance");
assert(maintHtml.includes("Bakım") && maintHtml.includes("is-active"), "Bakım active on maintenance");

const scheduleHtml = renderNav("/maintenance-schedule");
assert(getOpenGroupId("/maintenance-schedule") === "fleet", "maintenance schedule opens fleet group");
assert(isNavActive("/maintenance", "/maintenance-schedule"), "maintenance schedule highlights Bakım");

const alertsHtml = renderNav("/maintenance-alerts");
assert(getOpenGroupId("/maintenance-alerts") === "fleet", "maintenance alerts opens fleet group");
assert(isNavActive("/maintenance", "/maintenance-alerts"), "maintenance alerts highlights Bakım");

const analyticsHtml = renderNav("/maintenance-analytics");
assert(getOpenGroupId("/maintenance-analytics") === "fleet", "maintenance analytics opens fleet group");
assert(isNavActive("/maintenance", "/maintenance-analytics"), "maintenance analytics highlights Bakım");

const tiresHtml = renderNav("/tires");
assert(getOpenGroupId("/tires") === "fleet", "tire center opens fleet group");
assert(tiresHtml.includes('data-nav-group="fleet"') && tiresHtml.includes("is-open"), "fleet expanded on tires");
assert(tiresHtml.includes("Lastik") && tiresHtml.includes("is-active"), "Lastik active on tires");

const tireHistoryHtml = renderNav("/tire-history");
assert(getOpenGroupId("/tire-history") === "fleet", "tire history opens fleet group");
assert(isNavActive("/tires", "/tire-history"), "tire history highlights Lastik");

const tireSeasonalHtml = renderNav("/tire-seasonal-schedule");
assert(getOpenGroupId("/tire-seasonal-schedule") === "fleet", "tire seasonal schedule opens fleet group");
assert(isNavActive("/tires", "/tire-seasonal-schedule"), "tire seasonal highlights Lastik");

const tireAlertsHtml = renderNav("/tire-alerts");
assert(getOpenGroupId("/tire-alerts") === "fleet", "tire alerts opens fleet group");
assert(isNavActive("/tires", "/tire-alerts"), "tire alerts highlights Lastik");

const tireAnalyticsHtml = renderNav("/tire-analytics");
assert(getOpenGroupId("/tire-analytics") === "fleet", "tire analytics opens fleet group");
assert(isNavActive("/tires", "/tire-analytics"), "tire analytics highlights Lastik");

const complianceHtml = renderNav("/notifications");
assert(getOpenGroupId("/notifications") === "fleet", "notifications opens fleet group");
assert(isNavActive("/documents", "/notifications"), "notifications highlights Uygunluk");

const complianceAnalyticsHtml = renderNav("/compliance-analytics");
assert(getOpenGroupId("/compliance-analytics") === "fleet", "compliance analytics opens fleet group");
assert(isNavActive("/documents", "/compliance-analytics"), "compliance analytics highlights Uygunluk");

const auditLogsHtml = renderNav("/audit-logs");
assert(getOpenGroupId("/audit-logs") === "system", "audit logs opens system group");
assert(auditLogsHtml.includes("İşlem Geçmişi"), "audit logs label in nav");

const auditAnalyticsHtml = renderNav("/audit-analytics");
assert(getOpenGroupId("/audit-analytics") === "system", "audit analytics opens system group");
assert(auditAnalyticsHtml.includes("Denetim Analitiği"), "audit analytics label in nav");

const releaseHtml = renderNav("/release");
assert(getOpenGroupId("/release") === "system", "release opens system group");
assert(releaseHtml.includes("Release Candidate"), "release candidate label in nav");

const productionHtml = renderNav("/production");
assert(getOpenGroupId("/production") === "system", "production opens system group");
assert(productionHtml.includes("Production Release"), "production release label in nav");

const roadmapHtml = renderNav("/roadmap/v1.1");
assert(getOpenGroupId("/roadmap/v1.1") === "system", "roadmap opens system group");
assert(roadmapHtml.includes("v1.1 Roadmap"), "v1.1 roadmap label in nav");

const v11ReleaseHtml = renderNav("/release/v1.1");
assert(getOpenGroupId("/release/v1.1") === "system", "v1.1 release opens system group");
assert(v11ReleaseHtml.includes("v1.1 Release Candidate"), "v1.1 release label in nav");

const v11ProdHtml = renderNav("/production/v1.1");
assert(getOpenGroupId("/production/v1.1") === "system", "v1.1 production opens system group");
assert(v11ProdHtml.includes("v1.1 Production Release"), "v1.1 production label in nav");

const prodIdx = systemGroup.items.findIndex(([href]) => href === "/production");
const roadmapIdx = systemGroup.items.findIndex(([href]) => href === "/roadmap/v1.1");
const v11ReleaseIdx = systemGroup.items.findIndex(([href]) => href === "/release/v1.1");
const v11ProdIdx = systemGroup.items.findIndex(([href]) => href === "/production/v1.1");
const settingsIdx = systemGroup.items.findIndex(([href]) => href === "/settings");
assert(prodIdx >= 0 && roadmapIdx > prodIdx, "roadmap after production release");
assert(roadmapIdx >= 0 && v11ReleaseIdx > roadmapIdx, "v1.1 release after roadmap");
assert(v11ReleaseIdx >= 0 && v11ProdIdx > v11ReleaseIdx, "v1.1 production after release candidate");
assert(v11ProdIdx >= 0 && settingsIdx > v11ProdIdx, "v1.1 production before settings");

const viTabs = renderModuleTabs("vehicleIntelligence", "/vehicle-health");
assert(viTabs.includes('class="module-tabs"'), "module tabs render");
assert(viTabs.includes("module-tab--active") && viTabs.includes("Sağlık Skoru"), "active vehicle intelligence tab");
assert(MODULE_TABS.compliance.length === 3, "compliance tab count");
assert(MODULE_TABS.maintenance.length === 4, "maintenance tab count");
assert(MODULE_TABS.tire.length === 5, "tire tab count");

console.log("✓ FleetOS stabilization sidebar nav tests passed");
