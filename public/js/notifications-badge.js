(function () {
  function setCount(value) {
    var count = Number(value);
    if (!Number.isFinite(count) || count < 0) count = 0;
    var text = String(count);

    var mastheadCount = document.getElementById("notificationsUnreadCount");
    var dashboardCount = document.getElementById("dashboardNotificationsCount");

    if (mastheadCount) mastheadCount.textContent = text;
    if (dashboardCount) dashboardCount.textContent = text;
  }

  window.refreshNotificationBadge = async function refreshNotificationBadge() {
    try {
      var res = await fetch("/api/notifications/unread-count");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      setCount(data.count);
    } catch (_err) {
      setCount(0);
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (
      document.getElementById("notificationsUnreadCount") ||
      document.getElementById("dashboardNotificationsCount")
    ) {
      refreshNotificationBadge();
    }
  });
})();
