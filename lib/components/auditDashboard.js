const { escapeHtml } = require("./escape");

function auditDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--audit fade-in" id="auditDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">İşlem Aktivitesi</h3>
        <p class="cmd-panel__desc" id="auditWidgetSubtitle">İşlem özeti yükleniyor…</p>
      </div>
      <a href="/audit-logs" class="btn btn--ghost btn--sm">Tüm İşlem Geçmişi →</a>
    </header>
    <div class="panel__body audit-widget">
      <p class="audit-widget__loading" id="auditWidgetLoading">İşlem aktivitesi yükleniyor…</p>
      <p class="audit-widget__error" id="auditWidgetError" hidden>İşlem aktivitesi yüklenemedi.</p>
      <div id="auditWidgetContent" hidden>
        <div class="audit-widget-kpi-row">
          <article class="audit-widget-kpi audit-widget-kpi--window">
            <span>Son 24 Saat</span><strong id="auditWidgetLast24h">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--today">
            <span>Bugün</span><strong id="auditWidgetToday">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--create">
            <span>Oluşturma</span><strong id="auditWidgetCreate">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--update">
            <span>Güncelleme</span><strong id="auditWidgetUpdate">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--delete">
            <span>Silme</span><strong id="auditWidgetDelete">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--import">
            <span>Import</span><strong id="auditWidgetImport">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--critical">
            <span>Kritik Değişiklik</span><strong id="auditWidgetCritical">0</strong>
          </article>
          <article class="audit-widget-kpi audit-widget-kpi--important">
            <span>Önemli Değişiklik</span><strong id="auditWidgetImportant">0</strong>
          </article>
        </div>
        <ul class="audit-widget-activity-list" id="auditWidgetActivityList"></ul>
      </div>
    </div>
  </section>
  <script src="/js/audit-dashboard.js?v=${require("../layout-version")}"></script>`;
}

function executiveAuditSummaryHtml(dashboard) {
  if (!dashboard || !dashboard.summary) return "";

  const summary = dashboard.summary;
  const insights = (dashboard.executive_insights || [])
    .map(
      (item) =>
        `<li class="aud4-insight aud4-insight--${escapeHtml(item.level || "info")}">${escapeHtml(item.message || "")}</li>`
    )
    .join("");

  return `<section class="aud4-executive-summary fade-in">
    <header class="aud4-executive-summary__head">
      <h3 class="aud4-executive-summary__title">Yönetici İşlem Özeti</h3>
      <p class="aud4-executive-summary__desc">Son 24 saatlik sistem aktivitesi ve kritik değişim sinyalleri.</p>
    </header>
    <div class="aud4-executive-summary__grid">
      <article><span>Son 24 Saat</span><strong>${Number(summary.last_24h_total || 0).toLocaleString("tr-TR")}</strong></article>
      <article><span>Bugün</span><strong>${Number(summary.today_total || 0).toLocaleString("tr-TR")}</strong></article>
      <article><span>Kritik</span><strong>${Number(summary.critical_change_count || 0).toLocaleString("tr-TR")}</strong></article>
      <article><span>Önemli</span><strong>${Number(summary.important_change_count || 0).toLocaleString("tr-TR")}</strong></article>
    </div>
    ${insights ? `<ul class="aud4-insight-list">${insights}</ul>` : ""}
  </section>`;
}

module.exports = {
  auditDashboardWidgetHtml,
  executiveAuditSummaryHtml,
};
