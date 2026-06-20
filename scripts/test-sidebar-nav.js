/**
 * FleetOS stabilization nav smoke test
 * node scripts/test-sidebar-nav.js
 */
const { renderNav, isNavActive } = require("../lib/components/layout");
const { getOpenGroupId, NAV_TREE } = require("../lib/navConfig");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fleetGroup = NAV_TREE.find((n) => n.id === "fleet");
assert(
  fleetGroup.items.some(([href, label]) => href === "/maintenance" && label === "Bakım Merkezi"),
  "maintenance center in filo group"
);
assert(fleetGroup.items.some(([href, label]) => href === "/maintenance-schedule" && label === "Bakım Planı"), "maintenance schedule in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/maintenance-alerts" && label === "Bakım Uyarıları"), "maintenance alerts in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/maintenance-analytics" && label === "Bakım Analitiği"), "maintenance analytics in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/tires" && label === "Lastik Merkezi"), "tire center in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/tire-history" && label === "Lastik Değişim Geçmişi"), "tire history in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/tire-seasonal-schedule" && label === "Lastik Sezon Planı"), "tire seasonal schedule in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/tire-alerts" && label === "Lastik Uyarıları"), "tire alerts in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/tire-analytics" && label === "Lastik Analitiği"), "tire analytics in filo group");
assert(fleetGroup.items.some(([href, label]) => href === "/documents" && label === "Uygunluk Merkezi"), "compliance nav label");

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

const incomeHubHtml = renderNav("/income");
assert(getOpenGroupId("/income") === "income", "income group open on hub");
assert(isNavActive("/income", "/income"), "income hub active");

const cashflowHtml = renderNav("/cashflow");
assert(getOpenGroupId("/cashflow") === "finance", "cashflow opens finance group");
assert(cashflowHtml.includes('data-nav-group="finance"') && cashflowHtml.includes("is-open"), "finance expanded");

const maintHtml = renderNav("/maintenance");
assert(getOpenGroupId("/maintenance") === "fleet", "maintenance opens fleet group first");
assert(maintHtml.includes('data-nav-group="fleet"') && maintHtml.includes("is-open"), "fleet expanded on maintenance");
assert(maintHtml.includes("Bakım Merkezi"), "maintenance center label in nav");

const scheduleHtml = renderNav("/maintenance-schedule");
assert(getOpenGroupId("/maintenance-schedule") === "fleet", "maintenance schedule opens fleet group");
assert(scheduleHtml.includes("Bakım Planı"), "maintenance schedule label in nav");

const alertsHtml = renderNav("/maintenance-alerts");
assert(getOpenGroupId("/maintenance-alerts") === "fleet", "maintenance alerts opens fleet group");
assert(alertsHtml.includes("Bakım Uyarıları"), "maintenance alerts label in nav");

const analyticsHtml = renderNav("/maintenance-analytics");
assert(getOpenGroupId("/maintenance-analytics") === "fleet", "maintenance analytics opens fleet group");
assert(analyticsHtml.includes("Bakım Analitiği"), "maintenance analytics label in nav");

const tiresHtml = renderNav("/tires");
assert(getOpenGroupId("/tires") === "fleet", "tire center opens fleet group");
assert(tiresHtml.includes('data-nav-group="fleet"') && tiresHtml.includes("is-open"), "fleet expanded on tires");
assert(tiresHtml.includes("Lastik Merkezi"), "tire center label in nav");

const tireHistoryHtml = renderNav("/tire-history");
assert(getOpenGroupId("/tire-history") === "fleet", "tire history opens fleet group");
assert(tireHistoryHtml.includes("Lastik Değişim Geçmişi"), "tire history label in nav");

const tireSeasonalHtml = renderNav("/tire-seasonal-schedule");
assert(getOpenGroupId("/tire-seasonal-schedule") === "fleet", "tire seasonal schedule opens fleet group");
assert(tireSeasonalHtml.includes("Lastik Sezon Planı"), "tire seasonal schedule label in nav");

const tireAlertsHtml = renderNav("/tire-alerts");
assert(getOpenGroupId("/tire-alerts") === "fleet", "tire alerts opens fleet group");
assert(tireAlertsHtml.includes("Lastik Uyarıları"), "tire alerts label in nav");

const tireAnalyticsHtml = renderNav("/tire-analytics");
assert(getOpenGroupId("/tire-analytics") === "fleet", "tire analytics opens fleet group");
assert(tireAnalyticsHtml.includes("Lastik Analitiği"), "tire analytics label in nav");

console.log("✓ FleetOS stabilization sidebar nav tests passed");
