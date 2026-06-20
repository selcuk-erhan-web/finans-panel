const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const {
  MODULE_LABELS,
  ACTION_LABELS,
  VALID_MODULES,
  VALID_ACTIONS,
} = require("../../services/auditLogService");

const MODULE_OPTIONS = [
  ["", "Tüm Modüller"],
  ...[...VALID_MODULES].sort().map((key) => [key, MODULE_LABELS[key] || key]),
];

const ACTION_OPTIONS = [
  ["", "Tüm İşlemler"],
  ...[...VALID_ACTIONS].sort().map((key) => [key, ACTION_LABELS[key] || key]),
];

function healthStatusClass(status) {
  if (status === "healthy") return "aud5-analytics-health--healthy";
  if (status === "watch") return "aud5-analytics-health--watch";
  if (status === "risk") return "aud5-analytics-health--risk";
  if (status === "critical") return "aud5-analytics-health--critical";
  return "aud5-analytics-health--unknown";
}

function scoreDisplay(score) {
  if (score == null || !Number.isFinite(score)) return "Bilinmiyor";
  return `${Math.round(score)}/100`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("tr-TR");
}

function auditAnalyticsPageHtml(analytics, filters = {}) {
  const health = analytics.health || {};
  const applied = analytics.filters || filters;

  const moduleOptions = MODULE_OPTIONS.map(
    ([value, label]) =>
      `<option value="${escapeHtml(value)}" ${applied.module === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");

  const actionOptions = ACTION_OPTIONS.map(
    ([value, label]) =>
      `<option value="${escapeHtml(value)}" ${applied.action === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");

  const moduleRows = (analytics.module_distribution || []).length
    ? analytics.module_distribution
        .map(
          (row) => `<tr>
          <td><span class="aud5-badge aud5-badge--module">${escapeHtml(row.label || row.module || "—")}</span></td>
          <td>${Number(row.count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="data-table__empty">Modül dağılımı bulunmuyor.</td></tr>`;

  const actionRows = (analytics.action_distribution || []).length
    ? analytics.action_distribution
        .map(
          (row) => `<tr>
          <td><span class="aud5-badge aud5-badge--action">${escapeHtml(row.label || row.action || "—")}</span></td>
          <td>${Number(row.count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="data-table__empty">İşlem dağılımı bulunmuyor.</td></tr>`;

  const actorRows = (analytics.actor_activity || []).length
    ? analytics.actor_activity
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.actor_name || "—")}</td>
          <td>${Number(row.count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.create_count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.update_count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.delete_count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.import_count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Kullanıcı aktivitesi bulunmuyor.</td></tr>`;

  const entityRows = (analytics.entity_type_distribution || []).length
    ? analytics.entity_type_distribution
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.entity_type || "—")}</td>
          <td>${Number(row.count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="data-table__empty">Varlık türü dağılımı bulunmuyor.</td></tr>`;

  const trendRows = (analytics.daily_activity_trend || []).length
    ? analytics.daily_activity_trend
        .map(
          (row) => `<tr>
          <td>${formatDateDisplay(row.date)}</td>
          <td>${Number(row.count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.critical_count || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.important_count || 0).toLocaleString("tr-TR")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">Günlük aktivite trendi bulunmuyor.</td></tr>`;

  const criticalRows = (analytics.critical_changes || []).length
    ? analytics.critical_changes
        .map((row) => {
          const changeCount = (row.formatted_changes || []).length;
          return `<tr>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          <td><span class="aud5-badge aud5-badge--module">${escapeHtml(MODULE_LABELS[row.module] || row.module || "—")}</span></td>
          <td>${escapeHtml(row.entity_type || "—")}${row.entity_id ? ` #${escapeHtml(row.entity_id)}` : ""}</td>
          <td>${escapeHtml(row.actor_name || "—")}</td>
          <td>${escapeHtml(row.summary || "—")}</td>
          <td>${changeCount}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Kritik değişiklik kaydı bulunmuyor.</td></tr>`;

  const insightItems = (analytics.insights || [])
    .map(
      (item) =>
        `<li class="aud5-analytics-insight aud5-analytics-insight--${escapeHtml(item.level || "info")}">${escapeHtml(item.message || "")}</li>`
    )
    .join("");

  return `<div class="dash page-enter dash--dense aud5-analytics-hub">
    <header class="aud5-analytics-hub__header fade-in">
      <p class="aud5-analytics-hub__eyebrow">FleetOS · Audit Analytics</p>
      <h2 class="aud5-analytics-hub__title">Denetim Analitiği</h2>
      <p class="aud5-analytics-hub__desc">Operasyonel aktivite, modül yoğunluğu, kullanıcı hareketleri ve kritik değişim analizi.</p>
      <div class="aud5-analytics-hub__links">
        <a href="/audit-logs" class="btn btn--ghost btn--sm">İşlem Geçmişi →</a>
      </div>
    </header>

    <section class="panel fade-in aud5-analytics-filters">
      <header class="panel__head">
        <h2 class="panel__title">Filtreler</h2>
      </header>
      <form class="aud5-filter-form" method="GET" action="/audit-analytics">
        <label>Modül
          <select name="module">${moduleOptions}</select>
        </label>
        <label>İşlem
          <select name="action">${actionOptions}</select>
        </label>
        <label>Kullanıcı ID
          <input type="text" name="actor_id" value="${escapeHtml(applied.actor_id || "")}" placeholder="system">
        </label>
        <label>Başlangıç
          <input type="date" name="date_from" value="${escapeHtml(applied.date_from || "")}">
        </label>
        <label>Bitiş
          <input type="date" name="date_to" value="${escapeHtml(applied.date_to || "")}">
        </label>
        <button type="submit" class="btn btn--primary btn--sm">Uygula</button>
      </form>
    </section>

    <section class="aud5-analytics-health fade-in ${healthStatusClass(health.audit_health_status)}">
      <article class="aud5-analytics-health__hero">
        <span>Denetim Sağlık Skoru</span>
        <strong>${escapeHtml(scoreDisplay(health.audit_health_score))}</strong>
        <em>${escapeHtml(health.audit_health_label || "Bilinmiyor")}</em>
      </article>
      <div class="aud5-analytics-health__grid">
        <article><span>Toplam İşlem</span><strong>${Number(health.total_logs || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Bugün</span><strong>${Number(health.today_total || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Son 7 Gün</span><strong>${Number(health.last_7_days_total || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Kritik Değişiklik</span><strong>${Number(health.critical_change_count || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Önemli Değişiklik</span><strong>${Number(health.important_change_count || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Silme</span><strong>${Number(health.delete_count || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Import</span><strong>${Number(health.import_count || 0).toLocaleString("tr-TR")}</strong></article>
      </div>
    </section>

    <div class="grid2 aud5-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Modül Dağılımı</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Modül</th><th>Adet</th></tr></thead>
            <tbody>${moduleRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">İşlem Dağılımı</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>İşlem</th><th>Adet</th></tr></thead>
            <tbody>${actionRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Kullanıcı Aktivitesi</h2>
        <p class="panel__desc">İşlem sayısına göre sıralı</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Kullanıcı</th><th>Toplam</th><th>Oluşturma</th><th>Güncelleme</th><th>Silme</th><th>Import</th>
          </tr></thead>
          <tbody>${actorRows}</tbody>
        </table>
      </div>
    </section>

    <div class="grid2 aud5-analytics-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Varlık Türü Dağılımı</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Varlık Türü</th><th>Adet</th></tr></thead>
            <tbody>${entityRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Günlük Aktivite Trendi</h2>
          <p class="panel__desc">Son 14 gün · en yeni gün önce</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Tarih</th><th>Adet</th><th>Kritik</th><th>Önemli</th></tr></thead>
            <tbody>${trendRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Kritik Değişiklikler</h2>
        <p class="panel__desc">Kritik önem dereceli alan değişimleri</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Tarih</th><th>Modül</th><th>Varlık</th><th>Kullanıcı</th><th>Özet</th><th>Değişim</th>
          </tr></thead>
          <tbody>${criticalRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Yönetici Öngörüleri</h2>
        <p class="panel__desc">Yönetici öngörüleri</p>
      </header>
      <div class="panel__body">
        <ul class="aud5-analytics-insights">${insightItems || `<li class="aud5-analytics-insight">Analiz için yeterli veri yok.</li>`}</ul>
      </div>
    </section>
  </div>`;
}

module.exports = {
  auditAnalyticsPageHtml,
};
