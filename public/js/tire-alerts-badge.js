(function () {
  function setCount(value) {
    var count = Number(value);
    if (!Number.isFinite(count) || count < 0) count = 0;
    var text = String(count);

    var mastheadCount = document.getElementById("tireAlertsUnreadCount");
    var dashboardCount = document.getElementById("dashboardTireAlertsCount");

    if (mastheadCount) mastheadCount.textContent = text;
    if (dashboardCount) dashboardCount.textContent = text;
  }

  window.refreshTireAlertsBadge = async function refreshTireAlertsBadge() {
    try {
      var res = await fetch("/api/tire-alerts/unread-count");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      setCount(data.count);
    } catch (_err) {
      setCount(0);
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("tireAlertsUnreadCount") || document.getElementById("dashboardTireAlertsCount")) {
      refreshTireAlertsBadge();
    }
  });
})();
