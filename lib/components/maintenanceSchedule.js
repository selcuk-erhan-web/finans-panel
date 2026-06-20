const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { STATUS_LABELS } = require("../../services/maintenanceSchedulerService");
const { typeLabel } = require("../../services/maintenanceService");

function scheduleStatusBadge(status) {
  const map = {
    ok: "pill pill--green",
    upcoming: "pill pill--amber",
    due: "pill pill--blue",
    overdue: "pill pill--red",
    unknown: "pill pill--muted",
  };
  const cls = map[status] || map.unknown;
  const label = STATUS_LABELS[status] || status;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function formatInterval(value) {
  return value != null ? Number(value).toLocaleString("tr-TR") : "—";
}

function formatRemainingKm(value) {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("tr-TR")} km`;
}

function formatRemainingDays(value) {
  if (value == null) return "—";
  if (value < 0) return `${Math.abs(Number(value)).toLocaleString("tr-TR")} gün geçti`;
  if (value === 0) return "Bugün";
  return `${Number(value).toLocaleString("tr-TR")} gün`;
}

function maintenanceSchedulePageHtml({ summary = {}, schedules = [], vehicles = [], filters = {}, selectedVehiclePlate = "" }) {
  const safeSummary = {
    ok: Number(summary.ok || 0),
    upcoming: Number(summary.upcoming || 0),
    due: Number(summary.due || 0),
    overdue: Number(summary.overdue || 0),
    unknown: Number(summary.unknown || 0),
    total: Number(summary.total || 0),
  };
  const vehicleFilter = filters.vehicle_id || "";
  const filterActive = Boolean(vehicleFilter);

  const filterBanner = filterActive
    ? `<div class="mnt-filter-banner fade-in">
        <span>Plan filtresi: <strong>${escapeHtml(selectedVehiclePlate || "Seçili araç")}</strong></span>
        <a href="/maintenance-schedule" class="btn btn--ghost btn--sm">Tüm araçlar</a>
        <a href="/maintenance?vehicle_id=${escapeHtml(vehicleFilter)}" class="btn btn--ghost btn--sm">Bakım Geçmişi →</a>
      </div>`
    : "";

  const summaryCards = `
    <div class="mnt-schedule-kpi-row fade-in">
      <article class="mnt-schedule-kpi mnt-schedule-kpi--ok"><span>OK</span><strong>${safeSummary.ok.toLocaleString("tr-TR")}</strong></article>
      <article class="mnt-schedule-kpi mnt-schedule-kpi--upcoming"><span>Yaklaşıyor</span><strong>${safeSummary.upcoming.toLocaleString("tr-TR")}</strong></article>
      <article class="mnt-schedule-kpi mnt-schedule-kpi--due"><span>Günü Geldi</span><strong>${safeSummary.due.toLocaleString("tr-TR")}</strong></article>
      <article class="mnt-schedule-kpi mnt-schedule-kpi--overdue"><span>Gecikti</span><strong>${safeSummary.overdue.toLocaleString("tr-TR")}</strong></article>
      <article class="mnt-schedule-kpi mnt-schedule-kpi--unknown"><span>Bilinmiyor</span><strong>${safeSummary.unknown.toLocaleString("tr-TR")}</strong></article>
    </div>`;

  const emptyState = `<tr><td colspan="11" class="data-table__empty">
      Bakım planı oluşturmak için önce bakım kaydı ekleyin.
      <span class="data-table__empty-hint"><a href="/maintenance">Bakım Merkezi</a> üzerinden ilk kaydı oluşturun.</span>
    </td></tr>`;

  const tableRows = schedules.length
    ? schedules
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/maintenance-schedule?vehicle_id=${row.vehicle_id}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(row.maintenance_type_label || typeLabel(row.maintenance_type))}</td>
          <td>${formatDateDisplay(row.last_maintenance_date)}</td>
          <td>${row.last_odometer_km != null ? Number(row.last_odometer_km).toLocaleString("tr-TR") : "—"}</td>
          <td>${formatInterval(row.interval_km)}</td>
          <td>${formatInterval(row.interval_days)}</td>
          <td>${row.next_due_km != null ? Number(row.next_due_km).toLocaleString("tr-TR") : "—"}</td>
          <td>${formatDateDisplay(row.next_due_date)}</td>
          <td>${formatRemainingKm(row.remaining_km)}</td>
          <td>${formatRemainingDays(row.days_remaining)}</td>
          <td>${scheduleStatusBadge(row.status)}</td>
        </tr>`
        )
        .join("")
    : emptyState;

  return `<div class="dash page-enter dash--dense maintenance-schedule-hub">
    <header class="maintenance-hub__header fade-in">
      <p class="maintenance-hub__eyebrow">Filo Bakım</p>
      <h2 class="maintenance-hub__title">Bakım Planı</h2>
      <p class="maintenance-hub__desc">${filterActive ? `${escapeHtml(selectedVehiclePlate || "Seçili araç")} bakım planı` : "KM ve tarih bazlı bakım planlama"}</p>
    </header>

    ${filterBanner}
    ${summaryCards}

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Bakım Plan Tablosu</h2>
          <p class="panel__desc">${safeSummary.total} plan satırı · en kritik önce</p>
        </div>
        <form class="filters" method="GET" action="/maintenance-schedule">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <a href="/maintenance-schedule" class="btn btn--ghost btn--sm">Temizle</a>
          <a href="/maintenance" class="btn btn--ghost btn--sm">Bakım Merkezi</a>
        </form>
      </header>
      <div class="panel__body table-wrap mnt-schedule-table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Araç</th><th>Bakım Türü</th><th>Son Bakım</th><th>Son KM</th><th>Periyot KM</th><th>Periyot Gün</th><th>Sonraki KM</th><th>Sonraki Tarih</th><th>Kalan KM</th><th>Kalan Gün</th><th>Durum</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function vehicleSchedulePreviewHtml({ vehicle, schedulePreview }) {
  const { items } = schedulePreview;

  if (!items.length) {
    return `<section class="vc-schedule-preview panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bakım Planı</h2>
        <a href="/maintenance-schedule?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Plan →</a>
      </header>
      <div class="panel__body">
        <p class="vc-schedule-preview__empty">Bu araç için plan oluşturmak üzere bakım kaydı gerekir.</p>
      </div>
    </section>`;
  }

  const rows = items
    .map(
      (row) => `<li class="vc-schedule-preview__item vc-schedule-preview__item--${escapeHtml(row.status)}">
        <div class="vc-schedule-preview__main">
          <strong>${escapeHtml(row.maintenance_type_label || typeLabel(row.maintenance_type))}</strong>
          <span>${row.next_due_date ? formatDateDisplay(row.next_due_date) : row.next_due_km != null ? `${Number(row.next_due_km).toLocaleString("tr-TR")} km` : "Periyot yok"}</span>
        </div>
        ${scheduleStatusBadge(row.status)}
      </li>`
    )
    .join("");

  return `<section class="vc-schedule-preview panel fade-in">
    <header class="panel__head">
      <h2 class="panel__title">Bakım Planı</h2>
      <a href="/maintenance-schedule?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Tüm plan →</a>
    </header>
    <div class="panel__body">
      <ul class="vc-schedule-preview__list">${rows}</ul>
    </div>
  </section>`;
}

module.exports = {
  maintenanceSchedulePageHtml,
  vehicleSchedulePreviewHtml,
  scheduleStatusBadge,
};
