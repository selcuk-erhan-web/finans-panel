const { escapeHtml } = require("./escape");

const MODULE_TABS = {
  vehicleIntelligence: [
    { href: "/vehicle-intelligence", label: "Özet" },
    { href: "/vehicle-health", label: "Sağlık Skoru" },
    { href: "/vehicle-timeline", label: "Operasyon Geçmişi" },
    { href: "/vehicle-profit-risk", label: "Kâr / Risk" },
    { href: "/executive-vehicle-dashboard", label: "Yönetici Panel" },
  ],
  compliance: [
    { href: "/documents", label: "Merkez" },
    { href: "/notifications", label: "Bildirimler" },
    { href: "/compliance-analytics", label: "Analitik" },
  ],
  maintenance: [
    { href: "/maintenance", label: "Merkez" },
    { href: "/maintenance-schedule", label: "Plan" },
    { href: "/maintenance-alerts", label: "Uyarılar" },
    { href: "/maintenance-analytics", label: "Analitik" },
  ],
  tire: [
    { href: "/tires", label: "Merkez" },
    { href: "/tire-history", label: "Değişim Geçmişi" },
    { href: "/tire-seasonal-schedule", label: "Sezon Planı" },
    { href: "/tire-alerts", label: "Uyarılar" },
    { href: "/tire-analytics", label: "Analitik" },
  ],
};

function normalizePath(path) {
  const p = String(path || "").split("?")[0];
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function isModuleTabActive(href, path) {
  const p = normalizePath(path);
  const h = normalizePath(href);
  if (p === h) return true;
  if (h !== "/" && p.startsWith(`${h}/`)) return true;
  return false;
}

function renderModuleTabs(moduleKey, path) {
  const tabs = MODULE_TABS[moduleKey];
  if (!tabs || !tabs.length) return "";

  const links = tabs
    .map(({ href, label }) => {
      const active = isModuleTabActive(href, path);
      return `<a href="${escapeHtml(href)}" class="module-tab${active ? " module-tab--active" : ""}"${
        active ? ' aria-current="page"' : ""
      }>${escapeHtml(label)}</a>`;
    })
    .join("");

  return `<nav class="module-tabs" aria-label="Modül sekmeleri">${links}</nav>`;
}

module.exports = {
  MODULE_TABS,
  renderModuleTabs,
  isModuleTabActive,
};
