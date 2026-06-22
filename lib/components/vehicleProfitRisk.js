const { escapeHtml } = require("./escape");
const { formatPlateDisplay } = require("../../utils/plate");
const { money } = require("../finance");

function categoryBadge(category) {
  const map = {
    star: ["Yıldız", "star"],
    profitable_risk: ["Kârlı Risk", "warn"],
    loss_low_risk: ["Zarar / Düşük Risk", "info"],
    loss_high_risk: ["Zarar / Yüksek Risk", "crit"],
    neutral: ["Nötr", "muted"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[category] || map.unknown;
  return `<span class="vpr-badge vpr-badge--${tone}">${escapeHtml(label)}</span>`;
}

function riskLevelBadge(level) {
  const map = {
    low: ["Düşük", "ok"],
    medium: ["Orta", "info"],
    high: ["Yüksek", "warn"],
    critical: ["Kritik", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[level] || map.unknown;
  return `<span class="vpr-badge vpr-badge--${tone}">${escapeHtml(label)}</span>`;
}

function priorityBadge(priority) {
  const map = {
    urgent: ["Acil", "crit"],
    high: ["Yüksek", "warn"],
    medium: ["Orta", "info"],
    low: ["Düşük", "ok"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[priority] || map.unknown;
  return `<span class="vpr-badge vpr-badge--${tone}">${escapeHtml(label)}</span>`;
}

function marginDisplay(margin) {
  if (margin == null || !Number.isFinite(margin)) return "—";
  return `${margin.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "—";
  return `${Math.round(score)}/100`;
}

function driverChips(drivers, max = 3) {
  const items = (drivers || []).slice(0, max);
  if (!items.length) return `<span class="vpr-driver vpr-driver--muted">Sürücü yok</span>`;
  return items
    .map(
      (driver) =>
        `<span class="vpr-driver vpr-driver--${escapeHtml(driver.level || "info")}">${escapeHtml(driver.message || "")}</span>`
    )
    .join("");
}

function vehicleProfitRiskPageHtml(payload) {
  const summary = payload.summary || {};
  const vehicles = payload.vehicles || [];

  const rows = vehicles.length
    ? vehicles
        .map((row) => {
          const vid = row.vehicle_id;
          const timelineLink = `/vehicle-timeline?vehicle_id=${encodeURIComponent(vid)}`;
          return `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(vid)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td class="${row.profitability?.net_profit < 0 ? "vpr-net--neg" : row.profitability?.net_profit > 0 ? "vpr-net--pos" : ""}">${money(row.profitability?.net_profit || 0)}</td>
          <td>${marginDisplay(row.profitability?.profit_margin)}</td>
          <td>${scoreDisplay(row.risk?.health_score)}</td>
          <td>${riskLevelBadge(row.risk?.risk_level || "unknown")}</td>
          <td>${categoryBadge(row.fusion?.category)}</td>
          <td>${priorityBadge(row.fusion?.priority)}</td>
          <td class="vpr-comment">${escapeHtml(row.fusion?.executive_summary || "—")}</td>
          <td class="vpr-action">${escapeHtml(row.fusion?.recommended_action || "—")}</td>
        </tr>
        <tr class="vpr-driver-row">
          <td colspan="9">${driverChips(row.drivers, 3)} <a class="vpr-inline-link" href="${timelineLink}">Geçmiş →</a></td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="data-table__empty">Araç kâr/risk analizi için veri bulunmuyor.</td></tr>`;

  return `<div class="dash page-enter dash--dense vpr-hub">
    <header class="vpr-hub__header fade-in">
      <p class="vpr-hub__eyebrow">Filo · Profit / Risk Fusion</p>
      <h2 class="vpr-hub__title">Araç Kâr / Risk Analizi</h2>
      <p class="vpr-hub__desc">Finansal performans ile operasyonel riski birleştiren yönetici karar katmanı.</p>
      <div class="vpr-hub__links">
        <a href="/vehicle-intelligence" class="btn btn--ghost btn--sm">Araç Zekâsı →</a>
        <a href="/vehicle-health" class="btn btn--ghost btn--sm">Araç Sağlık Skoru →</a>
        <a href="/vehicle-timeline" class="btn btn--ghost btn--sm">Operasyon Geçmişi →</a>
      </div>
    </header>

    <section class="vpr-kpi-row fade-in">
      <article class="vpr-kpi"><span>Toplam Araç</span><strong>${Number(summary.total_vehicles || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi vpr-kpi--star"><span>Yıldız</span><strong>${Number(summary.stars || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi vpr-kpi--warn"><span>Kârlı Risk</span><strong>${Number(summary.profitable_risk || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi"><span>Zarar / Düşük Risk</span><strong>${Number(summary.loss_low_risk || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi vpr-kpi--crit"><span>Zarar / Yüksek Risk</span><strong>${Number(summary.loss_high_risk || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi"><span>Nötr</span><strong>${Number(summary.neutral || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi"><span>Bilinmiyor</span><strong>${Number(summary.unknown || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi"><span>Toplam Gelir</span><strong>${money(summary.total_income || 0)}</strong></article>
      <article class="vpr-kpi"><span>Toplam Gider</span><strong>${money(summary.total_expense || 0)}</strong></article>
      <article class="vpr-kpi vpr-kpi--net"><span>Net Kâr</span><strong>${money(summary.net_profit || 0)}</strong></article>
      <article class="vpr-kpi vpr-kpi--crit"><span>Acil</span><strong>${Number(summary.urgent_count || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vpr-kpi vpr-kpi--warn"><span>Yüksek Öncelik</span><strong>${Number(summary.high_priority_count || 0).toLocaleString("tr-TR")}</strong></article>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Karar Matrisi</h2>
        <p class="panel__desc">Acil öncelikli araçlar üstte; net kâra göre sıralanır.</p>
      </header>
      <div class="panel__body">
        <div class="table-wrap">
          <table class="data-table data-table--compact vpr-table">
            <thead>
              <tr>
                <th>Araç</th>
                <th>Net Kar</th>
                <th>Kar Marjı</th>
                <th>Sağlık Skoru</th>
                <th>Risk</th>
                <th>Kategori</th>
                <th>Öncelik</th>
                <th>Yönetici Yorumu</th>
                <th>Öneri</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>
  </div>`;
}

function vehicleProfitRiskSummaryHtml(report) {
  if (!report) {
    return `<section class="panel fade-in vpr-summary-panel">
      <header class="panel__head">
        <h2 class="panel__title">Kâr / Risk Özeti</h2>
      </header>
      <div class="panel__body">
        <p class="vpr-empty">Kâr/risk özeti üretilemedi.</p>
      </div>
    </section>`;
  }

  return `<section class="panel fade-in vpr-summary-panel">
    <header class="panel__head">
      <h2 class="panel__title">Kâr / Risk Özeti</h2>
      <a href="/vehicle-profit-risk" class="btn btn--ghost btn--sm">Kâr / Risk Analizi →</a>
    </header>
    <div class="panel__body">
      <div class="vpr-summary-grid">
        <article><span>Net Kâr</span><strong class="${report.profitability?.net_profit < 0 ? "vpr-net--neg" : report.profitability?.net_profit > 0 ? "vpr-net--pos" : ""}">${money(report.profitability?.net_profit || 0)}</strong></article>
        <article><span>Kar Marjı</span><strong>${marginDisplay(report.profitability?.profit_margin)}</strong></article>
        <article><span>Sağlık Skoru</span><strong>${scoreDisplay(report.risk?.health_score)}</strong></article>
        <article><span>Kategori</span>${categoryBadge(report.fusion?.category)}</article>
        <article><span>Öncelik</span>${priorityBadge(report.fusion?.priority)}</article>
      </div>
      <p class="vpr-summary-text">${escapeHtml(report.fusion?.executive_summary || "")}</p>
      <p class="vpr-summary-action">${escapeHtml(report.fusion?.recommended_action || "")}</p>
      <div class="vpr-summary-drivers">${driverChips(report.drivers, 3)}</div>
    </div>
  </section>`;
}

function vehicleProfitRiskDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--vehicle-profit-risk fade-in" id="vehicleProfitRiskDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Kâr / Risk Özeti</h3>
        <p class="cmd-panel__desc" id="vehicleProfitRiskWidgetSubtitle">Kâr/risk özeti yükleniyor…</p>
      </div>
      <a href="/vehicle-profit-risk" class="btn btn--ghost btn--sm">Kâr / Risk Analizi →</a>
    </header>
    <div class="panel__body vehicle-profit-risk-widget">
      <p class="vehicle-profit-risk-widget__loading" id="vehicleProfitRiskWidgetLoading">Kâr/risk özeti yükleniyor…</p>
      <p class="vehicle-profit-risk-widget__error" id="vehicleProfitRiskWidgetError" hidden>Kâr/risk özeti yüklenemedi.</p>
      <div id="vehicleProfitRiskWidgetContent" hidden>
        <div class="vehicle-profit-risk-widget-kpi-row">
          <article class="vehicle-profit-risk-widget-kpi vehicle-profit-risk-widget-kpi--net">
            <span>Net Kâr</span><strong id="vehicleProfitRiskWidgetNet">—</strong>
          </article>
          <article class="vehicle-profit-risk-widget-kpi vehicle-profit-risk-widget-kpi--star">
            <span>Yıldız</span><strong id="vehicleProfitRiskWidgetStars">0</strong>
          </article>
          <article class="vehicle-profit-risk-widget-kpi vehicle-profit-risk-widget-kpi--crit">
            <span>Zarar / Yüksek Risk</span><strong id="vehicleProfitRiskWidgetLossHigh">0</strong>
          </article>
          <article class="vehicle-profit-risk-widget-kpi vehicle-profit-risk-widget-kpi--urgent">
            <span>Acil</span><strong id="vehicleProfitRiskWidgetUrgent">0</strong>
          </article>
          <article class="vehicle-profit-risk-widget-kpi vehicle-profit-risk-widget-kpi--warn">
            <span>Yüksek Öncelik</span><strong id="vehicleProfitRiskWidgetHigh">0</strong>
          </article>
        </div>
      </div>
    </div>
  </section>
  <script src="/js/vehicle-profit-risk-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  vehicleProfitRiskPageHtml,
  vehicleProfitRiskSummaryHtml,
  vehicleProfitRiskDashboardWidgetHtml,
  categoryBadge,
  priorityBadge,
  riskLevelBadge,
  driverChips,
  scoreDisplay,
};
