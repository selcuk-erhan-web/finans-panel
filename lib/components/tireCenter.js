const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { formatMoneyInputValue, moneyInputHtml } = require("../../utils/money");
const { money } = require("../finance");
const { TIRE_SEASONS, TIRE_STATUSES, TIRE_POSITIONS } = require("../constants");
const { seasonLabel, statusLabel, positionLabel } = require("../../services/tireService");

function optionList(items, selected = "") {
  return items
    .map(
      ([value, label]) =>
        `<option value="${value}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function statusBadge(status, label) {
  const cls = `tyr-badge tyr-badge--${escapeHtml(status || "unknown")}`;
  return `<span class="${cls}">${escapeHtml(label || statusLabel(status))}</span>`;
}

function tireCenterPageHtml({ summary, rows, vehicles, filters, editRecord, selectedVehiclePlate }) {
  const vehicleFilter = filters.vehicle_id || "";
  const seasonFilter = filters.season || "";
  const statusFilter = filters.status || "";
  const selectedVehicle = editRecord ? String(editRecord.vehicle_id) : vehicleFilter;
  const filterActive = Boolean(vehicleFilter || seasonFilter || statusFilter);
  const costValue =
    editRecord?.cost != null && editRecord.cost > 0 ? formatMoneyInputValue(editRecord.cost) : "";

  const filterBanner = filterActive
    ? `<div class="tyr-filter-banner fade-in">
        <span>Filtre aktif · ${rows.length} kayıt</span>
        ${vehicleFilter ? `<span>Araç: <strong>${escapeHtml(selectedVehiclePlate || "Seçili")}</strong></span>` : ""}
        ${seasonFilter ? `<span>Sezon: <strong>${escapeHtml(seasonLabel(seasonFilter))}</strong></span>` : ""}
        ${statusFilter ? `<span>Durum: <strong>${escapeHtml(statusLabel(statusFilter))}</strong></span>` : ""}
        <a href="/tires" class="btn btn--ghost btn--sm">Temizle</a>
        ${vehicleFilter ? `<a href="/vehicle/${escapeHtml(vehicleFilter)}" class="btn btn--ghost btn--sm">Araç Merkezi →</a>` : ""}
      </div>`
    : "";

  const summaryCards = `
    <div class="tyr-kpi-row fade-in">
      <article class="tyr-kpi"><span>Toplam Kayıt</span><strong>${Number(summary.total_records).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--qty"><span>Toplam Adet</span><strong>${Number(summary.total_quantity).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--on"><span>Araç Üzerinde</span><strong>${Number(summary.on_vehicle).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--storage"><span>Depoda</span><strong>${Number(summary.in_storage).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--summer"><span>Yazlık</span><strong>${Number(summary.summer).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--winter"><span>Kışlık</span><strong>${Number(summary.winter).toLocaleString("tr-TR")}</strong></article>
      <article class="tyr-kpi tyr-kpi--cost"><span>Toplam Maliyet</span><strong>${money(summary.total_cost)}</strong></article>
    </div>`;

  const emptyState = `<tr><td colspan="13" class="data-table__empty">
      Lastik kaydı bulunmuyor.
      ${filterActive ? `<span class="data-table__empty-hint">Filtreleri temizleyin veya yeni kayıt ekleyin.</span>` : `<span class="data-table__empty-hint">İlk lastik kaydını oluşturmak için formu kullanın.</span>`}
    </td></tr>`;

  const tableRows = rows.length
    ? rows
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/tire-history?vehicle_id=${row.vehicle_id}" title="Bu aracın lastik geçmişi">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(row.season_label || seasonLabel(row.season))}</td>
          <td>${escapeHtml([row.brand, row.model].filter(Boolean).join(" / ") || "—")}</td>
          <td>${escapeHtml(row.size || "—")}</td>
          <td>${escapeHtml(row.dot || "—")}</td>
          <td>${row.tread_depth_mm != null ? Number(row.tread_depth_mm).toLocaleString("tr-TR") : "—"}</td>
          <td>${Number(row.quantity).toLocaleString("tr-TR")}</td>
          <td>${statusBadge(row.status, row.status_label)}</td>
          <td>${escapeHtml(row.position_label || positionLabel(row.position))}</td>
          <td>${row.cost ? money(row.cost) : "—"}</td>
          <td>${escapeHtml(row.vendor || "—")}</td>
          <td>${escapeHtml(row.notes || "—")}</td>
          <td class="data-table__actions">
            <a href="/tires/edit/${row.id}" class="btn btn--sm btn--ghost">Düzenle</a>
            <a href="/tires/delete/${row.id}" class="btn btn--sm btn--danger" onclick="return confirm('Lastik kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : emptyState;

  const formTitle = editRecord ? "Lastik kaydı düzenle" : "Lastik Kaydı";
  const formAction = editRecord ? `/tires/edit/${editRecord.id}` : "/tires/add";

  const formPanel = `<section class="panel fade-in tire-form-panel">
    <header class="panel__head"><h2 class="panel__title">${escapeHtml(formTitle)}</h2></header>
    <div class="panel__body">
      <form method="POST" action="${formAction}" class="form-grid tire-form">
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

        <label class="field-label">Sezon</label>
        <select name="season" required>${optionList(TIRE_SEASONS, editRecord?.season || "")}</select>

        <label class="field-label">Marka</label>
        <input name="brand" placeholder="Lastik markası" value="${escapeHtml(editRecord?.brand || "")}"/>

        <label class="field-label">Model</label>
        <input name="model" placeholder="Lastik modeli" value="${escapeHtml(editRecord?.model || "")}"/>

        <label class="field-label">Ebat</label>
        <input name="size" placeholder="205/55 R16" value="${escapeHtml(editRecord?.size || "")}"/>

        <label class="field-label">DOT</label>
        <input name="dot" placeholder="DOT kodu" value="${escapeHtml(editRecord?.dot || "")}"/>

        <label class="field-label">Diş Derinliği mm</label>
        <input type="number" name="tread_depth_mm" min="0" step="0.1" placeholder="mm" value="${editRecord?.tread_depth_mm ?? ""}"/>

        <label class="field-label">Adet</label>
        <input type="number" name="quantity" min="1" step="1" required value="${editRecord?.quantity ?? 4}"/>

        <label class="field-label">Durum</label>
        <select name="status" required>${optionList(TIRE_STATUSES, editRecord?.status || "on_vehicle")}</select>

        <label class="field-label">Pozisyon</label>
        <select name="position">${optionList(TIRE_POSITIONS, editRecord?.position || "full_set")}</select>

        <label class="field-label">Satın Alma Tarihi</label>
        <input type="date" name="purchase_date" value="${escapeHtml(editRecord?.purchase_date || "")}"/>

        <label class="field-label">Maliyet</label>
        ${moneyInputHtml("cost", {
          value: costValue,
          required: false,
          placeholder: "Maliyet (örn. 12.500,00)",
          className: "money-input",
        })}

        <label class="field-label">Servis / Tedarikçi</label>
        <input name="vendor" placeholder="Servis veya tedarikçi" value="${escapeHtml(editRecord?.vendor || "")}"/>

        <label class="field-label full">Notlar</label>
        <input class="full" name="notes" placeholder="Ek notlar" value="${escapeHtml(editRecord?.notes || "")}"/>

        <div class="form-actions full">
          <button type="submit" class="btn btn--primary">${editRecord ? "Güncelle" : "Kaydet"}</button>
          ${editRecord ? `<a href="/tires" class="btn btn--ghost">İptal</a>` : ""}
        </div>
      </form>
    </div>
  </section>`;

  return `<div class="dash page-enter dash--dense tire-hub">
    <header class="tire-hub__header fade-in">
      <p class="tire-hub__eyebrow">Filo Lastik</p>
      <div class="tire-hub__title-row">
        <h2 class="tire-hub__title">Lastik Merkezi</h2>
        <a href="/tire-history${vehicleFilter ? `?vehicle_id=${vehicleFilter}` : ""}" class="btn btn--ghost btn--sm">Değişim Geçmişi →</a>
        <a href="/tire-seasonal-schedule${vehicleFilter ? `?vehicle_id=${vehicleFilter}` : ""}" class="btn btn--ghost btn--sm">Sezon Planı →</a>
      </div>
      <p class="tire-hub__desc">${filterActive ? "Filtrelenmiş lastik envanteri" : "Araç lastik envanteri ve maliyet takibi"}</p>
    </header>

    ${filterBanner}
    ${summaryCards}

    <div class="grid2 tire-hub__entry-grid">
      ${formPanel}
      <section class="panel fade-in tire-info-panel">
        <header class="panel__head">
          <h2 class="panel__title">Lastik Merkezi</h2>
          <p class="panel__desc">Yazlık, kışlık ve depo lastik kayıtlarını buradan yönetin.</p>
        </header>
        <div class="panel__body">
          <ul class="tire-info-list">
            <li>Sezon, ebat, DOT ve diş derinliği takibi</li>
            <li>Araç üzerinde / depoda / hurda durum yönetimi</li>
            <li>Araç bazlı filtreleme ve maliyet özeti</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Lastik Kayıtları</h2>
          <p class="panel__desc">${rows.length} kayıt · en yeni önce</p>
        </div>
        <form class="filters tyr-filters" method="GET" action="/tires">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <select name="season" onchange="this.form.submit()">
            <option value="">Tüm sezonlar</option>
            ${TIRE_SEASONS.map(
              ([value, label]) =>
                `<option value="${value}" ${seasonFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`
            ).join("")}
          </select>
          <select name="status" onchange="this.form.submit()">
            <option value="">Tüm durumlar</option>
            ${TIRE_STATUSES.map(
              ([value, label]) =>
                `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`
            ).join("")}
          </select>
          <a href="/tires" class="btn btn--ghost btn--sm">Temizle</a>
        </form>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Araç</th><th>Sezon</th><th>Marka / Model</th><th>Ebat</th><th>DOT</th><th>Diş mm</th><th>Adet</th><th>Durum</th><th>Pozisyon</th><th>Maliyet</th><th>Tedarikçi</th><th>Notlar</th><th>İşlem</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function tireStatusSectionHtml(bundle) {
  const { vehicle, tireStatus } = bundle;
  const { records } = tireStatus;

  const body = records.length
    ? `<div class="table-wrap vc-tire-table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Sezon</th><th>Marka / Model</th><th>Ebat</th><th>Diş mm</th><th>Adet</th>
          </tr></thead>
          <tbody>${records
            .map(
              (row) => `<tr>
                <td>${escapeHtml(row.season_label || seasonLabel(row.season))}</td>
                <td>${escapeHtml([row.brand, row.model].filter(Boolean).join(" / ") || "—")}</td>
                <td>${escapeHtml(row.size || "—")}</td>
                <td>${row.tread_depth_mm != null ? Number(row.tread_depth_mm).toLocaleString("tr-TR") : "—"}</td>
                <td>${Number(row.quantity).toLocaleString("tr-TR")}</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>
      </div>`
    : `<p class="vc-empty-note">Bu araç için lastik kaydı bulunmuyor.</p>`;

  return `<section class="vc-section vc-section--compact" id="lastik-durumu">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Lastik Durumu</h2>
      <a href="/tires?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Lastik Merkezi →</a>
    </header>
    <div class="vc-section__body">${body}</div>
  </section>`;
}

module.exports = {
  tireCenterPageHtml,
  tireStatusSectionHtml,
};
