/** Sidebar Gelirler accordion — route ve aktif durum */

const INCOME_NAV_ITEMS = [
  { key: "service", label: "Servis Gelirleri", href: "/income/service", route: "/income/service" },
  { key: "tourism", label: "Turizm Gelirleri", href: "/income/tourism", route: "/income/tourism" },
  { key: "other", label: "Diğer Gelirler", href: "/income/other", route: "/income/other" },
];

function isIncomeSection(path) {
  const p = String(path || "");
  return p === "/income" || p.startsWith("/income/");
}

function isIncomeNavItemActive(item, path) {
  const p = String(path || "");
  return p === item.route || p.startsWith(item.route + "/");
}

function incomeNavOpen(path) {
  return isIncomeSection(path);
}

function incomePathFromSlug(slug) {
  const s = String(slug || "service").trim();
  if (s === "tourism" || s === "other") return `/income/${s}`;
  return "/income/service";
}

module.exports = {
  INCOME_NAV_ITEMS,
  isIncomeSection,
  isIncomeNavItemActive,
  incomeNavOpen,
  incomePathFromSlug,
};
