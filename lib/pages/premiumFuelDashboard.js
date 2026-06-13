/**
 * Premium Yakıt Dashboard — tek render kaynağı (legacy template yok)
 * @see routes/fuel.js
 */
const { money } = require("../finance");
const {
  glassPanel,
  vehicleOptions,
  escapeHtml,
  dataTable,
  metricCard,
  metricGrid,
  buildQueryString,
} = require("../components");

const FUEL_LAYOUT_VERSION = "premium-fuel-v5";

function renderFuelImportCard() {
  return `<!-- ${FUEL_LAYOUT_VERSION} :: EXCEL_IMPORT -->
<section class="panel panel--glass fuel-import-panel" id="fuelExcelImportCard" data-fuel-import-card>
  <header class="panel__head">
    <div>
      <h2 class="panel__title">Excel İçe Aktar</h2>
      <p class="panel__desc">Yakıt Excel içe aktarma</p>
    </div>
    <span class="fuel-import-panel__badge">UTTS</span>
  </header>
  <div class="panel__body">
    <form id="fuelImportForm" class="fuel-import-form" data-fake-upload="1" novalidate>
      <div class="fuel-drop" id="fuelDropZone" role="button" tabindex="0" aria-label="Excel yükle">
        <input type="file" name="file" id="fuelFileInput" accept=".xlsx,.xls" />
        <div class="fuel-drop__visual">
          <div class="fuel-drop__icon-wrap" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4"/>
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
            </svg>
          </div>
          <span class="fuel-drop__text" id="fuelDropLabel">Excel dosyasını sürükle</span>
          <span class="fuel-drop__hint">.xlsx · .xls · max 20 MB</span>
        </div>
      </div>
      <div class="fuel-import-progress" id="fuelImportProgress" hidden>
        <div class="fuel-import-progress__bar"><div class="fuel-import-progress__fill" id="fuelProgressFill"></div></div>
        <span class="fuel-import-progress__label" id="fuelProgressLabel">Yükleniyor…</span>
      </div>
      <p class="fuel-import-formats">
        <span class="fuel-import-formats__label">Desteklenen format:</span>
        Arkpet / UTTS / Shell
      </p>
      <div class="fuel-import-btn-row">
        <button type="button" class="btn btn--ghost btn--lg" id="fuelPickBtn">Excel seç</button>
        <button type="button" class="btn btn--primary btn--lg" id="fuelImportBtn" disabled>İçe aktar</button>
      </div>
    </form>
  </div>
</section>`;
}

/**
 * @param {object} ctx
 * @param {Array} ctx.vehicles
 * @param {object} ctx.query
 * @param {Array} ctx.rows
 * @param {object} ctx.analytics
 * @param {string} ctx.exportCsvUrl
 * @param {string} ctx.exportXlsxUrl
 */
function premiumFuelPage(ctx) {
  const { vehicles, query, rows, analytics, exportCsvUrl, exportXlsxUrl } = ctx;

  const tableRows = rows.map((f) => {
    const cons = f.km_per_liter != null ? `${f.km_per_liter} km/L` : "—";
    const ckm = f.cost_per_km != null ? `${f.cost_per_km} TL/km` : "—";
    const plate = f.display_plate || f.plate || f.plate_text || "—";
    const plateCell = f.vehicle_id
      ? `<a class="plate-link" href="/vehicle/${f.vehicle_id}">${escapeHtml(plate)}</a>`
      : `<span class="plate-unmatched">${escapeHtml(plate)}</span> <span class="badge badge--warn">Eşleşmedi</span>`;
    const src = f.source_file
      ? `<span class="fuel-src" title="${escapeHtml(f.source_file)}">Excel</span>`
      : "Manuel";
    return `<tr>
      <td>${plateCell}</td>
      <td>${escapeHtml(f.fuel_type || "—")}</td>
      <td>${Number(f.liter).toLocaleString("tr-TR")} L</td>
      <td>${f.price_per_liter ? Number(f.price_per_liter).toLocaleString("tr-TR") + " ₺" : "—"}</td>
      <td class="text-neg"><strong>${money(f.total_amount)}</strong></td>
      <td>${f.km != null ? Number(f.km).toLocaleString("tr-TR") : "—"}</td>
      <td>${escapeHtml(f.station || "—")}</td>
      <td>${cons}${ckm !== "—" ? " · " + ckm : ""}</td>
      <td>${escapeHtml(f.fuel_date || "")}</td>
      <td>${src}</td>
      <td class="data-table__actions">
        <a href="/fuel/edit/${f.id}" class="btn btn--sm btn--ghost">Düzenle</a>
        <a href="/fuel/delete/${f.id}" class="btn btn--sm btn--danger" onclick="return confirm('Yakıt kaydı silinsin mi?')">Sil</a>
      </td>
    </tr>`;
  });

  const vehicleBreakdown = analytics.byVehicle
    .map(
      (v) =>
        `<div class="fuel-rank-row">
          <span class="fuel-rank-row__plate">${escapeHtml(v.plate)}</span>
          <span class="fuel-rank-row__meta">${Number(v.liters).toLocaleString("tr-TR")} L</span>
          <strong class="fuel-rank-row__total text-neg">${money(v.total)}</strong>
        </div>`
    )
    .join("");

  const filtersForm = `<form class="filters filters--fuel" method="GET" action="/fuel">
    <select name="vehicle_id">
      <option value="">Tüm araçlar</option>
      ${vehicles
        .map(
          (v) =>
            `<option value="${v.id}" ${String(query.vehicle_id) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
        )
        .join("")}
    </select>
    <input type="date" name="date_from" value="${escapeHtml(query.date_from)}" />
    <input type="date" name="date_to" value="${escapeHtml(query.date_to)}" />
    <label class="filter-check"><input type="checkbox" name="unmatched" value="1" ${query.unmatched === "1" ? "checked" : ""}/> Eşleşmeyen</label>
    <button type="submit" class="btn btn--primary btn--sm">Filtrele</button>
    <a href="/fuel" class="btn btn--ghost btn--sm">Temizle</a>
  </form>`;

  const analyticsBlock = metricGrid(
    [
      metricCard({
        label: "Son 30 gün tutar",
        value: money(analytics.last30.totalCost),
        hint: `${analytics.last30.count} kayıt`,
        tone: "loss",
        icon: "⛽",
      }),
      metricCard({
        label: "Son 30 gün litre",
        value: `${analytics.last30.totalLiters.toLocaleString("tr-TR")} L`,
        tone: "neutral",
        icon: "📊",
      }),
      metricCard({
        label: "Ort. litre fiyatı",
        value: analytics.avgPrice ? `${analytics.avgPrice} ₺/L` : "—",
        tone: "neutral",
        icon: "💧",
      }),
      metricCard({
        label: "En çok yakıt alan",
        value: analytics.top ? escapeHtml(analytics.top.plate) : "—",
        hint: analytics.top ? money(analytics.top.total) : "",
        tone: "warn",
        icon: "🏆",
      }),
    ],
    "4"
  );

  const today = new Date().toISOString().slice(0, 10);

  return `
<div class="dash page-enter fuel-dashboard" data-fuel-layout="${FUEL_LAYOUT_VERSION}" id="fuel-dashboard-root">
  <div class="fuel-dashboard__hero fade-in">
    <div class="fuel-dashboard__hero-text">
      <span class="fuel-dashboard__eyebrow">Operasyon · Yakıt</span>
      <h2 class="fuel-dashboard__title">Yakıt Yönetimi</h2>
      <p class="fuel-dashboard__sub">${rows.length} kayıt · Excel içe aktarma · filo takibi</p>
    </div>
    <div class="fuel-dashboard__hero-badge">Premium</div>
  </div>

  <div class="fuel-top-grid fuel-top-grid--premium" id="fuel-import-section">
    <div class="fuel-top-grid__item fuel-top-grid__item--import">
      ${renderFuelImportCard()}
    </div>
    <div class="fuel-top-grid__item">
      ${glassPanel({
        title: "Yakıt Ekle",
        className: "panel--glass fuel-panel-add",
        body: `<form method="POST" action="/fuel/add" class="form-grid" id="fuelForm">
          <select name="vehicle_id" required>${vehicleOptions(vehicles, query.vehicle_id)}</select>
          <input name="liter" type="number" step="0.01" min="0.1" placeholder="Litre" required />
          <input name="price_per_liter" type="number" step="0.01" min="0" placeholder="₺/Litre" id="fuelPrice"/>
          <input name="total_amount" type="number" min="1" placeholder="Toplam TL" id="fuelTotal"/>
          <input name="km" type="number" min="0" placeholder="KM"/>
          <input name="station" placeholder="İstasyon"/>
          <input type="date" name="fuel_date" value="${today}" required/>
          <input class="full" name="note" placeholder="Not"/>
          <button type="submit" class="btn btn--primary full">Kaydet</button>
        </form>`,
      })}
    </div>
    <div class="fuel-top-grid__item">
      ${glassPanel({
        title: "Filtre",
        className: "panel--glass fuel-panel-filter",
        body: `${filtersForm}
        <div class="fuel-export-actions">
          <a href="${exportCsvUrl}" class="btn btn--ghost btn--sm">CSV indir</a>
          <a href="${exportXlsxUrl}" class="btn btn--ghost btn--sm">Excel indir</a>
        </div>`,
      })}
    </div>
  </div>

  ${analyticsBlock}

  ${glassPanel({
    title: "Son 30 gün — araç bazlı",
    className: "panel--glass",
    body: vehicleBreakdown || `<div class="empty empty--sm"><p>Veri yok</p></div>`,
  })}

  <div id="fuel-records">
    ${glassPanel({
      title: "Yakıt kayıtları",
      className: "panel--glass",
      action: analytics.unmatchedCount
        ? `<a href="/fuel?unmatched=1" class="btn btn--ghost btn--sm">${analytics.unmatchedCount} eşleşmeyen</a>`
        : "",
      body: dataTable(
        ["Araç", "Tip", "Litre", "₺/L", "Toplam", "KM", "İstasyon", "Tüketim", "Tarih", "Kaynak", ""],
        tableRows,
        { text: "Henüz yakıt kaydı yok. Excel yükleyin veya manuel ekleyin." }
      ),
    })}
  </div>
</div>
<script src="/js/fuel-import.js?v=${FUEL_LAYOUT_VERSION}"></script>
<script>
(function(){
  var L=document.querySelector('#fuelForm [name=liter]');
  var P=document.getElementById('fuelPrice');
  var T=document.getElementById('fuelTotal');
  function calc(){ if(L&&P&&T&&L.value&&P.value) T.value=Math.round(Number(L.value)*Number(P.value)); }
  L&&L.addEventListener('input',calc); P&&P.addEventListener('input',calc);
})();
</script>`;
}

module.exports = {
  premiumFuelPage,
  FUEL_LAYOUT_VERSION,
  renderFuelImportCard,
};
