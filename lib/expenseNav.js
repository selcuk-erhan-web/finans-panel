/** Sidebar Gider Yönetimi accordion — route ve aktif durum */

const EXPENSE_SECTION_PATHS = ["/expenses", "/expense", "/fuel", "/hgs", "/maintenance"];

/** FLEETOS-INCOME-04 — operasyonel gider alt menüsü */
const EXPENSE_NAV_ITEMS = [
  { key: "fuel", label: "Yakıt", href: "/fuel", route: "/fuel" },
  { key: "hgs", label: "HGS / OGS", href: "/hgs", route: "/hgs" },
  { key: "maint", label: "Bakım", href: "/maintenance", route: "/maintenance" },
];

function isExpenseSection(path) {
  const p = String(path || "");
  return EXPENSE_SECTION_PATHS.some((base) => p === base || p.startsWith(base + "/"));
}

function isNavItemActive(item, path) {
  const p = String(path || "");
  if (item.route === "/fuel" || item.route === "/hgs" || item.route === "/maintenance") {
    return p === item.route || p.startsWith(item.route + "/");
  }
  return false;
}

function expenseNavOpen(path) {
  return isExpenseSection(path);
}

module.exports = {
  EXPENSE_NAV_ITEMS,
  EXPENSE_SECTION_PATHS,
  isExpenseSection,
  isNavItemActive,
  expenseNavOpen,
};
