(function () {
  var STATUS_LABELS = {
    active: "Active",
    warning: "Warning",
    critical: "Critical",
    expired: "Expired",
    unknown: "Unknown",
  };

  var VEHICLE_STATUS_ORDER = {
    expired: 0,
    critical: 1,
    warning: 2,
    active: 3,
    unknown: 4,
  };

  function formatDate(val) {
    if (!val) return "—";
    var d = new Date(String(val).slice(0, 10) + "T12:00:00");
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("tr-TR");
  }

  function formatDays(days) {
    if (days == null || Number.isNaN(days)) return "—";
    if (days < 0) return Math.abs(days) + " gün geçti";
    if (days === 0) return "Bugün";
    return days + " gün";
  }

  function formatScore(score) {
    if (score == null) return "Unknown";
    return Math.round(Number(score)) + "/100";
  }

  function pickRiskRecords(records) {
    return (records || [])
      .filter(function (row) {
        return row.status === "critical" || row.status === "expired";
      })
      .sort(function (a, b) {
        if (a.status !== b.status) {
          if (a.status === "expired") return -1;
          if (b.status === "expired") return 1;
        }
        return (a.days_remaining != null ? a.days_remaining : 9999) -
          (b.days_remaining != null ? b.days_remaining : 9999);
      })
      .slice(0, 5);
  }

  function sortVehicleScores(scores) {
    return (scores || [])
      .slice()
      .sort(function (a, b) {
        var orderA = VEHICLE_STATUS_ORDER[a.status] != null ? VEHICLE_STATUS_ORDER[a.status] : 99;
        var orderB = VEHICLE_STATUS_ORDER[b.status] != null ? VEHICLE_STATUS_ORDER[b.status] : 99;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
      })
      .slice(0, 9);
  }

  function renderRiskList(records) {
    var list = document.getElementById("complianceWidgetRiskList");
    if (!list) return;

    var rows = pickRiskRecords(records);
    if (!rows.length) {
      list.innerHTML = '<p class="compliance-widget-empty">No critical compliance issues</p>';
      return;
    }

    list.innerHTML =
      '<ul class="compliance-widget-risk-list">' +
      rows
        .map(function (row) {
          var status = STATUS_LABELS[row.status] || row.status || "—";
          var typeLabel = row.type_label || row.document_type || "—";
          return (
            '<li class="compliance-widget-risk-item compliance-widget-risk-item--' +
            (row.status || "unknown") +
            '">' +
            '<strong class="compliance-widget-risk-item__plate">' +
            (row.plate || "—") +
            "</strong>" +
            '<span class="compliance-widget-risk-item__type">' +
            typeLabel +
            "</span>" +
            '<span class="compliance-widget-risk-item__date">' +
            formatDate(row.expiry_date) +
            "</span>" +
            '<span class="compliance-widget-risk-item__days">' +
            formatDays(row.days_remaining) +
            "</span>" +
            '<span class="compliance-widget-risk-item__status">' +
            status +
            "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderVehicleScores(scores) {
    var root = document.getElementById("complianceWidgetVehicleScores");
    if (!root) return;

    var rows = sortVehicleScores(scores);
    if (!rows.length) {
      root.innerHTML = '<p class="compliance-widget-empty">Araç skoru bulunamadı.</p>';
      return;
    }

    root.innerHTML =
      '<div class="compliance-widget-score-grid">' +
      rows
        .map(function (row) {
          var status = STATUS_LABELS[row.status] || row.status || "Unknown";
          return (
            '<article class="compliance-widget-score-card compliance-widget-score-card--' +
            (row.status || "unknown") +
            '">' +
            '<span class="compliance-widget-score-card__plate">' +
            (row.plate || "—") +
            "</span>" +
            '<strong class="compliance-widget-score-card__score">' +
            formatScore(row.score) +
            "</strong>" +
            '<em class="compliance-widget-score-card__status">' +
            status +
            "</em>" +
            "</article>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderSummary(summary) {
    var active = document.getElementById("complianceCountActive");
    var warning = document.getElementById("complianceCountWarning");
    var critical = document.getElementById("complianceCountCritical");
    var expired = document.getElementById("complianceCountExpired");
    var subtitle = document.getElementById("complianceWidgetSubtitle");

    if (active) active.textContent = String(summary.active || 0);
    if (warning) warning.textContent = String(summary.warning || 0);
    if (critical) critical.textContent = String(summary.critical || 0);
    if (expired) expired.textContent = String(summary.expired || 0);

    if (subtitle) {
      var total =
        (summary.active || 0) +
        (summary.warning || 0) +
        (summary.critical || 0) +
        (summary.expired || 0);
      subtitle.textContent = total + " kayıtlı evrak · CC-3 durum özeti";
    }
  }

  window.loadComplianceStatus = async function loadComplianceStatus() {
    var root = document.getElementById("complianceDashboardWidget");
    if (!root) return;

    var loading = document.getElementById("complianceWidgetLoading");
    var error = document.getElementById("complianceWidgetError");
    var content = document.getElementById("complianceWidgetContent");

    if (loading) loading.hidden = false;
    if (error) error.hidden = true;
    if (content) content.hidden = true;

    try {
      var res = await fetch("/api/compliance/status");
      if (!res.ok) throw new Error("API " + res.status);
      var data = await res.json();
      if (!data || !data.summary) throw new Error("Invalid payload");

      renderSummary(data.summary || {});
      renderRiskList(data.records || []);
      renderVehicleScores(data.vehicle_scores || []);

      if (loading) loading.hidden = true;
      if (content) content.hidden = false;
    } catch (_err) {
      if (loading) loading.hidden = true;
      if (content) content.hidden = true;
      if (error) error.hidden = false;
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("complianceDashboardWidget")) {
      loadComplianceStatus();
    }
  });
})();
