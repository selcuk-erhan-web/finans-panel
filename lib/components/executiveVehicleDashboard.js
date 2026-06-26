const { escapeHtml } = require("./escape");
const { formatPlateDisplay } = require("../../utils/plate");
const { money } = require("../finance");
const { renderModuleTabs } = require("./moduleTabs");
const {
  categoryBadge,
  priorityBadge,
  riskLevelBadge,
  driverChips,
  scoreDisplay,
} = require("./vehicleProfitRisk");

function insightCard(insight) {
  const level = insight.level || "info";
  return `<article class="evd-insight evd-insight--${escapeHtml(level)}">${escapeHtml(insight.message || "")}</article>`;
}

function distributionChip(label, count, tone = "muted") {
  return `<span class="evd-dist-chip evd-dist-chip--${tone}">${escapeHtml(label)} <strong>${Number(count || 0).toLocaleString("tr-TR")}</strong></span>`;
}

function executiveVehicleDashboardPageHtml(payload, path = "/executive-vehicle-dashboard") {
  const summary = payload.summary || {};
  const topPerformers = payload.top_performers || [];
  const highestRisk = payload.highest_risk || [];
  const actionPriorities = payload.action_priorities || [];
  const distribution = payload.fleet_distribution || { health: {}, profit_risk: {} };
  const insights = payload.executive_insights || [];

  const topRows = topPerformers.length
    ? topPerformers
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td class="${row.net_profit < 0 ? "evd-net--neg" : row.net_profit > 0 ? "evd-net--pos" : ""}">${money(row.net_profit || 0)}</td>
          <td>${scoreDisplay(row.health_score)}</td>
          <td>${categoryBadge(row.category)}</td>
          <td>${priorityBadge(row.priority)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Kârlı araç verisi bulunmuyor.</td></tr>`;

  const riskRows = highestRisk.length
    ? highestRisk
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td class="${row.net_profit < 0 ? "evd-net--neg" : row.net_profit > 0 ? "evd-net--pos" : ""}">${money(row.net_profit || 0)}</td>
          <td>${scoreDisplay(row.health_score)}</td>
          <td>${riskLevelBadge(row.risk_level)}</td>
          <td>${categoryBadge(row.category)}</td>
          <td class="evd-action">${escapeHtml(row.recommended_action || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Acil/yüksek riskli araç bulunmuyor.</td></tr>`;

  const actionList = actionPriorities.length
    ? actionPriorities
        .map(
          (row) => `<article class="evd-action-card evd-action-card--${escapeHtml(row.priority || "unknown")}">
          <header class="evd-action-card__head">
            ${priorityBadge(row.priority)}
            <a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a>
          </header>
          <h3 class="evd-action-card__title">${escapeHtml(row.decision_label || "—")}</h3>
          <p class="evd-action-card__action">${escapeHtml(row.recommended_action || "—")}</p>
          <div class="evd-action-card__drivers">${driverChips(row.drivers, 3)}</div>
        </article>`
        )
        .join("")
    : `<p class="evd-empty">Öncelikli müdahale listesi boş.</p>`;

  const healthDist = distribution.health || {};
  const profitDist = distribution.profit_risk || {};

  return `<div class="dash page-enter dash--dense evd-hub">
    <header class="evd-hub__header fade-in">
      <p class="evd-hub__eyebrow">Filo · Yönetici Araç Zekâsı</p>
      <h2 class="evd-hub__title">Yönetici Araç Zekâsı</h2>
      <p class="evd-hub__desc">Araç zekâsı, sağlık, operasyon geçmişi ve kâr/risk verilerini birleştiren üst düzey filo karar ekranı.</p>
      ${renderModuleTabs("vehicleIntelligence", path)}
    </header>

    <section class="evd-kpi-row fade-in">
      <article class="evd-kpi"><span>Toplam Araç</span><strong>${Number(summary.total_vehicles || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="evd-kpi evd-kpi--health"><span>Ortalama Sağlık</span><strong>${summary.average_health_score != null ? `${summary.average_health_score}/100` : "—"}</strong></article>
      <article class="evd-kpi"><span>Toplam Gelir</span><strong>${money(summary.total_income || 0)}</strong></article>
      <article class="evd-kpi"><span>Toplam Gider</span><strong>${money(summary.total_expense || 0)}</strong></article>
      <article class="evd-kpi evd-kpi--net"><span>Net Kâr</span><strong>${money(summary.net_profit || 0)}</strong></article>
      <article class="evd-kpi evd-kpi--star"><span>Yıldız Araçlar</span><strong>${Number(summary.stars || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="evd-kpi evd-kpi--crit"><span>Acil İnceleme</span><strong>${Number(summary.urgent_count || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="evd-kpi evd-kpi--warn"><span>Yüksek Öncelik</span><strong>${Number(summary.high_priority_count || 0).toLocaleString("tr-TR")}</strong></article>
    </section>

    <div class="evd-grid fade-in">
      <section class="panel">
        <header class="panel__head"><h2 class="panel__title">En İyi Performans</h2></header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table data-table--compact evd-table">
              <thead><tr><th>Araç</th><th>Net Kâr</th><th>Sağlık Skoru</th><th>Kategori</th><th>Öncelik</th></tr></thead>
              <tbody>${topRows}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel__head"><h2 class="panel__title">En Yüksek Risk</h2></header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table data-table--compact evd-table">
              <thead><tr><th>Araç</th><th>Net Kâr</th><th>Sağlık Skoru</th><th>Risk</th><th>Kategori</th><th>Öneri</th></tr></thead>
              <tbody>${riskRows}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Müdahale Öncelikleri</h2></header>
      <div class="panel__body evd-action-grid">${actionList}</div>
    </section>

    <div class="evd-grid fade-in">
      <section class="panel">
        <header class="panel__head"><h2 class="panel__title">Sağlık Dağılımı</h2></header>
        <div class="panel__body evd-dist-row">
          ${distributionChip("Sağlıklı", healthDist.healthy, "ok")}
          ${distributionChip("İzleme", healthDist.watch, "info")}
          ${distributionChip("Risk", healthDist.risk, "warn")}
          ${distributionChip("Kritik", healthDist.critical, "crit")}
          ${distributionChip("Bilinmiyor", healthDist.unknown, "muted")}
        </div>
      </section>

      <section class="panel">
        <header class="panel__head"><h2 class="panel__title">Kâr / Risk Dağılımı</h2></header>
        <div class="panel__body evd-dist-row">
          ${distributionChip("Yıldız", profitDist.star, "ok")}
          ${distributionChip("Kârlı Risk", profitDist.profitable_risk, "warn")}
          ${distributionChip("Zarar / Düşük", profitDist.loss_low_risk, "info")}
          ${distributionChip("Zarar / Yüksek", profitDist.loss_high_risk, "crit")}
          ${distributionChip("Nötr", profitDist.neutral, "muted")}
          ${distributionChip("Bilinmiyor", profitDist.unknown, "muted")}
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Yönetici İçgörüleri</h2></header>
      <div class="panel__body evd-insight-grid">${insights.map(insightCard).join("")}</div>
    </section>
  </div>`;
}

function executiveVehicleDashboardCrossLinkHtml() {
  return `<p class="evd-cross-link"><a href="/executive-vehicle-dashboard">Yönetici Araç Zekâsı ekranında gör →</a></p>`;
}

function executiveVehicleDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--executive-vehicle fade-in" id="executiveVehicleDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Yönetici Araç Zekâsı</h3>
        <p class="cmd-panel__desc" id="executiveVehicleWidgetSubtitle">Filo zekâsı yükleniyor…</p>
      </div>
      <a href="/executive-vehicle-dashboard" class="btn btn--ghost btn--sm">Detay →</a>
    </header>
    <div class="panel__body executive-vehicle-widget">
      <p class="executive-vehicle-widget__loading" id="executiveVehicleWidgetLoading">Filo zekâsı yükleniyor…</p>
      <p class="executive-vehicle-widget__error" id="executiveVehicleWidgetError" hidden>Yönetici araç zekâsı yüklenemedi.</p>
      <div id="executiveVehicleWidgetContent" hidden>
        <div class="executive-vehicle-widget-kpi-row">
          <article class="executive-vehicle-widget-kpi executive-vehicle-widget-kpi--health">
            <span>Ortalama Sağlık</span><strong id="executiveVehicleWidgetHealth">—</strong>
          </article>
          <article class="executive-vehicle-widget-kpi executive-vehicle-widget-kpi--net">
            <span>Net Kâr</span><strong id="executiveVehicleWidgetNet">—</strong>
          </article>
          <article class="executive-vehicle-widget-kpi executive-vehicle-widget-kpi--urgent">
            <span>Acil</span><strong id="executiveVehicleWidgetUrgent">0</strong>
          </article>
          <article class="executive-vehicle-widget-kpi executive-vehicle-widget-kpi--warn">
            <span>Yüksek Öncelik</span><strong id="executiveVehicleWidgetHigh">0</strong>
          </article>
        </div>
        <p class="executive-vehicle-widget__highlight" id="executiveVehicleWidgetRisk">—</p>
      </div>
    </div>
  </section>
  <script src="/js/executive-vehicle-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  executiveVehicleDashboardPageHtml,
  executiveVehicleDashboardCrossLinkHtml,
  executiveVehicleDashboardWidgetHtml,
};
