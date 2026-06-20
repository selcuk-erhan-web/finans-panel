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
assert(!fleetGroup.items.some(([href]) => href === "/maintenance"), "bakim removed from filo");
assert(fleetGroup.items.some(([href, label]) => href === "/documents" && label === "Uygunluk Merkezi"), "compliance nav label");

const financeGroup = NAV_TREE.find((n) => n.id === "finance");
assert(financeGroup, "finance group exists");
assert(financeGroup.items.some(([href]) => href === "/cashflow"), "cashflow under finance");

const opsGroup = NAV_TREE.find((n) => n.id === "operations");
assert(!opsGroup.items.some(([href]) => href === "/cashflow"), "cashflow removed from operasyon");

const homeHtml = renderNav("/");
assert(homeHtml.includes('href="/"') && homeHtml.includes("is-active"), "home active");
assert(homeHtml.includes('data-nav-group="finance"'), "finance group in nav");
const fleetSub = homeHtml.match(/id="nav-sub-fleet"[^>]*>([\s\S]*?)<\/div>/);
assert(fleetSub && !fleetSub[1].includes("Bakım"), "no bakim under fleet subnav");

const incomeHubHtml = renderNav("/income");
assert(getOpenGroupId("/income") === "income", "income group open on hub");
assert(isNavActive("/income", "/income"), "income hub active");

const cashflowHtml = renderNav("/cashflow");
assert(getOpenGroupId("/cashflow") === "finance", "cashflow opens finance group");
assert(cashflowHtml.includes('data-nav-group="finance"') && cashflowHtml.includes("is-open"), "finance expanded");

const maintHtml = renderNav("/maintenance");
assert(getOpenGroupId("/maintenance") === "expense", "maintenance only under expense");
assert(maintHtml.includes('data-nav-group="expense"') && maintHtml.includes("is-open"), "expense expanded on maintenance");

console.log("✓ FleetOS stabilization sidebar nav tests passed");
