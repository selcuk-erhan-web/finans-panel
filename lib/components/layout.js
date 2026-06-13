const { escapeHtml } = require("./escape");
const { ICONS } = require("../icons");
const LAYOUT_VERSION = require("../layout-version");

const NAV = [
  ["/", "home", "Ana Ekran"],
  ["/vehicles", "car", "Araçlar"],
  ["/maintenance", "wrench", "Bakım"],
  ["/fuel", "fuel", "Yakıt"],
  ["/hgs", "hgs", "HGS Yönetimi"],
  ["/income", "income", "Gelirler"],
  ["/expense", "expense", "Giderler"],
  ["/reports", "chart", "Analizler"],
  ["/settings", "gear", "Ayarlar"],
];

function active(href, current) {
  return href === current ? "is-active" : "";
}

function formatDate() {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shell({ title, subtitle, content, path, flash }) {
  const nav = NAV.map(([href, key, label, badge]) => {
    const soon = badge === "soon";
    const badgeHtml = soon ? `<span class="nav-link__badge">Hazırlık</span>` : "";
    return `<a href="${href}" class="nav-link ${active(href, path)}${soon ? " nav-link--soon" : ""}">
        <span class="nav-link__icon">${ICONS[key] || ""}</span>
        <span class="nav-link__label">${label}${badgeHtml}</span>
      </a>`;
  }).join("");

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
      <nav class="sidebar__nav" aria-label="Ana menü">${nav}</nav>
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
          <a href="/expense" class="btn btn--ghost">+ Gider</a>
        </div>
      </header>
      <main class="workspace__body">${content}</main>
    </div>
  </div>
  <script src="/js/main.js?v=${LAYOUT_VERSION}"></script>
</body>
</html>`;
}

function renderPage(res, { title, subtitle, content, path, req }) {
  const { getFlashFromQuery } = require("../flash");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.send(
    shell({
      title,
      subtitle: subtitle || "Akıllı Filo Operasyon Platformu",
      content,
      path,
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
    req,
  });
}

module.exports = { shell, renderPage, renderLayout, NAV };
