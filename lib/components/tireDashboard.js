function tireDashboardWidgetHtml() {
  return `<section class="cmd-panel cmd-panel--tire fade-in" id="tireDashboardWidget">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Lastik Sağlığı</h3>
        <p class="cmd-panel__desc" id="tireWidgetSubtitle">Lastik özeti yükleniyor…</p>
      </div>
      <a href="/tire-analytics" class="btn btn--ghost btn--sm">Lastik Analitiği →</a>
    </header>
    <div class="panel__body tire-widget">
      <p class="tire-widget__loading" id="tireWidgetLoading">Lastik analitiği yükleniyor…</p>
      <p class="tire-widget__error" id="tireWidgetError" hidden>Lastik analitiği yüklenemedi.</p>
      <div id="tireWidgetContent" hidden>
        <div class="tire-widget-kpi-row">
          <article class="tire-widget-kpi tire-widget-kpi--score">
            <span>Skor</span><strong id="tireWidgetScore">—</strong>
          </article>
          <article class="tire-widget-kpi tire-widget-kpi--mismatch">
            <span>Uyumsuz</span><strong id="tireWidgetMismatch">0</strong>
          </article>
          <article class="tire-widget-kpi tire-widget-kpi--attention">
            <span>Dikkat</span><strong id="tireWidgetAttention">0</strong>
          </article>
          <article class="tire-widget-kpi tire-widget-kpi--unknown">
            <span>Bilinmiyor</span><strong id="tireWidgetUnknown">0</strong>
          </article>
          <article class="tire-widget-kpi tire-widget-kpi--storage">
            <span>Depoda</span><strong id="tireWidgetStorage">0</strong>
          </article>
        </div>
      </div>
    </div>
  </section>
  <script src="/js/tire-dashboard.js?v=${require("../layout-version")}"></script>`;
}

module.exports = {
  tireDashboardWidgetHtml,
};
