(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError() {
    var loading = document.getElementById("auditWidgetLoading");
    var error = document.getElementById("auditWidgetError");
    var content = document.getElementById("auditWidgetContent");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    if (content) content.hidden = true;
  }

  function renderActivityList(items) {
    var list = document.getElementById("auditWidgetActivityList");
    if (!list) return;

    if (!items || !items.length) {
      list.innerHTML = '<li class="audit-widget-activity-empty">Son 24 saatte işlem kaydı yok.</li>';
      return;
    }

    list.innerHTML = items
      .map(function (item) {
        var badges = "";
        if (item.has_critical_change) {
          badges += '<span class="audit-widget-badge audit-widget-badge--critical">Kritik</span>';
        } else if (item.has_important_change) {
          badges += '<span class="audit-widget-badge audit-widget-badge--important">Önemli</span>';
        }

        return (
          '<li class="audit-widget-activity-item">' +
          '<span class="audit-widget-activity-meta">' +
          escapeHtml(item.actor_name || "System") +
          " · " +
          escapeHtml(item.module_label || item.module || "—") +
          " · " +
          escapeHtml(item.action_label || item.action || "—") +
          badges +
          "</span>" +
          '<span class="audit-widget-activity-summary">' +
          escapeHtml(item.summary || "—") +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderWidget(data) {
    var loading = document.getElementById("auditWidgetLoading");
    var error = document.getElementById("auditWidgetError");
    var content = document.getElementById("auditWidgetContent");
    var summary = data && data.summary ? data.summary : {};

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;

    setText("auditWidgetLast24h", String(summary.last_24h_total || 0));
    setText("auditWidgetToday", String(summary.today_total || 0));
    setText("auditWidgetCreate", String(summary.create_count || 0));
    setText("auditWidgetUpdate", String(summary.update_count || 0));
    setText("auditWidgetDelete", String(summary.delete_count || 0));
    setText("auditWidgetImport", String(summary.import_count || 0));
    setText("auditWidgetCritical", String(summary.critical_change_count || 0));
    setText("auditWidgetImportant", String(summary.important_change_count || 0));
    setText(
      "auditWidgetSubtitle",
      summary.last_24h_total > 0
        ? "Son 24 saatte " + summary.last_24h_total + " işlem"
        : "Son 24 saatte işlem yok"
    );

    renderActivityList(data.latest_activity || []);
  }

  window.loadAuditDashboardWidget = async function loadAuditDashboardWidget() {
    if (!document.getElementById("auditDashboardWidget")) return;
    try {
      var res = await fetch("/api/audit/dashboard");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      renderWidget(data);
    } catch (_err) {
      showError();
    }
  };

  window.loadAuditDashboard = window.loadAuditDashboardWidget;

  document.addEventListener("DOMContentLoaded", function () {
    loadAuditDashboardWidget();
  });
})();
