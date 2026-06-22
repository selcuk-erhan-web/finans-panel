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
    var loading = document.getElementById("executiveVehicleWidgetLoading");
    var error = document.getElementById("executiveVehicleWidgetError");
    var content = document.getElementById("executiveVehicleWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function renderWidget(data) {
    var loading = document.getElementById("executiveVehicleWidgetLoading");
    var error = document.getElementById("executiveVehicleWidgetError");
    var content = document.getElementById("executiveVehicleWidgetContent");
    var summary = data && data.summary ? data.summary : {};
    var highestRisk = data && data.highest_risk ? data.highest_risk : [];

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    setText(
      "executiveVehicleWidgetHealth",
      summary.average_health_score != null ? summary.average_health_score + "/100" : "—"
    );
    setText("executiveVehicleWidgetNet", money(summary.net_profit || 0));
    setText("executiveVehicleWidgetUrgent", String(summary.urgent_count || 0));
    setText("executiveVehicleWidgetHigh", String(summary.high_priority_count || 0));
    setText(
      "executiveVehicleWidgetSubtitle",
      summary.total_vehicles
        ? summary.total_vehicles + " araç · " + summary.urgent_count + " acil"
        : "Yönetici araç zekâsı"
    );

    if (highestRisk.length > 0) {
      setText(
        "executiveVehicleWidgetRisk",
        "En yüksek risk: " + (highestRisk[0].plate || "—") + " · " + (highestRisk[0].recommended_action || "")
      );
    } else {
      setText("executiveVehicleWidgetRisk", "Acil/yüksek riskli araç bulunmuyor.");
    }
  }

  window.loadExecutiveVehicleDashboardWidget = async function loadExecutiveVehicleDashboardWidget() {
    if (!document.getElementById("executiveVehicleDashboardWidget")) return;
    try {
      var res = await fetch("/api/executive-vehicle-dashboard");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadExecutiveVehicleDashboardWidget();
  });
})();
