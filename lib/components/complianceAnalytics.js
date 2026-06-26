const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { renderModuleTabs } = require("./moduleTabs");

function healthStatusClass(status) {
  if (status === "healthy") return "compliance-analytics-health--healthy";
  if (status === "watch") return "compliance-analytics-health--watch";
  if (status === "risk") return "compliance-analytics-health--risk";
  if (status === "critical") return "compliance-analytics-health--critical";
  return "compliance-analytics-health--unknown";
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "Unknown";
  return `${Math.round(score)}/100`;
}

function statusBadge(status) {
  const map = {
    active: "pill pill--green",
    warning: "pill pill--amber",
    critical: "pill pill--red",
    expired: "pill pill--red",
    unknown: "pill pill--muted",
    healthy: "pill pill--green",
    watch: "pill pill--blue",
    risk: "pill pill--amber",
    critical_health: "pill pill--red",
  };
  const cls = map[status] || map.unknown;
  const label = status === "healthy" || status === "watch" || status === "risk"
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : status === "active"
      ? "Active"
      : status === "warning"
        ? "Warning"
        : status === "critical"
          ? "Critical"
          : status === "expired"
            ? "Expired"
            : "Unknown";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function complianceAnalyticsPageHtml(analytics, path = "/compliance-analytics") {
  const health = analytics.health || {};
  const vehicleRows = (analytics.vehicle_risk_ranking || []).length
    ? analytics.vehicle_risk_ranking
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(scoreDisplay(row.score))}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${row.warning_count || 0}</td>
          <td>${row.critical_count || 0}</td>
          <td>${row.expired_count || 0}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Araç risk verisi bulunmuyor.</td></tr>`;

  const typeRows = (analytics.document_type_distribution || []).length
    ? analytics.document_type_distribution
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.type_label || row.document_type || "—")}</td>
          <td>${row.total || 0}</td>
          <td>${row.active || 0}</td>
          <td>${row.warning || 0}</td>
          <td>${row.critical || 0}</td>
          <td>${row.expired || 0}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Belge türü dağılımı bulunmuyor.</td></tr>`;

  const renewalRows = (analytics.upcoming_renewals || []).length
    ? analytics.upcoming_renewals
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(row.vehicle_id)}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(row.type_label || row.document_type || "—")}</td>
          <td>${formatDateDisplay(row.expiration_date)}</td>
          <td>${row.days_remaining != null ? row.days_remaining : "—"}</td>
          <td>${statusBadge(row.status)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Yaklaşan yenileme kaydı bulunmuyor.</td></tr>`;

  const insightItems = (analytics.insights || [])
    .map(
      (item) => `<li class="compliance-analytics-insight compliance-analytics-insight--${escapeHtml(item.level || "info")}">
        ${escapeHtml(item.message || "")}
      </li>`
    )
    .join("");

  return `<div class="dash page-enter dash--dense dash--executive compliance-analytics-hub">
    <header class="compliance-analytics-hub__header fade-in">
      <p class="compliance-analytics-hub__eyebrow">Filo Uygunluk · Executive Analytics</p>
      <h2 class="compliance-analytics-hub__title">Uygunluk Analitiği</h2>
      <p class="compliance-analytics-hub__desc">Filo uygunluk sağlığı, araç risk sıralaması, belge dağılımı ve yenileme takvimi.</p>
      ${renderModuleTabs("compliance", path)}
    </header>

    <section class="compliance-analytics-health fade-in ${healthStatusClass(health.fleet_health_status)}">
      <article class="compliance-analytics-health__hero">
        <span>Filo Sağlık Skoru</span>
        <strong>${escapeHtml(scoreDisplay(health.fleet_health_score))}</strong>
        <em>${escapeHtml(health.fleet_health_label || "Unknown")}</em>
      </article>
      <div class="compliance-analytics-health__grid">
        <article><span>Total Documents</span><strong>${health.total_documents || 0}</strong></article>
        <article><span>Active</span><strong>${health.active || 0}</strong></article>
        <article><span>Warning</span><strong>${health.warning || 0}</strong></article>
        <article><span>Critical</span><strong>${health.critical || 0}</strong></article>
        <article><span>Expired</span><strong>${health.expired || 0}</strong></article>
      </div>
    </section>

    <div class="grid2 compliance-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Vehicle Risk Ranking</h2>
          <p class="panel__desc">Plaka · Skor · Durum · Warning · Critical · Expired</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Araç</th><th>Skor</th><th>Durum</th><th>Warning</th><th>Critical</th><th>Expired</th>
            </tr></thead>
            <tbody>${vehicleRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Document Type Distribution</h2>
          <p class="panel__desc">Belge türüne göre risk dağılımı</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Belge Türü</th><th>Toplam</th><th>Active</th><th>Warning</th><th>Critical</th><th>Expired</th>
            </tr></thead>
            <tbody>${typeRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Upcoming Renewals</h2>
        <p class="panel__desc">En yüksek riskli yenilemeler · max 20 kayıt</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Araç</th><th>Belge</th><th>Bitiş</th><th>Gün</th><th>Durum</th>
          </tr></thead>
          <tbody>${renewalRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Executive Insights</h2>
        <p class="panel__desc">Yönetici özeti</p>
      </header>
      <div class="panel__body">
        <ul class="compliance-analytics-insights">${insightItems || `<li class="compliance-analytics-insight">Analiz için yeterli veri yok.</li>`}</ul>
      </div>
    </section>
  </div>`;
}

module.exports = {
  complianceAnalyticsPageHtml,
};
