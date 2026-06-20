/** Executive sidebar — collapsible groups, active path detection */

const NAV_TREE = [
  { type: "link", href: "/", icon: "home", label: "Ana Ekran" },
  {
    type: "group",
    id: "fleet",
    icon: "car",
    label: "Filo",
    items: [
      ["/vehicles", "Araçlar"],
      ["/maintenance", "Bakım Merkezi"],
      ["/documents", "Uygunluk Merkezi"],
      ["/notifications", "Uygunluk Bildirimleri"],
      ["/compliance-analytics", "Uygunluk Analitiği"],
    ],
  },
  {
    type: "group",
    id: "income",
    icon: "income",
    label: "Gelirler",
    items: [
      ["/income", "Gelir Yönetimi"],
      ["/income/service", "Servis Gelirleri"],
      ["/income/tourism", "Turizm Gelirleri"],
      ["/income/other", "Diğer Gelirler"],
      ["/reconciliation", "Hakediş Kontrol"],
    ],
  },
  {
    type: "group",
    id: "expense",
    icon: "expense",
    label: "Giderler",
    defaultCollapsed: true,
    items: [
      ["/expenses", "Gider Yönetimi"],
      ["/hgs", "HGS / OGS"],
      ["/fuel", "Yakıt"],
      ["/maintenance", "Bakım Merkezi"],
    ],
  },
  {
    type: "group",
    id: "finance",
    icon: "wallet",
    label: "Finans",
    items: [["/cashflow", "Nakit Akışı"]],
  },
  {
    type: "group",
    id: "personnel",
    icon: "employee",
    label: "Personel",
    items: [
      ["/employees", "Personel"],
      ["/payroll", "SGK / Muhtasar"],
    ],
  },
  {
    type: "group",
    id: "operations",
    icon: "subcontractor",
    label: "Operasyon",
    items: [
      ["/subcontractors", "Taşeronlar"],
      ["/alerts", "Uyarılar"],
    ],
  },
  {
    type: "group",
    id: "system",
    icon: "gear",
    label: "Sistem",
    items: [
      ["/reports", "Analizler"],
      ["/settings", "Ayarlar"],
    ],
  },
];

function isNavActive(href, path) {
  const p = String(path || "");
  if (href === "/") return p === "/";
  if (href === "/income") return p === "/income";
  if (href === "/expenses") return p === "/expenses" || p === "/expense" || p.startsWith("/expense/");
  return p === href || p.startsWith(`${href}/`);
}

function getOpenGroupId(path) {
  for (const node of NAV_TREE) {
    if (node.type !== "group") continue;
    if (node.items.some(([href]) => isNavActive(href, path))) return node.id;
  }
  return null;
}

function isGroupActive(group, path) {
  return group.items.some(([href]) => isNavActive(href, path));
}

module.exports = {
  NAV_TREE,
  isNavActive,
  getOpenGroupId,
  isGroupActive,
};
