/** Executive sidebar — collapsible groups, active path detection */

/** Child routes that activate a fleet hub sidebar item */
const FLEET_NAV_CHILD_ROUTES = {
  "/vehicles": ["/vehicles", "/vehicle"],
  "/vehicle-intelligence": [
    "/vehicle-intelligence",
    "/vehicle-health",
    "/vehicle-timeline",
    "/vehicle-profit-risk",
    "/executive-vehicle-dashboard",
  ],
  "/documents": ["/documents", "/notifications", "/compliance-analytics"],
  "/maintenance": ["/maintenance", "/maintenance-schedule", "/maintenance-alerts", "/maintenance-analytics"],
  "/tires": ["/tires", "/tire-history", "/tire-seasonal-schedule", "/tire-alerts", "/tire-analytics"],
};

const NAV_TREE = [
  { type: "link", href: "/", icon: "home", label: "Ana Ekran" },
  {
    type: "group",
    id: "fleet",
    icon: "car",
    label: "Filo",
    items: [
      ["/vehicles", "Araçlar"],
      ["/vehicle-intelligence", "Araç Zekâsı"],
      ["/documents", "Uygunluk"],
      ["/maintenance", "Bakım"],
      ["/tires", "Lastik"],
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
      ["/maintenance-schedule", "Bakım Planı"],
      ["/maintenance-alerts", "Bakım Uyarıları"],
      ["/maintenance-analytics", "Bakım Analitiği"],
      ["/tires", "Lastik Merkezi"],
      ["/tire-history", "Lastik Değişim Geçmişi"],
      ["/tire-seasonal-schedule", "Lastik Sezon Planı"],
      ["/tire-alerts", "Lastik Uyarıları"],
      ["/tire-analytics", "Lastik Analitiği"],
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
      ["/audit-logs", "İşlem Geçmişi"],
      ["/audit-analytics", "Denetim Analitiği"],
      ["/release", "Release Candidate"],
      ["/production", "Production Release"],
      ["/roadmap/v1.1", "v1.1 Roadmap"],
      ["/release/v1.1", "v1.1 Release Candidate"],
      ["/production/v1.1", "v1.1 Production Release"],
      ["/settings", "Ayarlar"],
    ],
  },
];

function normalizeNavPath(path) {
  const p = String(path || "").split("?")[0];
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function matchesNavChildRoutes(href, path) {
  const children = FLEET_NAV_CHILD_ROUTES[href];
  if (!children) return false;

  const p = normalizeNavPath(path);
  return children.some((child) => {
    if (child === "/vehicle") return p === "/vehicle" || p.startsWith("/vehicle/");
    return p === child || p.startsWith(`${child}/`);
  });
}

function isNavActive(href, path) {
  const p = normalizeNavPath(path);
  if (href === "/") return p === "/";
  if (href === "/income") return p === "/income";
  if (href === "/expenses") return p === "/expenses" || p === "/expense" || p.startsWith("/expense/");
  if (matchesNavChildRoutes(href, path)) return true;
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
  FLEET_NAV_CHILD_ROUTES,
  isNavActive,
  getOpenGroupId,
  isGroupActive,
};
