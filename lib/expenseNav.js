/** Sidebar Gider Yönetimi accordion — route ve aktif durum */

const EXPENSE_SECTION_PATHS = ["/expenses", "/expense", "/fuel", "/hgs", "/maintenance"];

const EXPENSE_NAV_ITEMS = [
  { key: "all", label: "Tümü", href: "/expenses", route: "/expenses", slug: null },
  { key: "fuel", label: "Yakıt", href: "/fuel", route: "/fuel", slug: null },
  { key: "hgs", label: "HGS", href: "/hgs", route: "/hgs", slug: null },
  { key: "maint", label: "Bakım", href: "/maintenance", route: "/maintenance", slug: null },
  { key: "personel", label: "Personel", href: "/expenses?category=personel", route: "/expenses", slug: "personel" },
  {
    key: "sigorta",
    label: "Sigorta ve Vergiler",
    href: "/expenses?category=sigorta-ve-vergiler",
    route: "/expenses",
    slug: "sigorta-vergiler",
  },
  { key: "lastik", label: "Lastik", href: "/expenses?category=lastik", route: "/expenses", slug: "lastik" },
  {
    key: "ceza",
    label: "Trafik Cezaları",
    href: "/expenses?category=trafik-cezalari",
    route: "/expenses",
    slug: "trafik-cezalari",
  },
  {
    key: "temizlik",
    label: "Temizlik & Yıkama",
    href: "/expenses?category=temizlik-yikama",
    route: "/expenses",
    slug: "temizlik-yikama",
  },
  {
    key: "teknoloji",
    label: "Teknoloji ve Takip Sistemleri",
    href: "/expenses?category=teknoloji-takip",
    route: "/expenses",
    slug: "teknoloji-takip",
  },
  {
    key: "genel",
    label: "Genel İşletme Giderleri",
    href: "/expenses?category=genel-isletme",
    route: "/expenses",
    slug: "genel-isletme",
  },
  { key: "diger", label: "Diğer", href: "/expenses?category=diger", route: "/expenses", slug: "diger" },
];

function isExpenseSection(path) {
  const p = String(path || "");
  return EXPENSE_SECTION_PATHS.some((base) => p === base || p.startsWith(base + "/"));
}

function isNavItemActive(item, path, categorySlug) {
  const slug = categorySlug ? String(categorySlug).trim() : "";
  if (item.route === "/fuel" || item.route === "/hgs" || item.route === "/maintenance") {
    return path === item.route;
  }
  if (item.key === "all") {
    return (path === "/expenses" || path === "/expense") && !slug;
  }
  if (item.slug) {
    const { normalizeExpenseSlug } = require("./expenseCategoryMap");
    return (path === "/expenses" || path === "/expense") && normalizeExpenseSlug(slug) === item.slug;
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
