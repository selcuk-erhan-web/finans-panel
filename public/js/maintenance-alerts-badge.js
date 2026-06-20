(function () {
  function setCount(value) {
    var count = Number(value);
    if (!Number.isFinite(count) || count < 0) count = 0;
    var text = String(count);

    var mastheadCount = document.getElementById("maintenanceAlertsUnreadCount");
    var dashboardCount = document.getElementById("dashboardMaintenanceAlertsCount");

    if (mastheadCount) mastheadCount.textContent = text;
    if (dashboardCount) dashboardCount.textContent = text;
  }

  window.refreshMaintenanceAlertsBadge = async function refreshMaintenanceAlertsBadge() {
    try {
      var res = await fetch("/api/maintenance/alerts/unread-count");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      setCount(data.count);
    } catch (_err) {
      setCount(0);
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (
      document.getElementById("maintenanceAlertsUnreadCount") ||
      document.getElementById("dashboardMaintenanceAlertsCount")
    ) {
      refreshMaintenanceAlertsBadge();
    }
  });
})();
