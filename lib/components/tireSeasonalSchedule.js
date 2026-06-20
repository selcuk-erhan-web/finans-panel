const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const {
  STATUS_LABELS,
  PERIOD_LABELS,
} = require("../../services/tireSeasonalSchedulerService");
const { seasonLabel } = require("../../services/tireService");

function seasonalStatusBadge(status, label) {
  const cls = `tyr3-badge tyr3-badge--${escapeHtml(status || "unknown")}`;
  return `<span class="${cls}">${escapeHtml(label || STATUS_LABELS[status] || status)}</span>`;
}

function tireSeasonalSchedulePageHtml({ report, vehicles, filters, selectedVehiclePlate }) {
  const vehicleFilter = filters.vehicle_id || "";
  const filterActive = Boolean(vehicleFilter);
  const { summary, vehicles: rows } = report;

  const filterBanner = filterActive
    ? `<div class="tyr3-filter-banner fade-in">
        <span>Plan filtresi: <strong>${escapeHtml(selectedVehiclePlate || "Seçili araç")}</strong></span>
        <a href="/tire-seasonal-schedule" class="btn btn--ghost btn--sm">Tüm araçlar</a>
        <a href="/tires?vehicle_id=${escapeHtml(vehicleFilter)}" class="btn btn--ghost btn--sm">Lastik Merkezi →</a>
      </div>`
    : "";

  const summaryCards = `
    <div class="tyr3-kpi-row fade-in">
      <article class="tyr3-kpi tyr3-kpi--ready"><span>Hazır</span><strong>${Number(summary.ready).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr3-kpi tyr3-kpi--attention"><span>Dikkat</span><strong>${Number(summary.attention).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr3-kpi tyr3-kpi--mismatch"><span>Uyumsuz</span><strong>${Number(summary.mismatch).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr3-kpi tyr3-kpi--unknown"><span>Bilinmiyor</span><strong>${Number(summary.unknown).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr3-kpi"><span>Toplam Araç</span><strong>${Number(summary.total_vehicles).toLocaleString("tr-TR")}</strong></article>
    </div>`;

  const seasonBanner = `<div class="tyr3-season-banner fade-in">
    <div class="tyr3-season-banner__item"><span>Referans Tarih</span><strong>${formatDateDisplay(report.reference_date)}</strong></div>
    <div class="tyr3-season-banner__item"><span>Mevcut Dönem</span><strong>${escapeHtml(report.current_season_label || PERIOD_LABELS[report.current_season] || report.current_season)}</strong></div>
    <div class="tyr3-season-banner__item"><span>Gerekli Lastik Sezonu</span><strong>${escapeHtml(report.required_tire_season_label || "—")}</strong></div>
  </div>`;

  const emptyState = `<tr><td colspan="8" class="data-table__empty">
      Lastik sezon planı için veri bulunmuyor.
      <span class="data-table__empty-hint"><a href="/tires">Lastik Merkezi</a> üzerinden lastik kaydı ekleyin.</span>
    </td></tr>`;

  const tableRows = rows.length
    ? rows
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/tire-seasonal-schedule?vehicle_id=${row.vehicle_id}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(row.current_required_season_label || PERIOD_LABELS[row.current_required_season] || row.current_required_season)}</td>
          <td>${escapeHtml(row.current_tire_season_label || seasonLabel(row.current_tire_season) || "Bilinmiyor")}</td>
          <td>${seasonalStatusBadge(row.status, row.status_label)}</td>
          <td>${Number(row.on_vehicle_quantity).toLocaleString("tr-TR")}</td>
          <td>${Number(row.storage_quantity_for_required_season).toLocaleString("tr-TR")}</td>
          <td>${row.last_change_date ? formatDateDisplay(row.last_change_date) : "—"}</td>
          <td>${escapeHtml(row.message || "—")}</td>
        </tr>`
        )
        .join("")
    : emptyState;

  return `<div class="dash page-enter dash--dense tire-seasonal-hub">
    <header class="tire-seasonal-hub__header fade-in">
      <p class="tire-seasonal-hub__eyebrow">Filo Lastik</p>
      <div class="tire-hub__title-row">
        <h2 class="tire-seasonal-hub__title">Lastik Sezon Planı</h2>
        <a href="/tires${vehicleFilter ? `?vehicle_id=${vehicleFilter}` : ""}" class="btn btn--ghost btn--sm">Lastik Merkezi →</a>
      </div>
      <p class="tire-seasonal-hub__desc">Yazlık / kışlık lastik hazırlık durumu ve sezon uyumu</p>
    </header>

    ${filterBanner}
    ${summaryCards}
    ${seasonBanner}

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Araç Sezon Durumu</h2>
          <p class="panel__desc">${rows.length} araç · uyumsuz önce</p>
        </div>
        <form class="filters tyr3-filters" method="GET" action="/tire-seasonal-schedule">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <a href="/tire-seasonal-schedule" class="btn btn--ghost btn--sm">Temizle</a>
        </form>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Araç</th><th>Gereken Sezon</th><th>Araç Üzerindeki Lastik</th><th>Durum</th><th>Araç Üzerindeki Adet</th><th>Depoda Uygun Lastik</th><th>Son Değişim</th><th>Mesaj</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function tireSeasonalStatusSectionHtml(bundle) {
  const { vehicle, tireSeasonalStatus } = bundle;
  const row = tireSeasonalStatus;

  if (!row) {
    return `<section class="vc-section vc-section--compact" id="lastik-sezon-durumu">
      <header class="vc-section__head">
        <h2 class="vc-section__title">Lastik Sezon Durumu</h2>
        <a href="/tire-seasonal-schedule?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Sezon Planı →</a>
      </header>
      <div class="vc-section__body"><p class="vc-empty-note">Sezon durumu hesaplanamadı.</p></div>
    </section>`;
  }

  return `<section class="vc-section vc-section--compact" id="lastik-sezon-durumu">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Lastik Sezon Durumu</h2>
      <a href="/tire-seasonal-schedule?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Sezon Planı →</a>
    </header>
    <div class="vc-section__body">
      <div class="vc-tire-seasonal-preview">
        <div class="vc-tire-seasonal-preview__row"><span>Gereken Sezon</span><strong>${escapeHtml(row.current_required_season_label || PERIOD_LABELS[row.current_required_season] || "—")}</strong></div>
        <div class="vc-tire-seasonal-preview__row"><span>Araç Üzerindeki Lastik</span><strong>${escapeHtml(row.current_tire_season_label || seasonLabel(row.current_tire_season) || "Bilinmiyor")}</strong></div>
        <div class="vc-tire-seasonal-preview__row"><span>Durum</span>${seasonalStatusBadge(row.status, row.status_label)}</div>
        <p class="vc-tire-seasonal-preview__message">${escapeHtml(row.message || "—")}</p>
      </div>
    </div>
  </section>`;
}

module.exports = {
  tireSeasonalSchedulePageHtml,
  tireSeasonalStatusSectionHtml,
};
