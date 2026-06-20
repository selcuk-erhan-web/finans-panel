const { escapeHtml } = require("./escape");

function complianceDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--compliance fade-in" id="complianceDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Compliance Status</h3>
        <p class="cmd-panel__desc" id="complianceWidgetSubtitle">Uygunluk özeti yükleniyor…</p>
      </div>
      <a href="/documents" class="btn btn--ghost btn--sm">Uygunluk Merkezi →</a>
    </header>
    <div class="panel__body compliance-widget">
      <p class="compliance-widget__loading" id="complianceWidgetLoading">Uygunluk durumu yükleniyor…</p>
      <p class="compliance-widget__error" id="complianceWidgetError" hidden>Uygunluk durumu yüklenemedi.</p>
      <div id="complianceWidgetContent" hidden>
        <div class="compliance-widget-kpi-row" id="complianceWidgetSummary">
          <article class="compliance-widget-kpi compliance-widget-kpi--active">
            <span>Active</span><strong id="complianceCountActive">0</strong>
          </article>
          <article class="compliance-widget-kpi compliance-widget-kpi--warning">
            <span>Warning</span><strong id="complianceCountWarning">0</strong>
          </article>
          <article class="compliance-widget-kpi compliance-widget-kpi--critical">
            <span>Critical</span><strong id="complianceCountCritical">0</strong>
          </article>
          <article class="compliance-widget-kpi compliance-widget-kpi--expired">
            <span>Expired</span><strong id="complianceCountExpired">0</strong>
          </article>
        </div>

        <div class="compliance-widget-section">
          <h4 class="compliance-widget-section__title">Critical / Expired</h4>
          <div class="compliance-widget-risk" id="complianceWidgetRiskList"></div>
        </div>

        <div class="compliance-widget-section">
          <h4 class="compliance-widget-section__title">Vehicle Compliance Score</h4>
          <div class="compliance-widget-scores" id="complianceWidgetVehicleScores"></div>
        </div>
      </div>
    </div>
  </section>
  <script src="/js/compliance-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  complianceDashboardWidgetHtml,
};
