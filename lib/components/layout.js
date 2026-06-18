const { escapeHtml } = require("./escape");
const { ICONS } = require("../icons");
const LAYOUT_VERSION = require("../layout-version");
const { NAV_TREE, isNavActive, getOpenGroupId, isGroupActive } = require("../navConfig");

const CHEVRON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

/** Flat list — geriye dönük referans */
const NAV = NAV_TREE.flatMap((node) =>
  node.type === "link" ? [[node.href, node.icon, node.label]] : node.items.map(([href, label]) => [href, node.icon, label])
);
const NAV_TOP = NAV.slice(0, 8);
const NAV_BOTTOM = NAV.slice(-4);

function navLinkClass(href, path, extra = "") {
  const parts = ["nav-link", extra, isNavActive(href, path) ? "is-active" : ""].filter(Boolean);
  return parts.join(" ");
}

function renderNavLink(href, iconKey, label, path, extra = "") {
  return `<a href="${href}" class="${navLinkClass(href, path, extra)}">
    <span class="nav-link__icon">${ICONS[iconKey] || ""}</span>
    <span class="nav-link__label">${escapeHtml(label)}</span>
  </a>`;
}

function renderNavGroup(group, path, openGroupId) {
  const isOpen = openGroupId === group.id;
  const groupActive = isGroupActive(group, path);
  const subLinks = group.items
    .map(([href, label]) => {
      const childIcon = href === "/maintenance" ? "wrench" : href === "/hgs" ? "hgs" : href === "/fuel" ? "fuel" : group.icon;
      return renderNavLink(href, childIcon, label, path, "nav-link--sub");
    })
    .join("");

  return `<div class="nav-group ${isOpen ? "is-open" : ""} ${groupActive ? "is-active" : ""}" data-nav-group="${group.id}">
    <button type="button" class="nav-link nav-link--group nav-group__toggle" aria-expanded="${isOpen ? "true" : "false"}" aria-controls="nav-sub-${group.id}">
      <span class="nav-link__icon">${ICONS[group.icon] || ""}</span>
      <span class="nav-link__label">${escapeHtml(group.label)}</span>
      <span class="nav-group__chevron" aria-hidden="true">${CHEVRON}</span>
    </button>
    <div class="nav-group__sub" id="nav-sub-${group.id}">${subLinks}</div>
  </div>`;
}

function renderNav(path) {
  const openGroupId = getOpenGroupId(path);
  return NAV_TREE.map((node) => {
    if (node.type === "link") {
      return renderNavLink(node.href, node.icon, node.label, path);
    }
    return renderNavGroup(node, path, openGroupId);
  }).join("");
}

function formatDate() {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shell({ title, subtitle, content, path, categorySlug, flash }) {
  const nav = renderNav(path);
  const flashScript = "";

  return `<!DOCTYPE html>
<!-- MISTUR premium layout ${LAYOUT_VERSION} -->
<html lang="tr" data-layout="${LAYOUT_VERSION}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)} · MISTUR FleetOS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/css/main.css?v=${LAYOUT_VERSION}"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div id="loader" class="loader"><div class="loader__ring"></div></div>
  <div id="toasts" class="toasts"></div>
  <div id="modalBackdrop" class="modal-backdrop" onclick="if(event.target===this)closeModal()">
    <div class="modal" id="modalBox" role="dialog"></div>
  </div>
  ${flashScript}
  <button type="button" class="nav-toggle" onclick="toggleNav()" aria-label="Menü">☰</button>
  <div class="nav-backdrop" id="navBackdrop" onclick="toggleNav()"></div>

  <div class="app-frame app-container">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand-card">
        <div class="sidebar__logo" aria-hidden="true">M</div>
        <div class="sidebar__brand-text">
          <div class="sidebar__name">MISTUR</div>
          <div class="sidebar__product">FleetOS</div>
          <div class="sidebar__tag">Executive Filo Platformu</div>
        </div>
      </div>
      <nav class="sidebar__nav" aria-label="Ana menü" data-sidebar-nav="fleetos-executive-nav">${nav}</nav>
      <div class="sidebar__footer">
        <div class="sidebar__user">
          <div class="sidebar__avatar">A</div>
          <div class="sidebar__user-meta">
            <div class="sidebar__user-name">Yönetici</div>
            <div class="sidebar__user-role">Admin</div>
          </div>
          <a href="/logout" class="sidebar__logout" title="Çıkış">⎋</a>
        </div>
        <p class="sidebar__legal">MISTUR Finans Yönetimi</p>
      </div>
    </aside>

    <div class="workspace">
      <header class="masthead">
        <div class="masthead__text">
          <h1 class="masthead__title">${escapeHtml(title)}</h1>
          <p class="masthead__sub">${escapeHtml(subtitle)}</p>
        </div>
        <div class="masthead__actions">
          <time class="masthead__date">${escapeHtml(formatDate())}</time>
          <a href="/income" class="btn btn--primary">+ Gelir</a>
          <a href="/expenses" class="btn btn--ghost">+ Gider</a>
        </div>
      </header>
      <main class="workspace__body">${content}</main>
    </div>
  </div>
  <script src="/js/main.js?v=${LAYOUT_VERSION}"></script>
</body>
</html>`;
}

function renderPage(res, { title, subtitle, content, path, categorySlug, req }) {
  const { getFlashFromQuery } = require("../flash");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.send(
    shell({
      title,
      subtitle: subtitle || "Akıllı Filo Operasyon Platformu",
      content,
      path,
      categorySlug: categorySlug ?? req?.query?.category ?? "",
      flash: getFlashFromQuery(req.query),
    })
  );
}

function renderLayout(res, title, content, path, req, opts = {}) {
  renderPage(res, {
    title: opts.pageTitle || title,
    subtitle: opts.breadcrumb || "Akıllı Filo Operasyon Platformu",
    content,
    path,
    categorySlug: opts.categorySlug ?? req?.query?.category ?? "",
    req,
  });
}

module.exports = {
  shell,
  renderPage,
  renderLayout,
  renderNav,
  NAV,
  NAV_TOP,
  NAV_BOTTOM,
  isNavActive,
};
