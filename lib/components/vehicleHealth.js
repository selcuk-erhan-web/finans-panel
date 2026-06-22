const { escapeHtml } = require("./escape");
const { formatPlateDisplay } = require("../../utils/plate");

function healthStatusBadge(status) {
  const map = {
    healthy: ["Sağlıklı", "ok"],
    watch: ["İzleme", "watch"],
    risk: ["Risk", "risk"],
    critical: ["Kritik", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[status] || map.unknown;
  return `<span class="vh-badge vh-badge--${tone}">${escapeHtml(label)}</span>`;
}

function riskBadge(level) {
  const map = {
    low: ["Düşük", "ok"],
    medium: ["Orta", "watch"],
    high: ["Yüksek", "risk"],
    critical: ["Kritik", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[level] || map.unknown;
  return `<span class="vh-badge vh-badge--${tone}">${escapeHtml(label)}</span>`;
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "—";
  return `${Math.round(score)}/100`;
}

function breakdownCell(breakdown) {
  if (!breakdown || breakdown.score == null) return "—";
  return `${breakdown.score}/${breakdown.weight}`;
}

function riskList(risks, max = 3) {
  const items = (risks || []).slice(0, max);
  if (!items.length) return `<span class="vh-risk vh-risk--muted">Risk yok</span>`;
  return items
    .map(
      (risk) =>
        `<span class="vh-risk vh-risk--${escapeHtml(risk.level || "info")}">${escapeHtml(risk.message || "")}</span>`
    )
    .join("");
}

function vehicleHealthPageHtml(payload) {
  const summary = payload.summary || {};
  const vehicles = payload.vehicles || [];
  const highest = summary.highest_risk_vehicle;
  const best = summary.best_health_vehicle;

  const rows = vehicles.length
    ? vehicles
        .map((row) => {
          const b = row.breakdown || {};
          return `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td><strong class="vh-score">${scoreDisplay(row.health_score)}</strong></td>
          <td>${healthStatusBadge(row.health_status)}</td>
          <td>${riskBadge(row.risk_level)}</td>
          <td>${breakdownCell(b.compliance)}</td>
          <td>${breakdownCell(b.maintenance)}</td>
          <td>${breakdownCell(b.tire)}</td>
          <td>${breakdownCell(b.finance)}</td>
          <td>${breakdownCell(b.data_quality)}</td>
          <td class="vh-recommendation">${escapeHtml(row.recommendation || "—")}</td>
        </tr>
        <tr class="vh-risk-row">
          <td colspan="10">${riskList(row.top_risks, 3)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="10" class="data-table__empty">Araç sağlık skoru için veri bulunmuyor.</td></tr>`;

  return `<div class="dash page-enter dash--dense vh-hub">
    <header class="vh-hub__header fade-in">
      <p class="vh-hub__eyebrow">Filo · Araç Sağlık Skoru</p>
      <h2 class="vh-hub__title">Araç Sağlık Skoru</h2>
      <p class="vh-hub__desc">Araç zekâsı verisinden üretilen sağlık skoru, risk bandı ve öneriler.</p>
      <div class="vh-hub__links">
        <a href="/vehicle-intelligence" class="btn btn--ghost btn--sm">Araç Zekâsı →</a>
      </div>
    </header>

    <section class="vh-kpi-row fade-in">
      <article class="vh-kpi vh-kpi--score">
        <span>Ortalama Skor</span>
        <strong>${scoreDisplay(summary.average_health_score)}</strong>
      </article>
      <article class="vh-kpi vh-kpi--ok"><span>Sağlıklı</span><strong>${Number(summary.healthy || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vh-kpi vh-kpi--watch"><span>İzleme</span><strong>${Number(summary.watch || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vh-kpi vh-kpi--risk"><span>Risk</span><strong>${Number(summary.risk || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vh-kpi vh-kpi--crit"><span>Kritik</span><strong>${Number(summary.critical || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vh-kpi"><span>Bilinmiyor</span><strong>${Number(summary.unknown || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vh-kpi vh-kpi--risk">
        <span>En Yüksek Risk</span>
        <strong>${highest ? escapeHtml(formatPlateDisplay(highest.plate) || highest.plate || "—") : "—"}</strong>
        <em>${highest ? scoreDisplay(highest.health_score) : ""}</em>
      </article>
      <article class="vh-kpi vh-kpi--ok">
        <span>En İyi Sağlık</span>
        <strong>${best ? escapeHtml(formatPlateDisplay(best.plate) || best.plate || "—") : "—"}</strong>
        <em>${best ? scoreDisplay(best.health_score) : ""}</em>
      </article>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Araç Sağlık Tablosu</h2>
        <p class="panel__desc">Kritik → risk → izleme → bilinmiyor → sağlıklı sıralaması</p>
      </header>
      <div class="panel__body">
        <div class="table-wrap">
          <table class="data-table data-table--compact vh-table">
            <thead>
              <tr>
                <th>Araç</th>
                <th>Skor</th>
                <th>Durum</th>
                <th>Risk</th>
                <th>Uygunluk</th>
                <th>Bakım</th>
                <th>Lastik</th>
                <th>Finans</th>
                <th>Veri Kalitesi</th>
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

function vehicleHealthSummaryHtml(health) {
  if (!health) {
    return `<section class="panel fade-in vh-summary-panel">
      <header class="panel__head">
        <h2 class="panel__title">Araç Sağlık Skoru</h2>
      </header>
      <div class="panel__body">
        <p class="vh-summary-empty">Araç sağlık skoru üretilemedi.</p>
      </div>
    </section>`;
  }

  return `<section class="panel fade-in vh-summary-panel">
    <header class="panel__head">
      <h2 class="panel__title">Araç Sağlık Skoru</h2>
      <a href="/vehicle-health" class="btn btn--ghost btn--sm">Araç Sağlık Skoru →</a>
    </header>
    <div class="panel__body">
      <div class="vh-summary-hero">
        <div class="vh-summary-hero__score">
          <span>Skor</span>
          <strong>${scoreDisplay(health.health_score)}</strong>
        </div>
        <div class="vh-summary-hero__meta">
          <article><span>Durum</span>${healthStatusBadge(health.health_status)}</article>
          <article><span>Risk</span>${riskBadge(health.risk_level)}</article>
        </div>
      </div>
      <p class="vh-summary-recommendation">${escapeHtml(health.recommendation || "")}</p>
      <div class="vh-summary-risks">${riskList(health.top_risks, 3)}</div>
    </div>
  </section>`;
}

function vehicleHealthDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--vehicle-health fade-in" id="vehicleHealthDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Filo Sağlığı</h3>
        <p class="cmd-panel__desc" id="vehicleHealthWidgetSubtitle">Filo sağlığı yükleniyor…</p>
      </div>
      <a href="/vehicle-health" class="btn btn--ghost btn--sm">Araç Sağlık Skoru →</a>
    </header>
    <div class="panel__body vehicle-health-widget">
      <p class="vehicle-health-widget__loading" id="vehicleHealthWidgetLoading">Filo sağlığı yükleniyor…</p>
      <p class="vehicle-health-widget__error" id="vehicleHealthWidgetError" hidden>Filo sağlığı yüklenemedi.</p>
      <div id="vehicleHealthWidgetContent" hidden>
        <div class="vehicle-health-widget-kpi-row">
          <article class="vehicle-health-widget-kpi vehicle-health-widget-kpi--score">
            <span>Ortalama Skor</span><strong id="vehicleHealthWidgetAvg">—</strong>
          </article>
          <article class="vehicle-health-widget-kpi vehicle-health-widget-kpi--crit">
            <span>Kritik</span><strong id="vehicleHealthWidgetCritical">0</strong>
          </article>
          <article class="vehicle-health-widget-kpi vehicle-health-widget-kpi--risk">
            <span>Risk</span><strong id="vehicleHealthWidgetRisk">0</strong>
          </article>
          <article class="vehicle-health-widget-kpi vehicle-health-widget-kpi--watch">
            <span>İzleme</span><strong id="vehicleHealthWidgetWatch">0</strong>
          </article>
        </div>
        <p class="vehicle-health-widget__highlight" id="vehicleHealthWidgetHighlight">—</p>
      </div>
    </div>
  </section>
  <script src="/js/vehicle-health-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  vehicleHealthPageHtml,
  vehicleHealthSummaryHtml,
  vehicleHealthDashboardWidgetHtml,
  healthStatusBadge,
  riskBadge,
  scoreDisplay,
};
