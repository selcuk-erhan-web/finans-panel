const { escapeHtml } = require("./escape");
const { ICONS } = require("../icons");
const LAYOUT_VERSION = require("../layout-version");
const { EXPENSE_NAV_ITEMS, expenseNavOpen, isNavItemActive } = require("../expenseNav");
const { INCOME_NAV_ITEMS, incomeNavOpen, isIncomeNavItemActive } = require("../incomeNav");

const NAV_TOP = [
  ["/", "home", "Ana Ekran"],
  ["/vehicles", "car", "Araçlar"],
];

const NAV_BOTTOM = [
  ["/reports", "chart", "Analizler"],
  ["/settings", "gear", "Ayarlar"],
];

/** Flat list — geriye dönük referans */
const NAV = [
  ...NAV_TOP,
  ["/income/service", "income", "Gelirler"],
  ["/expenses", "expense", "Gider Yönetimi"],
  ...NAV_BOTTOM,
];

const CHEVRON_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

function active(href, current) {
  return href === current ? "is-active" : "";
}

function navLinkClass(href, path, extra = "") {
  const parts = ["nav-link", extra, active(href, path)].filter(Boolean);
  return parts.join(" ");
}

function renderNavLink(href, iconKey, label, path) {
  return `<a href="${href}" class="${navLinkClass(href, path)}">
    <span class="nav-link__icon">${ICONS[iconKey] || ""}</span>
    <span class="nav-link__label">${escapeHtml(label)}</span>
  </a>`;
}

function renderIncomeNavGroup(path) {
  const open = incomeNavOpen(path);
  const groupActive = open ? " is-active" : "";
  const openClass = open ? " is-open" : "";
  const subHidden = open ? "" : " hidden";

  const subLinks = INCOME_NAV_ITEMS.map((item) => {
    const isActive = isIncomeNavItemActive(item, path);
    return `<a href="${item.href}" class="nav-link nav-link--sub nav-link--text nav-link--income${isActive ? " is-active" : ""}">
      <span class="nav-link__label">${escapeHtml(item.label)}</span>
    </a>`;
  }).join("");

  return `<div class="nav-group${openClass}${groupActive}" data-nav-group="income">
    <button type="button" class="nav-link nav-link--group nav-group__toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="incomeNavSub">
      <span class="nav-link__icon">${ICONS.income || ""}</span>
      <span class="nav-link__label">Gelirler</span>
      <span class="nav-group__chevron" aria-hidden="true">${CHEVRON_DOWN}</span>
    </button>
    <div class="nav-group__sub" id="incomeNavSub"${subHidden}>${subLinks}</div>
  </div>`;
}

function renderExpenseNavGroup(path, categorySlug) {
  const open = expenseNavOpen(path);
  const groupActive = open ? " is-active" : "";
  const openClass = open ? " is-open" : "";
  const subHidden = open ? "" : " hidden";

  const subLinks = EXPENSE_NAV_ITEMS.map((item) => {
    const isActive = isNavItemActive(item, path, categorySlug);
    return `<a href="${item.href}" class="nav-link nav-link--sub nav-link--text${isActive ? " is-active" : ""}">
      <span class="nav-link__label">${escapeHtml(item.label)}</span>
    </a>`;
  }).join("");

  return `<div class="nav-group${openClass}${groupActive}" data-nav-group="expense">
    <button type="button" class="nav-link nav-link--group nav-group__toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="expenseNavSub">
      <span class="nav-link__icon">${ICONS.expense || ""}</span>
      <span class="nav-link__label">Gider Yönetimi</span>
      <span class="nav-group__chevron" aria-hidden="true">${CHEVRON_DOWN}</span>
    </button>
    <div class="nav-group__sub" id="expenseNavSub"${subHidden}>${subLinks}</div>
  </div>`;
}

function renderNav(path, categorySlug = "") {
  const top = NAV_TOP.map(([href, key, label]) => renderNavLink(href, key, label, path)).join("");
  const income = renderIncomeNavGroup(path);
  const expense = renderExpenseNavGroup(path, categorySlug);
  const bottom = NAV_BOTTOM.map(([href, key, label]) => renderNavLink(href, key, label, path)).join("");
  return top + income + expense + bottom;
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
  const nav = renderNav(path, categorySlug || "");
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
      <nav class="sidebar__nav" aria-label="Ana menü" data-sidebar-nav="income-expense-navigation-v1">${nav}</nav>
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
          <a href="/income/service" class="btn btn--primary">+ Gelir</a>
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
  NAV,
  NAV_TOP,
  NAV_BOTTOM,
};
