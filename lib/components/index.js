const { escapeHtml } = require("./escape");
const { resolveQueryDates } = require("../dates");
const { renderPage, renderLayout, shell } = require("./layout");
const { metricCard, metricGrid } = require("./kpi");
const { vehicleCard, vehicleGrid, fleetCardGrid, fleetCardLarge, typeBadge, statusPill } = require("./fleet");
const {
  modernTable,
  expenseRow,
  transactionRow,
  glassPanel,
  insightPanel,
  emptyState,
} = require("./table");

function chartBoot(scripts) {
  const code = scripts.filter(Boolean).join("\n");
  return code ? `<script>${code}</script>` : "";
}

function vehicleOptions(vehicles, selectedId = "", opts = {}) {
  const { allowShared = false } = opts;
  let html = "";
  if (allowShared) {
    const sharedSelected = selectedId === "" || selectedId == null ? "selected" : "";
    html += `<option value="" ${sharedSelected}>Ortak Gider (Araçsız)</option>`;
  }
  if (!vehicles.length) {
    return html || `<option value="">Önce araç ekleyin</option>`;
  }
  html += vehicles
    .map(
      (v) =>
        `<option value="${v.id}" ${String(v.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(v.plate)} — ${escapeHtml(v.type || "")}</option>`
    )
    .join("");
  return html;
}

function categoryOptions(categories, selected = "") {
  return categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`
    )
    .join("");
}

function buildQueryString(base, query, overrides = {}) {
  const q = { ...query, ...overrides };
  const parts = [];
  Object.keys(q).forEach((k) => {
    if (q[k]) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`);
  });
  return base + (parts.length ? `?${parts.join("&")}` : "");
}

function periodTabs(basePath, query) {
  const periods = [
    ["", "Tümü"],
    ["this_month", "Bu ay"],
    ["last_month", "Geçen ay"],
    ["last_30", "Son 30 gün"],
  ];
  return `<div class="tabs">${periods
    .map(([key, label]) => {
      const active = (query.period || "") === key ? "is-active" : "";
      const href = key
        ? buildQueryString(basePath, { ...query, period: key }, { date_from: "", date_to: "" })
        : basePath;
      return `<a class="tabs__item ${active}" href="${href}">${label}</a>`;
    })
    .join("")}</div>`;
}

function filterBar(action, query, { vehicles, categories, exportPath = null }) {
  const resolved = resolveQueryDates(query);
  const vehicleOpts = [
    `<option value="">Tüm araçlar</option>`,
    ...vehicles.map(
      (v) =>
        `<option value="${v.id}" ${String(resolved.vehicle_id) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
    ),
  ].join("");
  const catOpts = [
    `<option value="">Tüm kategoriler</option>`,
    ...categories.map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${resolved.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`
    ),
  ].join("");
  const periodField = resolved.period
    ? `<input type="hidden" name="period" value="${escapeHtml(resolved.period)}"/>`
    : "";
  const exportBtn = exportPath
    ? `<a class="btn btn--ghost" href="${buildQueryString(exportPath, query)}">CSV</a>
       <a class="btn btn--ghost" href="${buildQueryString(exportPath, { ...query, format: "xlsx" })}">Excel</a>`
    : "";

  return `${periodTabs(action, query)}
    <form class="filters" method="GET" action="${action}">
      ${periodField}
      <input name="q" placeholder="Ara…" value="${escapeHtml(resolved.q || "")}"/>
      <select name="vehicle_id">${vehicleOpts}</select>
      ${categories.length ? `<select name="category">${catOpts}</select>` : ""}
      <input type="date" name="date_from" value="${escapeHtml(resolved.date_from || "")}"/>
      <input type="date" name="date_to" value="${escapeHtml(resolved.date_to || "")}"/>
      <button type="submit" class="btn btn--primary">Filtrele</button>
      <a href="${action}" class="btn btn--ghost">Temizle</a>
      ${exportBtn}
    </form>`;
}

function errorPage(title, message) {
  return shell({
    title: "Hata",
    subtitle: "Sayfa bulunamadı",
    path: "",
    content: `<div class="empty" style="margin-top:80px">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <a href="/" class="btn btn--primary">Ana sayfa</a>
    </div>`,
  });
}

// Backward-compatible aliases
const layout = shell;
const pageHeader = (t, s) => `<div class="page-lead"><p>${escapeHtml(s || t)}</p></div>`;
const dataTable = modernTable;
const premiumDataTable = modernTable;
const kpiCard = metricCard;
const kpiGrid = metricGrid;
const vehicleCardGrid = vehicleGrid;
const vehicleTypeBadge = typeBadge;
const statusBadge = statusPill;
const chartScripts = chartBoot;
const insightBox = (t) => insightPanel(t);
const fleetCardsDashboard = vehicleGrid;
const {
  statusAnalysisGrid,
  vehicleSummaryRow,
  fleetTypePanel,
} = require("./analytics");
const {
  welcomeBanner,
  premiumInsight,
  expenseTimeline,
  monthlyMiniCards,
  expenseRatioBars,
  categoryCardGrid,
  vehicleRankCards,
  vehicleHeroLarge,
  transactionTimeline,
  taskList,
  rankListMini,
} = require("./saas");
const {
  commandHeader,
  executiveFinancialPanel,
  executiveProfitSummary,
  vehicleProfitRankPanel,
  commandInsightCompact,
  operationsCenter,
  financeTrendsPanel,
  financialMovementsPanel,
  splitInsightText,
} = require("./commandCenter");

module.exports = {
  escapeHtml,
  renderPage,
  renderLayout,
  layout,
  shell,
  metricCard,
  metricGrid,
  kpiCard,
  kpiGrid,
  vehicleCard,
  vehicleGrid,
  vehicleCardGrid,
  fleetCardsDashboard,
  fleetCardGrid,
  fleetCardLarge,
  welcomeBanner,
  premiumInsight,
  expenseTimeline,
  monthlyMiniCards,
  expenseRatioBars,
  categoryCardGrid,
  vehicleRankCards,
  vehicleHeroLarge,
  transactionTimeline,
  taskList,
  rankListMini,
  commandHeader,
  executiveFinancialPanel,
  executiveProfitSummary,
  vehicleProfitRankPanel,
  commandInsightCompact,
  operationsCenter,
  financeTrendsPanel,
  financialMovementsPanel,
  splitInsightText,
  vehicleTypeBadge,
  statusBadge,
  typeBadge,
  statusPill,
  modernTable,
  dataTable,
  premiumDataTable,
  expenseRow,
  transactionRow,
  glassPanel,
  insightPanel,
  insightBox,
  emptyState,
  chartBoot,
  chartScripts,
  vehicleOptions,
  categoryOptions,
  filterBar,
  buildQueryString,
  errorPage,
  pageHeader,
  statusAnalysisGrid,
  vehicleSummaryRow,
  fleetTypePanel,
};
