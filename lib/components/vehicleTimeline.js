const { escapeHtml } = require("./escape");
const { formatPlateDisplay } = require("../../utils/plate");
const { formatDateDisplay } = require("../../utils/date");
const { money } = require("../finance");
const { renderModuleTabs } = require("./moduleTabs");

const SOURCE_LABELS = {
  compliance: "Uygunluk",
  maintenance: "Bakım",
  maintenance_alert: "Bakım Uyarısı",
  tire: "Lastik",
  tire_history: "Lastik Geçmişi",
  tire_alert: "Lastik Uyarısı",
  audit: "Denetim",
  finance: "Finans",
  system: "Sistem",
};

function severityBadge(severity) {
  const map = {
    success: ["Başarılı", "ok"],
    info: ["Bilgi", "info"],
    warning: ["Uyarı", "warn"],
    critical: ["Kritik", "crit"],
    neutral: ["Nötr", "muted"],
  };
  const [label, tone] = map[severity] || map.info;
  return `<span class="vt-badge vt-badge--${tone}">${escapeHtml(label)}</span>`;
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || "—";
}

function buildFilterQuery(filters, overrides = {}) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...overrides };
  Object.entries(merged).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function vehicleTimelinePageHtml({ fleet, timeline, vehicles, filters, path = "/vehicle-timeline" }) {
  const summary = fleet?.summary || {};
  const vehicleOptions = (vehicles || [])
    .map(
      (v) =>
        `<option value="${escapeHtml(v.id)}"${String(filters.vehicle_id) === String(v.id) ? " selected" : ""}>${escapeHtml(formatPlateDisplay(v.plate) || v.plate)}</option>`
    )
    .join("");

  const filterForm = `<form class="vt-filters" method="get" action="/vehicle-timeline">
    <label>
      <span>Araç</span>
      <select name="vehicle_id">
        <option value="">Tüm araçlar</option>
        ${vehicleOptions}
      </select>
    </label>
    <label>
      <span>Kaynak</span>
      <select name="source">
        <option value="">Tümü</option>
        ${Object.entries(SOURCE_LABELS)
          .map(
            ([value, label]) =>
              `<option value="${value}"${filters.source === value ? " selected" : ""}>${escapeHtml(label)}</option>`
          )
          .join("")}
      </select>
    </label>
    <label>
      <span>Önem</span>
      <select name="severity">
        <option value="">Tümü</option>
        <option value="critical"${filters.severity === "critical" ? " selected" : ""}>Kritik</option>
        <option value="warning"${filters.severity === "warning" ? " selected" : ""}>Uyarı</option>
        <option value="success"${filters.severity === "success" ? " selected" : ""}>Başarılı</option>
        <option value="info"${filters.severity === "info" ? " selected" : ""}>Bilgi</option>
        <option value="neutral"${filters.severity === "neutral" ? " selected" : ""}>Nötr</option>
      </select>
    </label>
    <label>
      <span>Başlangıç</span>
      <input type="date" name="date_from" value="${escapeHtml(filters.date_from || "")}">
    </label>
    <label>
      <span>Bitiş</span>
      <input type="date" name="date_to" value="${escapeHtml(filters.date_to || "")}">
    </label>
    <label>
      <span>Limit</span>
      <input type="number" name="limit" min="1" max="500" value="${escapeHtml(String(filters.limit || 100))}">
    </label>
    <button type="submit" class="btn btn--primary btn--sm">Filtrele</button>
  </form>`;

  const fleetRows = (fleet?.vehicles || []).length
    ? fleet.vehicles
        .map((row) => {
          const href = `/vehicle-timeline${buildFilterQuery(filters, { vehicle_id: row.vehicle_id })}`;
          return `<tr>
          <td><a class="plate-link" href="${href}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td>${Number(row.total_events || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.critical_events || 0).toLocaleString("tr-TR")}</td>
          <td>${Number(row.warning_events || 0).toLocaleString("tr-TR")}</td>
          <td>${formatDateDisplay(row.latest_event_date)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Araç operasyon geçmişi bulunmuyor.</td></tr>`;

  const timelineSection = timeline
    ? renderVehicleTimelineSection(timeline, filters)
    : `<section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Araç Özeti</h2>
          <p class="panel__desc">Detaylı zaman çizelgesi için bir araç seçin.</p>
        </header>
        <div class="panel__body">
          <div class="table-wrap">
            <table class="data-table data-table--compact vt-table">
              <thead>
                <tr>
                  <th>Araç</th>
                  <th>Toplam Olay</th>
                  <th>Kritik</th>
                  <th>Uyarı</th>
                  <th>Son Olay</th>
                </tr>
              </thead>
              <tbody>${fleetRows}</tbody>
            </table>
          </div>
        </div>
      </section>`;

  return `<div class="dash page-enter dash--dense vt-hub">
    <header class="vt-hub__header fade-in">
      <p class="vt-hub__eyebrow">Filo · Araç Operasyon Geçmişi</p>
      <h2 class="vt-hub__title">Araç Operasyon Geçmişi</h2>
      <p class="vt-hub__desc">Uygunluk, bakım, lastik, denetim ve finans kayıtlarının birleşik araç hafızası.</p>
      ${renderModuleTabs("vehicleIntelligence", path)}
    </header>

    <section class="vt-kpi-row fade-in">
      <article class="vt-kpi"><span>Olaylı Araç</span><strong>${Number(summary.vehicles_with_events || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vt-kpi"><span>Toplam Olay</span><strong>${Number(summary.total_events || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vt-kpi vt-kpi--crit"><span>Kritik Olay</span><strong>${Number(summary.critical_events || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="vt-kpi vt-kpi--warn"><span>Uyarı Olayı</span><strong>${Number(summary.warning_events || 0).toLocaleString("tr-TR")}</strong></article>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Filtreler</h2>
      </header>
      <div class="panel__body">${filterForm}</div>
    </section>

    ${timelineSection}
  </div>`;
}

function renderVehicleTimelineSection(timeline, filters) {
  const events = timeline.events || [];
  const eventCards = events.length
    ? events
        .map(
          (event) => `<article class="vt-event vt-event--${escapeHtml(event.severity || "info")}">
          <div class="vt-event__head">
            <time datetime="${escapeHtml(event.event_date || "")}">${formatDateDisplay(event.event_date)}${event.event_time ? ` · ${escapeHtml(event.event_time)}` : ""}</time>
            <div class="vt-event__badges">
              <span class="vt-source">${escapeHtml(sourceLabel(event.source))}</span>
              ${severityBadge(event.severity)}
            </div>
          </div>
          <h3 class="vt-event__title">${escapeHtml(event.title || "—")}</h3>
          <p class="vt-event__desc">${escapeHtml(event.description || "")}</p>
          <div class="vt-event__meta">
            ${event.amount != null ? `<span>${money(event.amount)}</span>` : ""}
            ${event.odometer_km != null ? `<span>${Number(event.odometer_km).toLocaleString("tr-TR")} km</span>` : ""}
          </div>
        </article>`
        )
        .join("")
    : `<p class="vt-empty">Bu araç için operasyon geçmişi bulunmuyor.</p>`;

  return `<section class="panel fade-in">
    <header class="panel__head">
      <h2 class="panel__title">${escapeHtml(formatPlateDisplay(timeline.plate) || timeline.plate || "Araç")} · Operasyon Geçmişi</h2>
      <p class="panel__desc">${Number(timeline.summary?.total_events || 0).toLocaleString("tr-TR")} olay · son olay ${formatDateDisplay(timeline.summary?.latest_event_date)}</p>
    </header>
    <div class="panel__body">
      <div class="vt-timeline">${eventCards}</div>
      <div class="table-wrap vt-table-wrap">
        <table class="data-table data-table--compact vt-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Kaynak</th>
              <th>Önem</th>
              <th>Başlık</th>
              <th>Açıklama</th>
              <th>Tutar</th>
              <th>KM</th>
            </tr>
          </thead>
          <tbody>
            ${
              events.length
                ? events
                    .map(
                      (event) => `<tr>
                <td>${formatDateDisplay(event.event_date)}</td>
                <td>${escapeHtml(sourceLabel(event.source))}</td>
                <td>${severityBadge(event.severity)}</td>
                <td>${escapeHtml(event.title || "—")}</td>
                <td>${escapeHtml(event.description || "")}</td>
                <td>${event.amount != null ? money(event.amount) : "—"}</td>
                <td>${event.odometer_km != null ? Number(event.odometer_km).toLocaleString("tr-TR") : "—"}</td>
              </tr>`
                    )
                    .join("")
                : `<tr><td colspan="7" class="data-table__empty">Bu araç için operasyon geçmişi bulunmuyor.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <p class="vt-back-link"><a href="/vehicle-timeline${buildFilterQuery(filters, { vehicle_id: "" })}" class="btn btn--ghost btn--sm">← Filo özetine dön</a></p>
    </div>
  </section>`;
}

function vehicleTimelinePreviewHtml(timeline) {
  if (!timeline) {
    return `<section class="panel fade-in vt-preview-panel">
      <header class="panel__head">
        <h2 class="panel__title">Operasyon Geçmişi</h2>
      </header>
      <div class="panel__body">
        <p class="vt-empty">Operasyon geçmişi üretilemedi.</p>
      </div>
    </section>`;
  }

  const events = (timeline.events || []).slice(0, 5);
  const link = `/vehicle-timeline?vehicle_id=${encodeURIComponent(timeline.vehicle_id)}`;

  const items = events.length
    ? events
        .map(
          (event) => `<li class="vt-preview-item vt-preview-item--${escapeHtml(event.severity || "info")}">
          <div class="vt-preview-item__head">
            <time>${formatDateDisplay(event.event_date)}</time>
            ${severityBadge(event.severity)}
          </div>
          <strong>${escapeHtml(event.title || "—")}</strong>
          <span>${escapeHtml(event.description || "")}</span>
          <div class="vt-preview-item__meta">
            ${event.amount != null ? `<em>${money(event.amount)}</em>` : ""}
            ${event.odometer_km != null ? `<em>${Number(event.odometer_km).toLocaleString("tr-TR")} km</em>` : ""}
          </div>
        </li>`
        )
        .join("")
    : `<li class="vt-empty">Bu araç için operasyon geçmişi bulunmuyor.</li>`;

  return `<section class="panel fade-in vt-preview-panel">
    <header class="panel__head">
      <h2 class="panel__title">Operasyon Geçmişi</h2>
      <a href="${link}" class="btn btn--ghost btn--sm">Tüm Geçmiş →</a>
    </header>
    <div class="panel__body">
      <ul class="vt-preview-list">${items}</ul>
    </div>
  </section>`;
}

module.exports = {
  vehicleTimelinePageHtml,
  vehicleTimelinePreviewHtml,
  severityBadge,
  sourceLabel,
};
