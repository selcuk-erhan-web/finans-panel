(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError() {
    var loading = document.getElementById("tireWidgetLoading");
    var error = document.getElementById("tireWidgetError");
    var content = document.getElementById("tireWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function renderWidget(data) {
    var loading = document.getElementById("tireWidgetLoading");
    var error = document.getElementById("tireWidgetError");
    var content = document.getElementById("tireWidgetContent");
    var health = data && data.health ? data.health : {};

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    var score =
      health.tire_health_score != null && Number.isFinite(Number(health.tire_health_score))
        ? Math.round(Number(health.tire_health_score)) + "/100"
        : "—";

    setText("tireWidgetScore", score);
    setText("tireWidgetMismatch", String(health.season_mismatch_count || 0));
    setText("tireWidgetAttention", String(health.attention_count || 0));
    setText("tireWidgetUnknown", String(health.unknown_count || 0));
    setText("tireWidgetStorage", String(health.in_storage_quantity || 0));
    setText(
      "tireWidgetSubtitle",
      health.tire_health_label ? "Durum: " + health.tire_health_label : "Lastik sağlığı özeti"
    );
  }

  window.loadTireDashboardWidget = async function loadTireDashboardWidget() {
    if (!document.getElementById("tireDashboardWidget")) return;
    try {
      var res = await fetch("/api/tires/analytics");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadTireDashboardWidget();
  });
})();
