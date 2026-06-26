const { escapeHtml } = require("./escape");
const { renderModuleTabs } = require("./moduleTabs");
const { SEVERITY_LABELS, READ_STATUS_LABELS } = require("../../services/tireAlertService");

const FILTER_OPTIONS = [
  ["all", "Tümü"],
  ["unread", "Okunmamış"],
  ["attention", "Dikkat"],
  ["mismatch", "Uyumsuz"],
  ["unknown", "Bilinmiyor"],
];

function severityPill(severity) {
  const map = {
    mismatch: "pill pill--red tyr4-pill--mismatch",
    attention: "pill pill--amber tyr4-pill--attention",
    unknown: "pill pill--muted tyr4-pill--unknown",
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

function tireAlertsPageHtml({ alerts, unreadCount, filter = "all", path = "/tire-alerts" }) {
  const filterLinks = FILTER_OPTIONS.map(
    ([key, label]) =>
      `<a href="/tire-alerts?filter=${key}" class="btn btn--sm ${
        filter === key ? "btn--primary" : "btn--ghost"
      }">${escapeHtml(label)}</a>`
  ).join("");

  const rows = alerts.length
    ? alerts
        .map(
          (alert) => `<tr class="tyr4-alert-row tyr4-alert-row--${escapeHtml(alert.severity)} ${
            alert.status === "unread" ? "tyr4-alert-row--unread" : ""
          }">
          <td>${severityPill(alert.severity)}</td>
          <td><a class="plate-link" href="/vehicle/${alert.vehicle_id}">${escapeHtml(alert.plate || "—")}</a></td>
          <td>${escapeHtml(alert.current_season_label || alert.current_season || "—")}</td>
          <td>${escapeHtml(alert.required_tire_season_label || alert.required_tire_season || "—")}</td>
          <td>${escapeHtml(alert.current_tire_season_label || alert.current_tire_season || "—")}</td>
          <td>${escapeHtml(alert.message || "—")}</td>
          <td>${escapeHtml(formatCreatedAt(alert.created_at))}</td>
          <td>${escapeHtml(READ_STATUS_LABELS[alert.status] || alert.status)}</td>
          <td class="data-table__actions">
            ${
              alert.status === "unread"
                ? `<form method="POST" action="/api/tire-alerts/${escapeHtml(alert.id)}/read" class="tyr4-alert-read-form">
                    <button type="submit" class="btn btn--sm btn--ghost">Okundu</button>
                  </form>`
                : "—"
            }
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="data-table__empty">${
        filter === "unread" ? "Okunmamış lastik uyarısı yok." : "Aktif lastik uyarısı bulunmuyor."
      }</td></tr>`;

  return `<div class="dash page-enter dash--dense tire-alerts-hub">
    <header class="tire-alerts-hub__header fade-in">
      <p class="tire-alerts-hub__eyebrow">Filo Lastik · Dahili Uyarı Merkezi</p>
      <h2 class="tire-alerts-hub__title">Lastik Uyarıları</h2>
      <p class="tire-alerts-hub__desc">Telegram, e-posta ve SMS yok — yalnızca FleetOS içi lastik sezon uyarıları.</p>
      ${renderModuleTabs("tire", path)}
    </header>

    <div class="tire-alerts-hub__meta fade-in">
      <div class="tire-alerts-hub__counts">
        <span class="tire-alerts-hub__count">Okunmamış: <strong>${unreadCount}</strong></span>
        <span class="tire-alerts-hub__count">Toplam: <strong>${alerts.length}</strong></span>
      </div>
      <div class="tire-alerts-hub__filters">${filterLinks}</div>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Lastik Uyarı Listesi</h2>
        <p class="panel__desc">Durum · Araç · Sezon · Mesaj · Tarih · Okuma durumu</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Durum</th><th>Araç</th><th>Mevcut Dönem</th><th>Gereken Sezon</th><th>Araç Lastiği</th><th>Mesaj</th><th>Oluşturulma</th><th>Okuma</th><th>İşlem</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  tireAlertsPageHtml,
  FILTER_OPTIONS,
  SEVERITY_LABELS,
};
