(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError() {
    var loading = document.getElementById("maintenanceWidgetLoading");
    var error = document.getElementById("maintenanceWidgetError");
    var content = document.getElementById("maintenanceWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function renderWidget(data) {
    var loading = document.getElementById("maintenanceWidgetLoading");
    var error = document.getElementById("maintenanceWidgetError");
    var content = document.getElementById("maintenanceWidgetContent");
    var health = data && data.health ? data.health : {};

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    var score =
      health.maintenance_health_score != null && Number.isFinite(Number(health.maintenance_health_score))
        ? Math.round(Number(health.maintenance_health_score)) + "/100"
        : "—";

    setText("maintenanceWidgetScore", score);
    setText("maintenanceWidgetOverdue", String(health.overdue_count || 0));
    setText("maintenanceWidgetDue", String(health.due_count || 0));
    setText("maintenanceWidgetUpcoming", String(health.upcoming_count || 0));
    setText(
      "maintenanceWidgetSubtitle",
      health.maintenance_health_label
        ? "Durum: " + health.maintenance_health_label
        : "Bakım sağlığı özeti"
    );
  }

  window.loadMaintenanceDashboardWidget = async function loadMaintenanceDashboardWidget() {
    if (!document.getElementById("maintenanceDashboardWidget")) return;
    try {
      var res = await fetch("/api/maintenance/analytics");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadMaintenanceDashboardWidget();
  });
})();
