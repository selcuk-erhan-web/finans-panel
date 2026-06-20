const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { money } = require("../finance");

function healthStatusClass(status) {
  if (status === "healthy") return "tyr5-analytics-health--healthy";
  if (status === "watch") return "tyr5-analytics-health--watch";
  if (status === "risk") return "tyr5-analytics-health--risk";
  if (status === "critical") return "tyr5-analytics-health--critical";
  return "tyr5-analytics-health--unknown";
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "Bilinmiyor";
  return `${Math.round(score)}/100`;
}

function seasonalBadge(status, label) {
  const cls = `tyr3-badge tyr3-badge--${escapeHtml(status || "unknown")}`;
  return `<span class="${cls}">${escapeHtml(label || status || "—")}</span>`;
}

function tireAnalyticsPageHtml(analytics) {
  const health = analytics.health || {};
  const risk = analytics.seasonal_risk_summary || {};

  const vehicleRows = (analytics.vehicle_tire_ranking || []).length
    ? analytics.vehicle_tire_ranking
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${Number(row.tire_record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.tire_quantity || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
          <td>${Number(row.on_vehicle_quantity || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.in_storage_quantity || 0).toLocaleString("tr-TR")}</td>
          <td>${seasonalBadge(row.seasonal_status, row.seasonal_status_label)}</td>
          <td>${escapeHtml(row.current_tire_season_label || "—")}</td>
          <td>${formatDateDisplay(row.last_change_date)}</td>
          <td>${Number(row.alert_count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="10" class="data-table__empty">Araç lastik verisi bulunmuyor.</td></tr>`;

  const seasonRows = (analytics.season_distribution || []).length
    ? analytics.season_distribution
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.season_label || row.season || "—")}</td>
          <td>${Number(row.quantity || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">Sezon dağılımı bulunmuyor.</td></tr>`;

  const statusRows = (analytics.status_distribution || []).length
    ? analytics.status_distribution
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.status_label || row.status || "—")}</td>
          <td>${Number(row.quantity || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">Durum dağılımı bulunmuyor.</td></tr>`;

  const trendRows = (analytics.monthly_tire_cost_trend || []).length
    ? analytics.monthly_tire_cost_trend
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.month || "—")}</td>
          <td>${Number(row.record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="data-table__empty">Aylık maliyet trendi bulunmuyor.</td></tr>`;

  const insightItems = (analytics.insights || [])
    .map(
      (item) => `<li class="tyr5-analytics-insight tyr5-analytics-insight--${escapeHtml(item.level || "info")}">
        ${escapeHtml(item.message || "")}
      </li>`
    )
    .join("");

  return `<div class="dash page-enter dash--dense tyr5-analytics-hub">
    <header class="tyr5-analytics-hub__header fade-in">
      <p class="tyr5-analytics-hub__eyebrow">Filo Lastik · Executive Analytics</p>
      <h2 class="tyr5-analytics-hub__title">Lastik Analitiği</h2>
      <p class="tyr5-analytics-hub__desc">Lastik maliyeti, sezon uyumu, depo dağılımı ve filo lastik sağlığı özeti.</p>
    </header>

    <section class="tyr5-analytics-health fade-in ${healthStatusClass(health.tire_health_status)}">
      <article class="tyr5-analytics-health__hero">
        <span>Lastik Sağlık Skoru</span>
        <strong>${escapeHtml(scoreDisplay(health.tire_health_score))}</strong>
        <em>${escapeHtml(health.tire_health_label || "Bilinmiyor")}</em>
      </article>
      <div class="tyr5-analytics-health__grid">
        <article><span>Toplam Kayıt</span><strong>${Number(health.total_tire_records || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Toplam Adet</span><strong>${Number(health.total_quantity || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Toplam Maliyet</span><strong>${money(health.total_cost || 0)}</strong></article>
        <article><span>Lastikli Araç</span><strong>${Number(health.vehicles_with_tires || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Araç Üzerinde</span><strong>${Number(health.on_vehicle_quantity || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Depoda</span><strong>${Number(health.in_storage_quantity || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Hurda</span><strong>${Number(health.disposed_quantity || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Uyumsuz</span><strong>${health.season_mismatch_count || 0}</strong></article>
        <article><span>Dikkat</span><strong>${health.attention_count || 0}</strong></article>
        <article><span>Bilinmiyor</span><strong>${health.unknown_count || 0}</strong></article>
      </div>
    </section>

    <section class="tyr5-analytics-risk-row fade-in">
      <article class="tyr5-analytics-risk tyr5-analytics-risk--ready"><span>Hazır</span><strong>${risk.ready || 0}</strong></article>
      <article class="tyr5-analytics-risk tyr5-analytics-risk--attention"><span>Dikkat</span><strong>${risk.attention || 0}</strong></article>
      <article class="tyr5-analytics-risk tyr5-analytics-risk--mismatch"><span>Uyumsuz</span><strong>${risk.mismatch || 0}</strong></article>
      <article class="tyr5-analytics-risk tyr5-analytics-risk--unknown"><span>Bilinmiyor</span><strong>${risk.unknown || 0}</strong></article>
    </section>

    <div class="grid2 tyr5-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Araç Lastik Sıralaması</h2>
          <p class="panel__desc">Uyumsuz önce · ardından maliyet</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Plaka</th><th>Kayıt</th><th>Adet</th><th>Toplam</th><th>Araç Üzerinde</th><th>Depoda</th><th>Sezon Durumu</th><th>Mevcut Sezon</th><th>Son Değişim</th><th>Uyarı</th>
            </tr></thead>
            <tbody>${vehicleRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Sezon Dağılımı</h2>
          <p class="panel__desc">Yazlık / kışlık / 4 mevsim</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Sezon</th><th>Adet</th><th>Kayıt</th><th>Toplam Maliyet</th>
            </tr></thead>
            <tbody>${seasonRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="grid2 tyr5-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Durum Dağılımı</h2>
          <p class="panel__desc">Araç üzerinde / depoda / hurda</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Durum</th><th>Adet</th><th>Kayıt</th><th>Toplam Maliyet</th>
            </tr></thead>
            <tbody>${statusRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Aylık Lastik Maliyet Trendi</h2>
          <p class="panel__desc">Son 12 ay · en yeni ay önce</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Ay</th><th>Kayıt</th><th>Toplam Maliyet</th>
            </tr></thead>
            <tbody>${trendRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Yönetici Öngörüleri</h2>
        <p class="panel__desc">Executive Insights</p>
      </header>
      <div class="panel__body">
        <ul class="tyr5-analytics-insights">${insightItems || `<li class="tyr5-analytics-insight">Analiz için yeterli veri yok.</li>`}</ul>
      </div>
    </section>
  </div>`;
}

module.exports = {
  tireAnalyticsPageHtml,
};
