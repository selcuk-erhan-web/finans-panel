const { escapeHtml } = require("./escape");
const { renderModuleTabs } = require("./moduleTabs");

const FILTER_OPTIONS = [
  ["all", "Tümü"],
  ["unread", "Okunmamış"],
  ["warning", "Warning"],
  ["critical", "Critical"],
  ["expired", "Expired"],
];

const SEVERITY_LABELS = {
  warning: "Warning",
  critical: "Critical",
  expired: "Expired",
};

function formatCreatedAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("tr-TR");
}

function notificationsPageHtml({ notifications, unreadCount, filter = "all", path = "/notifications" }) {
  const filterLinks = FILTER_OPTIONS.map(
    ([key, label]) =>
      `<a href="/notifications?filter=${key}" class="btn btn--sm ${
        filter === key ? "btn--primary" : "btn--ghost"
      }">${escapeHtml(label)}</a>`
  ).join("");

  const rows = notifications.length
    ? notifications
        .map(
          (n) => `<tr class="notification-row notification-row--${escapeHtml(n.severity)} ${
            n.status === "unread" ? "notification-row--unread" : ""
          }">
          <td><span class="pill pill--${n.severity === "expired" || n.severity === "critical" ? "red" : "amber"}">${escapeHtml(SEVERITY_LABELS[n.severity] || n.severity)}</span></td>
          <td>${escapeHtml(n.plate || "—")}</td>
          <td>${escapeHtml(documentServiceLabel(n.document_type))}</td>
          <td>${escapeHtml(n.message || "—")}</td>
          <td>${escapeHtml(formatCreatedAt(n.created_at))}</td>
          <td>${n.status === "unread" ? "Okunmadı" : "Okundu"}</td>
          <td class="data-table__actions">
            ${
              n.status === "unread"
                ? `<form method="POST" action="/api/notifications/${escapeHtml(n.id)}/read" class="notification-read-form">
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
          ? "Okunmamış uygunluk bildirimi yok."
          : "Uygunluk bildirimi bulunmuyor."
      }</td></tr>`;

  return `<div class="dash page-enter dash--dense notifications-hub">
    <header class="notifications-hub__header fade-in">
      <p class="notifications-hub__eyebrow">Filo Uygunluk · Dahili Bildirim Merkezi</p>
      <h2 class="notifications-hub__title">Compliance Notifications</h2>
      <p class="notifications-hub__desc">Telegram, e-posta ve SMS yok — yalnızca FleetOS içi uygunluk bildirimleri.</p>
      ${renderModuleTabs("compliance", path)}
    </header>

    <div class="notifications-hub__meta fade-in">
      <div class="notifications-hub__counts">
        <span class="notifications-hub__count">Okunmamış: <strong>${unreadCount}</strong></span>
        <span class="notifications-hub__count">Toplam: <strong>${notifications.length}</strong></span>
      </div>
      <div class="notifications-hub__filters">${filterLinks}</div>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bildirimler</h2>
        <p class="panel__desc">Severity · Araç · Belge · Mesaj · Tarih · Durum</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Severity</th><th>Araç</th><th>Belge</th><th>Mesaj</th><th>Oluşturulma</th><th>Durum</th><th>İşlem</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function documentServiceLabel(documentType) {
  try {
    const documentService = require("../../services/documentService");
    return documentService.typeLabel(documentType);
  } catch {
    return documentType || "—";
  }
}

module.exports = {
  notificationsPageHtml,
  FILTER_OPTIONS,
};
