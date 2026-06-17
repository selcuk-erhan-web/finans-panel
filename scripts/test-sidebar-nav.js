/**
 * FLEETOS-INCOME-04 — sidebar accordion nav smoke test
 * node scripts/test-sidebar-nav.js
 */
const { renderNav } = require("../lib/components/layout");
const { incomeNavOpen, isIncomeNavItemActive, INCOME_NAV_ITEMS } = require("../lib/incomeNav");
const { expenseNavOpen, isNavItemActive, EXPENSE_NAV_ITEMS } = require("../lib/expenseNav");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const incomeHtml = renderNav("/income/service");
assert(incomeHtml.includes('data-nav-group="income"'), "income group");
assert(incomeHtml.includes("nav-group--income is-open"), "income open on service");
assert(incomeHtml.includes('href="/income/service"') && incomeHtml.includes("is-active"), "service active");
assert(incomeHtml.includes("Servis Gelirleri"), "service label");
assert(incomeHtml.includes("Turizm Gelirleri"), "tourism label");
assert(incomeHtml.includes("Diğer Gelirler"), "other label");

const fuelHtml = renderNav("/fuel");
assert(fuelHtml.includes('nav-group--expense is-open'), "expense open on fuel");
assert(fuelHtml.includes('href="/fuel"') && fuelHtml.includes("nav-link--expense is-active"), "fuel active");
assert(fuelHtml.includes("HGS / OGS"), "hgs label");
assert(fuelHtml.includes("Bakım"), "maint label");
assert(!fuelHtml.includes("Personel"), "no legacy category nav");

assert(incomeNavOpen("/income/tourism"), "tourism section");
assert(expenseNavOpen("/expenses"), "expenses section open parent");
assert(expenseNavOpen("/hgs"), "hgs section");
assert(isIncomeNavItemActive(INCOME_NAV_ITEMS[0], "/income/service"), "service path active");
assert(!isIncomeNavItemActive(INCOME_NAV_ITEMS[1], "/income/service"), "tourism not active on service");
assert(isNavItemActive(EXPENSE_NAV_ITEMS[0], "/fuel/edit/3"), "fuel edit active");

console.log("✓ FLEETOS-INCOME-04 sidebar nav tests passed");
