const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { formatMoneyInputValue, moneyInputHtml } = require("../../utils/money");
const { money } = require("../finance");
const { TIRE_SEASONS, TIRE_POSITIONS, TIRE_CHANGE_TYPES } = require("../constants");
const { seasonLabel, positionLabel } = require("../../services/tireService");
const { changeTypeLabel } = require("../../services/tireHistoryService");
const { entityAuditHistoryLink } = require("./auditLogs");
const { renderModuleTabs } = require("./moduleTabs");

function optionList(items, selected = "", emptyLabel = "") {
  const empty = emptyLabel ? `<option value="">${escapeHtml(emptyLabel)}</option>` : "";
  return (
    empty +
    items
      .map(
        ([value, label]) =>
          `<option value="${value}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`
      )
      .join("")
  );
}

function changeTypeBadge(changeType, label) {
  const cls = `tyr2-badge tyr2-badge--${escapeHtml(changeType || "other")}`;
  return `<span class="${cls}">${escapeHtml(label || changeTypeLabel(changeType))}</span>`;
}

function tireLabel(tire) {
  const parts = [tire.plate, tire.season_label || seasonLabel(tire.season), tire.brand, tire.model]
    .filter(Boolean)
    .join(" · ");
  return parts || `Kayıt #${tire.id}`;
}

function tireHistoryPageHtml({
  summary,
  rows,
  vehicles,
  tires,
  filters,
  editRecord,
  selectedVehiclePlate,
  path = "/tire-history",
}) {
  const vehicleFilter = filters.vehicle_id || "";
  const changeTypeFilter = filters.change_type || "";
  const seasonFilter = filters.season || "";
  const dateFrom = filters.date_from || "";
  const dateTo = filters.date_to || "";
  const selectedVehicle = editRecord ? String(editRecord.vehicle_id) : vehicleFilter;
  const filterActive = Boolean(vehicleFilter || changeTypeFilter || seasonFilter || dateFrom || dateTo);
  const costValue =
    editRecord?.cost != null && editRecord.cost > 0 ? formatMoneyInputValue(editRecord.cost) : "";

  const filterBanner = filterActive
    ? `<div class="tyr2-filter-banner fade-in">
        <span>Filtre aktif · ${rows.length} kayıt</span>
        ${vehicleFilter ? `<span>Araç: <strong>${escapeHtml(selectedVehiclePlate || "Seçili")}</strong></span>` : ""}
        ${changeTypeFilter ? `<span>İşlem: <strong>${escapeHtml(changeTypeLabel(changeTypeFilter))}</strong></span>` : ""}
        ${seasonFilter ? `<span>Sezon: <strong>${escapeHtml(seasonLabel(seasonFilter))}</strong></span>` : ""}
        ${dateFrom || dateTo ? `<span>Tarih: <strong>${escapeHtml(dateFrom || "…")} – ${escapeHtml(dateTo || "…")}</strong></span>` : ""}
        <a href="/tire-history" class="btn btn--ghost btn--sm">Temizle</a>
        ${vehicleFilter ? `<a href="/vehicle/${escapeHtml(vehicleFilter)}" class="btn btn--ghost btn--sm">Araç Merkezi →</a>` : ""}
      </div>`
    : "";

  const summaryCards = `
    <div class="tyr2-kpi-row fade-in">
      <article class="tyr2-kpi"><span>Toplam İşlem</span><strong>${Number(summary.total_records).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--qty"><span>Toplam Adet</span><strong>${Number(summary.total_quantity).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--cost"><span>Toplam Maliyet</span><strong>${money(summary.total_cost)}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--installed"><span>Takıldı</span><strong>${Number(summary.installed).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--removed"><span>Söküldü</span><strong>${Number(summary.removed).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--swap"><span>Sezon Değişimi</span><strong>${Number(summary.seasonal_swap).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--storage"><span>Depoya Alındı</span><strong>${Number(summary.storage_move).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr2-kpi tyr2-kpi--disposed"><span>Hurdaya Ayrıldı</span><strong>${Number(summary.disposed).toLocaleString("tr-TR")}</strong></article>
    </div>`;

  const emptyState = `<tr><td colspan="11" class="data-table__empty">
      Lastik değişim kaydı bulunmuyor.
      ${filterActive ? `<span class="data-table__empty-hint">Filtreleri temizleyin veya yeni kayıt ekleyin.</span>` : `<span class="data-table__empty-hint">İlk değişim kaydını oluşturmak için formu kullanın.</span>`}
    </td></tr>`;

  const tableRows = rows.length
    ? rows
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/tire-history?vehicle_id=${row.vehicle_id}" title="Bu aracın lastik geçmişi">${escapeHtml(row.plate || "—")}</a></td>
          <td>${changeTypeBadge(row.change_type, row.change_type_label)}</td>
          <td>${formatDateDisplay(row.change_date)}</td>
          <td>${row.odometer_km != null ? Number(row.odometer_km).toLocaleString("tr-TR") : "—"}</td>
          <td>${row.season_label ? escapeHtml(row.season_label) : "—"}</td>
          <td>${escapeHtml(row.position_label || positionLabel(row.position))}</td>
          <td>${Number(row.quantity).toLocaleString("tr-TR")}</td>
          <td>${row.cost ? money(row.cost) : "—"}</td>
          <td>${escapeHtml(row.vendor || "—")}</td>
          <td>${escapeHtml(row.notes || "—")}</td>
          <td class="data-table__actions">
            <a href="/tire-history/edit/${row.id}" class="btn btn--sm btn--ghost">Düzenle</a>
            <a href="/tire-history/delete/${row.id}" class="btn btn--sm btn--danger" onclick="return confirm('Lastik değişim kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : emptyState;

  const formTitle = editRecord ? "Değişim kaydı düzenle" : "Lastik Değişim Kaydı";
  const formAction = editRecord ? `/tire-history/edit/${editRecord.id}` : "/tire-history/add";

  const tireOptions = tires.length
    ? tires
        .map(
          (t) =>
            `<option value="${t.id}" ${String(editRecord?.tire_id || "") === String(t.id) ? "selected" : ""}>${escapeHtml(tireLabel(t))}</option>`
        )
        .join("")
    : "";

  const formPanel = `<section class="panel fade-in tire-history-form-panel">
    <header class="panel__head">
      <h2 class="panel__title">${escapeHtml(formTitle)}</h2>
      ${
        editRecord
          ? entityAuditHistoryLink({
              module: "tire",
              entity_type: "tire_change_record",
              entity_id: editRecord.id,
            })
          : ""
      }
    </header>
    <div class="panel__body">
      <form method="POST" action="${formAction}" class="form-grid tire-history-form">
        <label class="field-label">Araç</label>
        <select name="vehicle_id" required>
          <option value="">Araç seçin</option>
          ${vehicles
            .map(
              (v) =>
                `<option value="${v.id}" ${String(selectedVehicle) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
            )
            .join("")}
        </select>

        <label class="field-label">Lastik Kaydı</label>
        <select name="tire_id">
          <option value="">Bağlı lastik yok</option>
          ${tireOptions}
        </select>

        <label class="field-label">İşlem Türü</label>
        <select name="change_type" required>${optionList(TIRE_CHANGE_TYPES, editRecord?.change_type || "installed")}</select>

        <label class="field-label">Tarih</label>
        <input type="date" name="change_date" required value="${escapeHtml(editRecord?.change_date || "")}"/>

        <label class="field-label">KM</label>
        <input type="number" name="odometer_km" min="0" step="1" placeholder="Kilometre" value="${editRecord?.odometer_km ?? ""}"/>

        <label class="field-label">Sezon</label>
        <select name="season">${optionList(TIRE_SEASONS, editRecord?.season || "", "Sezon yok")}</select>

        <label class="field-label">Pozisyon</label>
        <select name="position">${optionList(TIRE_POSITIONS, editRecord?.position || "full_set")}</select>

        <label class="field-label">Adet</label>
        <input type="number" name="quantity" min="1" step="1" required value="${editRecord?.quantity ?? 4}"/>

        <label class="field-label">Maliyet</label>
        ${moneyInputHtml("cost", {
          value: costValue,
          required: false,
          placeholder: "Maliyet (örn. 3.500,00)",
          className: "money-input",
        })}

        <label class="field-label">Servis / Tedarikçi</label>
        <input name="vendor" placeholder="Servis veya tedarikçi" value="${escapeHtml(editRecord?.vendor || "")}"/>

        <label class="field-label full">Notlar</label>
        <input class="full" name="notes" placeholder="Ek notlar" value="${escapeHtml(editRecord?.notes || "")}"/>

        <div class="form-actions full">
          <button type="submit" class="btn btn--primary">${editRecord ? "Güncelle" : "Kaydet"}</button>
          ${editRecord ? `<a href="/tire-history" class="btn btn--ghost">İptal</a>` : ""}
        </div>
      </form>
    </div>
  </section>`;

  const historyLink = vehicleFilter
    ? `/tire-history?vehicle_id=${vehicleFilter}`
    : "/tire-history";

  return `<div class="dash page-enter dash--dense tire-history-hub">
    <header class="tire-history-hub__header fade-in">
      <p class="tire-history-hub__eyebrow">Filo Lastik</p>
      <div class="tire-history-hub__title-row">
        <h2 class="tire-history-hub__title">Lastik Değişim Geçmişi</h2>
      </div>
      <p class="tire-history-hub__desc">${filterActive ? "Filtrelenmiş lastik hareketleri" : "Takma, sökme, sezon değişimi ve depo hareketleri"}</p>
      ${renderModuleTabs("tire", path)}
    </header>

    ${filterBanner}
    ${summaryCards}

    <div class="grid2 tire-history-hub__entry-grid">
      ${formPanel}
      <section class="panel fade-in tire-history-info-panel">
        <header class="panel__head">
          <h2 class="panel__title">Değişim Geçmişi</h2>
          <p class="panel__desc">Lastik montaj, demontaj ve sezon değişimlerini kaydedin.</p>
        </header>
        <div class="panel__body">
          <ul class="tire-history-info-list">
            <li>Takıldı, söküldü, sezon değişimi ve depo hareketleri</li>
            <li>KM, maliyet ve tedarikçi bilgisi ile işlem geçmişi</li>
            <li>Araç ve tarih aralığı filtreleme</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Lastik Değişim Kayıtları</h2>
          <p class="panel__desc">${rows.length} kayıt · en yeni önce</p>
        </div>
        <form class="filters tyr2-filters" method="GET" action="/tire-history">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <select name="change_type" onchange="this.form.submit()">
            <option value="">Tüm işlemler</option>
            ${TIRE_CHANGE_TYPES.map(
              ([value, label]) =>
                `<option value="${value}" ${changeTypeFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`
            ).join("")}
          </select>
          <select name="season" onchange="this.form.submit()">
            <option value="">Tüm sezonlar</option>
            ${TIRE_SEASONS.map(
              ([value, label]) =>
                `<option value="${value}" ${seasonFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`
            ).join("")}
          </select>
          <input type="date" name="date_from" value="${escapeHtml(dateFrom)}" title="Başlangıç"/>
          <input type="date" name="date_to" value="${escapeHtml(dateTo)}" title="Bitiş"/>
          <button type="submit" class="btn btn--ghost btn--sm">Uygula</button>
          <a href="${historyLink}" class="btn btn--ghost btn--sm">Temizle</a>
        </form>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Araç</th><th>İşlem</th><th>Tarih</th><th>KM</th><th>Sezon</th><th>Pozisyon</th><th>Adet</th><th>Maliyet</th><th>Tedarikçi</th><th>Notlar</th><th>İşlem</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function tireChangeHistorySectionHtml(bundle) {
  const { vehicle, tireChangeHistory } = bundle;
  const records = (tireChangeHistory?.records || []).slice(0, 5);

  const body = records.length
    ? `<div class="table-wrap vc-tire-history-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Tarih</th><th>İşlem</th><th>Sezon</th><th>Pozisyon</th><th>Adet</th><th>Maliyet</th>
          </tr></thead>
          <tbody>${records
            .map(
              (row) => `<tr>
                <td>${formatDateDisplay(row.change_date)}</td>
                <td>${changeTypeBadge(row.change_type, row.change_type_label)}</td>
                <td>${row.season_label ? escapeHtml(row.season_label) : "—"}</td>
                <td>${escapeHtml(row.position_label || positionLabel(row.position))}</td>
                <td>${Number(row.quantity).toLocaleString("tr-TR")}</td>
                <td>${row.cost ? money(row.cost) : "—"}</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>
      </div>`
    : `<p class="vc-empty-note">Bu araç için lastik değişim kaydı bulunmuyor.</p>`;

  return `<section class="vc-section vc-section--compact" id="lastik-degisim-gecmisi">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Lastik Değişim Geçmişi</h2>
      <a href="/tire-history?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Tüm geçmiş →</a>
    </header>
    <div class="vc-section__body">${body}</div>
  </section>`;
}

module.exports = {
  tireHistoryPageHtml,
  tireChangeHistorySectionHtml,
};
