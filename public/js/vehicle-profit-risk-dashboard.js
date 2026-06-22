(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function money(n) {
    var num = Number(n) || 0;
    return num.toLocaleString("tr-TR") + " ₺";
  }

  function showError() {
    var loading = document.getElementById("vehicleProfitRiskWidgetLoading");
    var error = document.getElementById("vehicleProfitRiskWidgetError");
    var content = document.getElementById("vehicleProfitRiskWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function renderWidget(data) {
    var loading = document.getElementById("vehicleProfitRiskWidgetLoading");
    var error = document.getElementById("vehicleProfitRiskWidgetError");
    var content = document.getElementById("vehicleProfitRiskWidgetContent");
    var summary = data && data.summary ? data.summary : {};

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    setText("vehicleProfitRiskWidgetNet", money(summary.net_profit || 0));
    setText("vehicleProfitRiskWidgetStars", String(summary.stars || 0));
    setText("vehicleProfitRiskWidgetLossHigh", String(summary.loss_high_risk || 0));
    setText("vehicleProfitRiskWidgetUrgent", String(summary.urgent_count || 0));
    setText("vehicleProfitRiskWidgetHigh", String(summary.high_priority_count || 0));
    setText(
      "vehicleProfitRiskWidgetSubtitle",
      summary.total_vehicles
        ? summary.total_vehicles + " araç · " + summary.urgent_count + " acil"
        : "Kâr/risk özeti"
    );
  }

  window.loadVehicleProfitRiskDashboardWidget = async function loadVehicleProfitRiskDashboardWidget() {
    if (!document.getElementById("vehicleProfitRiskDashboardWidget")) return;
    try {
      var res = await fetch("/api/vehicle-profit-risk");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadVehicleProfitRiskDashboardWidget();
  });
})();
