const { escapeHtml } = require("./escape");
const { renderModuleTabs } = require("./moduleTabs");

const FILTER_OPTIONS = [
  ["all", "Tümü"],
  ["unread", "Okunmamış"],
  ["upcoming", "Yaklaşıyor"],
  ["due", "Günü Geldi"],
  ["overdue", "Gecikti"],
];

const SEVERITY_LABELS = {
  upcoming: "Yaklaşıyor",
  due: "Günü Geldi",
  overdue: "Gecikti",
};

function severityPill(severity) {
  const map = {
    upcoming: "pill pill--amber",
    due: "pill pill--blue",
    overdue: "pill pill--red",
  };
  const cls = map[severity] || "pill pill--muted";
  const label = SEVERITY_LABELS[severity] || severity;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function formatCreatedAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("tr-TR");
}

function maintenanceTypeLabel(maintenanceType) {
  try {
    const maintenanceService = require("../../services/maintenanceService");
    return maintenanceService.typeLabel(maintenanceType);
  } catch {
    return maintenanceType || "—";
  }
}

function maintenanceAlertsPageHtml({ alerts, unreadCount, filter = "all", path = "/maintenance-alerts" }) {
  const filterLinks = FILTER_OPTIONS.map(
    ([key, label]) =>
      `<a href="/maintenance-alerts?filter=${key}" class="btn btn--sm ${
        filter === key ? "btn--primary" : "btn--ghost"
      }">${escapeHtml(label)}</a>`
  ).join("");

  const rows = alerts.length
    ? alerts
        .map(
          (alert) => `<tr class="mnt-alert-row mnt-alert-row--${escapeHtml(alert.severity)} ${
            alert.status === "unread" ? "mnt-alert-row--unread" : ""
          }">
          <td>${severityPill(alert.severity)}</td>
          <td><a class="plate-link" href="/vehicle/${alert.vehicle_id}">${escapeHtml(alert.plate || "—")}</a></td>
          <td>${escapeHtml(alert.maintenance_type_label || maintenanceTypeLabel(alert.maintenance_type))}</td>
          <td>${escapeHtml(alert.message || "—")}</td>
          <td>${escapeHtml(formatCreatedAt(alert.created_at))}</td>
          <td>${alert.status === "unread" ? "Okunmadı" : "Okundu"}</td>
          <td class="data-table__actions">
            ${
              alert.status === "unread"
                ? `<form method="POST" action="/api/maintenance/alerts/${escapeHtml(alert.id)}/read" class="mnt-alert-read-form">
                    <button type="submit" class="btn btn--sm btn--ghost">Okundu</button>
                  </form>`
                : "—"
            }
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="data-table__empty">${
        filter === "unread"
          ? "Okunmamış bakım uyarısı yok."
          : "Aktif bakım uyarısı bulunmuyor."
      }</td></tr>`;

  return `<div class="dash page-enter dash--dense maintenance-alerts-hub">
    <header class="maintenance-alerts-hub__header fade-in">
      <p class="maintenance-alerts-hub__eyebrow">Filo Bakım · Dahili Uyarı Merkezi</p>
      <h2 class="maintenance-alerts-hub__title">Bakım Uyarıları</h2>
      <p class="maintenance-alerts-hub__desc">Telegram, e-posta ve SMS yok — yalnızca FleetOS içi bakım uyarıları.</p>
      ${renderModuleTabs("maintenance", path)}
    </header>

    <div class="maintenance-alerts-hub__meta fade-in">
      <div class="maintenance-alerts-hub__counts">
        <span class="maintenance-alerts-hub__count">Okunmamış: <strong>${unreadCount}</strong></span>
        <span class="maintenance-alerts-hub__count">Toplam: <strong>${alerts.length}</strong></span>
      </div>
      <div class="maintenance-alerts-hub__filters">${filterLinks}</div>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bakım Uyarı Listesi</h2>
        <p class="panel__desc">Durum · Araç · Bakım türü · Mesaj · Tarih · Okuma durumu</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Durum</th><th>Araç</th><th>Bakım Türü</th><th>Mesaj</th><th>Oluşturulma</th><th>Okuma</th><th>İşlem</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  maintenanceAlertsPageHtml,
  FILTER_OPTIONS,
  SEVERITY_LABELS,
};
