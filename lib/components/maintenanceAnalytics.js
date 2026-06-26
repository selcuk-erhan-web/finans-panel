const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { money } = require("../finance");
const { renderModuleTabs } = require("./moduleTabs");

function healthStatusClass(status) {
  if (status === "healthy") return "mnt-analytics-health--healthy";
  if (status === "watch") return "mnt-analytics-health--watch";
  if (status === "risk") return "mnt-analytics-health--risk";
  if (status === "critical") return "mnt-analytics-health--critical";
  return "mnt-analytics-health--unknown";
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "Bilinmiyor";
  return `${Math.round(score)}/100`;
}

function maintenanceAnalyticsPageHtml(analytics, path = "/maintenance-analytics") {
  const health = analytics.health || {};
  const risk = analytics.risk_summary || {};

  const vehicleRows = (analytics.vehicle_cost_ranking || []).length
    ? analytics.vehicle_cost_ranking
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${Number(row.record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
          <td>${money(row.average_cost || 0)}</td>
          <td>${formatDateDisplay(row.last_maintenance_date)}</td>
          <td>${row.last_odometer_km != null ? Number(row.last_odometer_km).toLocaleString("tr-TR") : "—"}</td>
          <td>${row.upcoming_count || 0}</td>
          <td>${row.due_count || 0}</td>
          <td>${row.overdue_count || 0}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="data-table__empty">Araç bakım maliyeti verisi bulunmuyor.</td></tr>`;

  const typeRows = (analytics.maintenance_type_distribution || []).length
    ? analytics.maintenance_type_distribution
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.maintenance_type_label || row.maintenance_type || "—")}</td>
          <td>${Number(row.record_count || 0).toLocaleString("tr-TR")}</td>
          <td>${money(row.total_cost || 0)}</td>
          <td>${money(row.average_cost || 0)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">Bakım türü dağılımı bulunmuyor.</td></tr>`;

  const trendRows = (analytics.monthly_cost_trend || []).length
    ? analytics.monthly_cost_trend
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
      (item) => `<li class="mnt-analytics-insight mnt-analytics-insight--${escapeHtml(item.level || "info")}">
        ${escapeHtml(item.message || "")}
      </li>`
    )
    .join("");

  return `<div class="dash page-enter dash--dense dash--executive mnt-analytics-hub">
    <header class="mnt-analytics-hub__header fade-in">
      <p class="mnt-analytics-hub__eyebrow">Filo Bakım · Executive Analytics</p>
      <h2 class="mnt-analytics-hub__title">Bakım Analitiği</h2>
      <p class="mnt-analytics-hub__desc">Bakım maliyeti, plan riski ve filo bakım sağlığı özeti.</p>
      ${renderModuleTabs("maintenance", path)}
    </header>

    <section class="mnt-analytics-health fade-in ${healthStatusClass(health.maintenance_health_status)}">
      <article class="mnt-analytics-health__hero">
        <span>Bakım Sağlık Skoru</span>
        <strong>${escapeHtml(scoreDisplay(health.maintenance_health_score))}</strong>
        <em>${escapeHtml(health.maintenance_health_label || "Bilinmiyor")}</em>
      </article>
      <div class="mnt-analytics-health__grid">
        <article><span>Toplam Kayıt</span><strong>${Number(health.total_records || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Toplam Maliyet</span><strong>${money(health.total_cost || 0)}</strong></article>
        <article><span>Bakımlı Araç</span><strong>${Number(health.vehicles_with_maintenance || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Ort. Kayıt Maliyeti</span><strong>${money(health.average_cost_per_record || 0)}</strong></article>
        <article><span>Yaklaşıyor</span><strong>${health.upcoming_count || 0}</strong></article>
        <article><span>Günü Geldi</span><strong>${health.due_count || 0}</strong></article>
        <article><span>Gecikti</span><strong>${health.overdue_count || 0}</strong></article>
      </div>
    </section>

    <section class="mnt-analytics-risk-row fade-in">
      <article class="mnt-analytics-risk mnt-analytics-risk--ok"><span>OK</span><strong>${risk.ok || 0}</strong></article>
      <article class="mnt-analytics-risk mnt-analytics-risk--upcoming"><span>Yaklaşıyor</span><strong>${risk.upcoming || 0}</strong></article>
      <article class="mnt-analytics-risk mnt-analytics-risk--due"><span>Günü Geldi</span><strong>${risk.due || 0}</strong></article>
      <article class="mnt-analytics-risk mnt-analytics-risk--overdue"><span>Gecikti</span><strong>${risk.overdue || 0}</strong></article>
      <article class="mnt-analytics-risk mnt-analytics-risk--unknown"><span>Bilinmiyor</span><strong>${risk.unknown || 0}</strong></article>
    </section>

    <div class="grid2 mnt-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Araç Maliyet Sıralaması</h2>
          <p class="panel__desc">En yüksek bakım maliyeti önce</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Plaka</th><th>Kayıt</th><th>Toplam</th><th>Ortalama</th><th>Son Bakım</th><th>Son KM</th><th>Yaklaşan</th><th>Günü Geldi</th><th>Gecikti</th>
            </tr></thead>
            <tbody>${vehicleRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Bakım Türü Dağılımı</h2>
          <p class="panel__desc">Tür bazlı maliyet dağılımı</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr>
              <th>Tür</th><th>Kayıt</th><th>Toplam Maliyet</th><th>Ortalama</th>
            </tr></thead>
            <tbody>${typeRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Aylık Maliyet Trendi</h2>
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

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Yönetici Öngörüleri</h2>
        <p class="panel__desc">Executive Insights</p>
      </header>
      <div class="panel__body">
        <ul class="mnt-analytics-insights">${insightItems || `<li class="mnt-analytics-insight">Analiz için yeterli veri yok.</li>`}</ul>
      </div>
    </section>
  </div>`;
}

module.exports = {
  maintenanceAnalyticsPageHtml,
};
