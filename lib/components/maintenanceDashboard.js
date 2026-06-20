const { escapeHtml } = require("./escape");

function maintenanceDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--maintenance fade-in" id="maintenanceDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Bakım Sağlığı</h3>
        <p class="cmd-panel__desc" id="maintenanceWidgetSubtitle">Bakım özeti yükleniyor…</p>
      </div>
      <a href="/maintenance-analytics" class="btn btn--ghost btn--sm">Bakım Analitiği →</a>
    </header>
    <div class="panel__body maintenance-widget">
      <p class="maintenance-widget__loading" id="maintenanceWidgetLoading">Bakım analitiği yükleniyor…</p>
      <p class="maintenance-widget__error" id="maintenanceWidgetError" hidden>Bakım analitiği yüklenemedi.</p>
      <div id="maintenanceWidgetContent" hidden>
        <div class="maintenance-widget-kpi-row">
          <article class="maintenance-widget-kpi maintenance-widget-kpi--score">
            <span>Skor</span><strong id="maintenanceWidgetScore">—</strong>
          </article>
          <article class="maintenance-widget-kpi maintenance-widget-kpi--overdue">
            <span>Gecikti</span><strong id="maintenanceWidgetOverdue">0</strong>
          </article>
          <article class="maintenance-widget-kpi maintenance-widget-kpi--due">
            <span>Günü Geldi</span><strong id="maintenanceWidgetDue">0</strong>
          </article>
          <article class="maintenance-widget-kpi maintenance-widget-kpi--upcoming">
            <span>Yaklaşıyor</span><strong id="maintenanceWidgetUpcoming">0</strong>
          </article>
        </div>
      </div>
    </div>
  </section>
  <script src="/js/maintenance-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  maintenanceDashboardWidgetHtml,
};
