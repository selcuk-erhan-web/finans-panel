(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError() {
    var loading = document.getElementById("vehicleHealthWidgetLoading");
    var error = document.getElementById("vehicleHealthWidgetError");
    var content = document.getElementById("vehicleHealthWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function scoreDisplay(score) {
    if (score == null || !Number.isFinite(Number(score))) return "—";
    return Math.round(Number(score)) + "/100";
  }

  function renderWidget(data) {
    var loading = document.getElementById("vehicleHealthWidgetLoading");
    var error = document.getElementById("vehicleHealthWidgetError");
    var content = document.getElementById("vehicleHealthWidgetContent");
    var summary = data && data.summary ? data.summary : {};

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    setText("vehicleHealthWidgetAvg", scoreDisplay(summary.average_health_score));
    setText("vehicleHealthWidgetCritical", String(summary.critical || 0));
    setText("vehicleHealthWidgetRisk", String(summary.risk || 0));
    setText("vehicleHealthWidgetWatch", String(summary.watch || 0));

    var highest = summary.highest_risk_vehicle;
    var highlight = highest && highest.plate
      ? "En yüksek risk: " + highest.plate + " (" + scoreDisplay(highest.health_score) + ")"
      : "Filo sağlık özeti";

    setText("vehicleHealthWidgetHighlight", highlight);
    setText(
      "vehicleHealthWidgetSubtitle",
      summary.total_vehicles
        ? summary.total_vehicles + " araç · ortalama " + scoreDisplay(summary.average_health_score)
        : "Filo sağlık özeti"
    );
  }

  window.loadVehicleHealthDashboardWidget = async function loadVehicleHealthDashboardWidget() {
    if (!document.getElementById("vehicleHealthDashboardWidget")) return;
    try {
      var res = await fetch("/api/vehicle-health");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadVehicleHealthDashboardWidget();
  });
})();
