const { money, vehicleStatus } = require("./finance");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function activePath(path, current) {
  return path === current ? "active" : "";
}

function layout(title, content, currentPath = "", options = {}) {
  const flash = options.flash;
  const flashHtml = flash
    ? `<div id="toast-wrap" class="toast-wrap"></div>
       <script>document.addEventListener('DOMContentLoaded',function(){
         var w=document.getElementById('toast-wrap');
         if(!w)return;
         var t=document.createElement('div');
         t.className='toast ${flash.type}';
         t.textContent=${JSON.stringify(flash.message)};
         w.appendChild(t);
         setTimeout(function(){t.remove()},4500);
       });</script>`
    : `<div id="toast-wrap" class="toast-wrap"></div>`;

  const menu = [
    ["/", "🏠", "Ana Sayfa"],
    ["/vehicles", "🚗", "Araçlar"],
    ["/income", "💰", "Gelirler"],
    ["/expense", "💸", "Giderler"],
    ["/reports", "📊", "Analizler"],
    ["/settings", "⚙️", "Ayarlar"],
  ]
    .map(
      ([href, icon, label]) =>
        `<a class="${activePath(href, currentPath)}" href="${href}">${icon} ${label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Finans Paneli</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/app.css" />
</head>
<body>
  <div id="loader"><div class="spinner"></div><span class="muted">Yükleniyor…</span></div>
  ${flashHtml}
  <button class="menu-toggle" type="button" aria-label="Menü" onclick="toggleMenu()">☰</button>
  <div class="overlay" id="overlay" onclick="toggleMenu()"></div>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="logo"><span class="logo-icon">🚗</span><span><em>Finans</em> Paneli</span></div>
      <nav class="menu">
        <div class="menu-title">MENÜ</div>
        ${menu}
      </nav>
      <div class="sidebar-foot">Filo finans yönetimi</div>
    </aside>
    <main class="main">${content}</main>
  </div>
  <script src="/js/app.js"></script>
</body>
</html>`;
}

function pageHeader(title, subtitle = "") {
  return `<div class="header"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>`;
}

function kpiCard(label, value, variant = "", sub = "") {
  return `<div class="kpi ${variant}">
    <div class="kpi-label">${escapeHtml(label)}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
  </div>`;
}

function kpiGrid(cards) {
  return `<div class="kpi-grid">${cards.join("")}</div>`;
}

function vehicleTypeBadge(type) {
  const t = escapeHtml(type || "-");
  if (type === "Servis") return `<span class="badge badge-servis">${t}</span>`;
  if (type === "Turizm") return `<span class="badge badge-turizm">${t}</span>`;
  return t;
}

function statusBadge(v) {
  const s = vehicleStatus(v);
  if (s === "profit") return `<span class="badge badge-profit">Kârlı</span>`;
  if (s === "loss") return `<span class="badge badge-loss">Zarar</span>`;
  return `<span class="badge badge-empty">Boş</span>`;
}

function emptyState(icon, title, desc, actionHtml = "") {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${desc}</p>
    ${actionHtml ? `<p style="margin-top:16px">${actionHtml}</p>` : ""}
  </div>`;
}

function dataTable(headers, bodyRows, emptyOpts = null) {
  if (!bodyRows.length) {
    if (typeof emptyOpts === "string") {
      return emptyState("📭", "Kayıt yok", emptyOpts);
    }
    if (emptyOpts && emptyOpts.html) return emptyState(emptyOpts.icon || "📭", emptyOpts.title, emptyOpts.desc, emptyOpts.action);
    return emptyState("📭", "Kayıt yok", "Henüz veri bulunmuyor.");
  }
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${bodyRows.join("")}</tbody></table></div>`;
}

function vehicleSummaryRow(v) {
  const netClass = v.net >= 0 ? "green" : "red";
  return `<tr>
    <td><a class="plate-link" href="/vehicle/${v.id}">${escapeHtml(v.plate)}</a></td>
    <td>${vehicleTypeBadge(v.type)}</td>
    <td class="green">${money(v.income)}</td>
    <td class="red">${money(v.expense)}</td>
    <td class="${netClass}">${money(v.net)}</td>
    <td>${statusBadge(v)}</td>
    <td><a class="btn btn-sm btn-detail" href="/vehicle/${v.id}">Detay</a></td>
  </tr>`;
}

function vehicleCard(v) {
  const s = vehicleStatus(v);
  const cardClass = s === "profit" ? "vcard-profit" : s === "loss" ? "vcard-loss" : "vcard-empty";
  const netClass = v.net >= 0 ? "green" : "red";
  return `<article class="vehicle-card ${cardClass}">
    <div class="vc-plate">${escapeHtml(v.plate)}</div>
    ${vehicleTypeBadge(v.type)}
    <div class="vc-stats">
      <div class="vc-stat"><span>Gelir</span><strong class="green">${money(v.income)}</strong></div>
      <div class="vc-stat"><span>Gider</span><strong class="red">${money(v.expense)}</strong></div>
    </div>
    <div class="vc-net ${netClass}">${money(v.net)}</div>
    <div style="margin-bottom:14px">${statusBadge(v)}</div>
    <a class="btn btn-detail btn-sm" href="/vehicle/${v.id}" style="width:100%">Detaya Git →</a>
  </article>`;
}

function vehicleCardGrid(summaries) {
  if (!summaries.length) {
    return emptyState("🚗", "Araç yok", "Filonuza ilk aracı ekleyerek başlayın.", '<a class="btn" href="/vehicles">Araç Ekle</a>');
  }
  return `<div class="vehicle-grid">${summaries.map(vehicleCard).join("")}</div>`;
}

function transactionRow(t, editPath, deleteHref) {
  const amountClass = t.type === "income" ? "green" : "red";
  return `<tr>
    <td>${escapeHtml(t.plate || "-")}</td>
    <td>${escapeHtml(t.category || "-")}</td>
    <td class="${amountClass}">${money(t.amount)}</td>
    <td>${escapeHtml(t.note || "-")}</td>
    <td>${escapeHtml(String(t.date || "").slice(0, 16))}</td>
    <td class="actions">
      <a class="btn btn-sm btn-secondary" href="${editPath}">Düzenle</a>
      <a class="btn btn-sm btn-danger" href="${deleteHref}" onclick="return confirm('Kayıt silinsin mi?')">Sil</a>
    </td>
  </tr>`;
}

function buildQueryString(base, query, overrides = {}) {
  const q = { ...query, ...overrides };
  const parts = [];
  Object.keys(q).forEach((k) => {
    if (q[k]) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`);
  });
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return base + qs;
}

function periodTabs(basePath, query) {
  const periods = [
    ["", "Tümü"],
    ["this_month", "Bu ay"],
    ["last_month", "Geçen ay"],
    ["last_30", "Son 30 gün"],
  ];
  const tabs = periods
    .map(([key, label]) => {
      const active = (query.period || "") === key ? "active" : "";
      const href = key
        ? buildQueryString(basePath, { ...query, period: key }, { date_from: "", date_to: "" })
        : basePath;
      return `<a class="${active}" href="${href}">${label}</a>`;
    })
    .join("");
  return `<div class="period-tabs">${tabs}</div>`;
}

function filterBar(action, query, { vehicles, categories, exportPath = null }) {
  const vehicleOpts = [
    `<option value="">Tüm araçlar</option>`,
    ...vehicles.map(
      (v) =>
        `<option value="${v.id}" ${String(query.vehicle_id) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
    ),
  ].join("");

  const catOpts = [
    `<option value="">Tüm kategoriler</option>`,
    ...categories.map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${query.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`
    ),
  ].join("");

  const periodField = query.period
    ? `<input type="hidden" name="period" value="${escapeHtml(query.period)}" />`
    : "";

  const exportBtn = exportPath
    ? `<a class="btn btn-export" href="${buildQueryString(exportPath, query)}">📥 Excel (CSV)</a>`
    : "";

  return `
    ${periodTabs(action, query)}
    <form class="filter-bar" method="GET" action="${action}">
      ${periodField}
      <input name="q" placeholder="Ara…" value="${escapeHtml(query.q || "")}" />
      <select name="vehicle_id">${vehicleOpts}</select>
      <select name="category">${catOpts}</select>
      <input type="date" name="date_from" value="${escapeHtml(query.date_from || "")}" />
      <input type="date" name="date_to" value="${escapeHtml(query.date_to || "")}" />
      <button type="submit" class="btn">Filtrele</button>
      <a class="btn btn-outline" href="${action}">Temizle</a>
      ${exportBtn}
    </form>`;
}

function chartScripts(scripts) {
  const body = scripts.filter(Boolean).join("\n");
  return body ? `<script>${body}</script>` : "";
}

function insightBox(text) {
  return `<div class="insight-box"><h3>💡 Finans Yorumu</h3><p>${escapeHtml(text)}</p></div>`;
}

function statusAnalysisGrid(counts) {
  return `<div class="status-grid">
    <div class="status-card profit"><div class="num green">${counts.profit}</div><div class="lbl">Kârlı Araç</div></div>
    <div class="status-card loss"><div class="num red">${counts.loss}</div><div class="lbl">Zararlı Araç</div></div>
    <div class="status-card neutral"><div class="num">${counts.empty}</div><div class="lbl">Boş / Verisiz</div></div>
  </div>`;
}

function errorPage(title, message) {
  return layout(
    title,
    `<div class="error-page card">
      <h1>404</h1>
      <h2 style="margin-bottom:8px">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <a class="btn" href="/">Ana Sayfaya Dön</a>
    </div>`,
    ""
  );
}

function vehicleOptions(vehicles, selectedId = "") {
  if (!vehicles.length) return `<option value="">Önce araç ekleyin</option>`;
  return vehicles
    .map(
      (v) =>
        `<option value="${v.id}" ${String(v.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(v.plate)} — ${escapeHtml(v.type || "")}</option>`
    )
    .join("");
}

function categoryOptions(categories, selected = "") {
  return categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`
    )
    .join("");
}

function renderLayout(res, title, content, path, req) {
  const { getFlashFromQuery } = require("./flash");
  const flash = getFlashFromQuery(req.query);
  res.send(layout(title, content, path, { flash }));
}

module.exports = {
  escapeHtml,
  layout,
  renderLayout,
  pageHeader,
  kpiCard,
  kpiGrid,
  vehicleTypeBadge,
  statusBadge,
  emptyState,
  dataTable,
  vehicleSummaryRow,
  vehicleCard,
  vehicleCardGrid,
  transactionRow,
  filterBar,
  chartScripts,
  insightBox,
  statusAnalysisGrid,
  errorPage,
  vehicleOptions,
  categoryOptions,
  buildQueryString,
};
