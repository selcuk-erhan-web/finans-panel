const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { formatMoneyInputValue, moneyInputHtml } = require("../../utils/money");
const { money } = require("../finance");
const { MAINTENANCE_TYPES } = require("../constants");
const { typeLabel } = require("../../services/maintenanceService");

function maintenanceTypeOptions(selected = "") {
  const keys = new Set(MAINTENANCE_TYPES.map(([k]) => k));
  if (selected && !keys.has(selected)) keys.add(selected);
  return [...keys]
    .map((k) => {
      const label = typeLabel(k);
      return `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function maintenanceCenterPageHtml({ summary, rows, vehicles, filters, editRecord }) {
  const vehicleFilter = filters.vehicle_id || "";
  const selectedVehicle = editRecord ? String(editRecord.vehicle_id) : vehicleFilter;
  const selectedType = editRecord?.maintenance_type || "";
  const costValue =
    editRecord?.cost != null && editRecord.cost > 0 ? formatMoneyInputValue(editRecord.cost) : "";

  const summaryCards = `
    <div class="mnt-kpi-row fade-in">
      <article class="mnt-kpi"><span>Toplam Kayıt</span><strong>${Number(summary.total_records).toLocaleString("tr-TR")}</strong></article>
      <article class="mnt-kpi mnt-kpi--cost"><span>Toplam Maliyet</span><strong>${money(summary.total_cost)}</strong></article>
      <article class="mnt-kpi mnt-kpi--vehicles"><span>Bakımlı Araç</span><strong>${Number(summary.vehicles_with_maintenance).toLocaleString("tr-TR")}</strong></article>
    </div>`;

  const emptyState = `<tr><td colspan="8" class="data-table__empty">
      Henüz bakım kaydı yok
      <span class="data-table__empty-hint">İlk bakım kaydını oluşturmak için formu kullanın.</span>
    </td></tr>`;

  const tableRows = rows.length
    ? rows
        .map(
          (row) => `<tr>
          <td><a class="plate-link" href="/vehicle/${row.vehicle_id}">${escapeHtml(row.plate || "—")}</a></td>
          <td>${escapeHtml(row.maintenance_type_label || typeLabel(row.maintenance_type))}</td>
          <td>${formatDateDisplay(row.maintenance_date)}</td>
          <td>${row.odometer_km != null ? Number(row.odometer_km).toLocaleString("tr-TR") : "—"}</td>
          <td>${row.cost ? money(row.cost) : "—"}</td>
          <td>${escapeHtml(row.vendor || "—")}</td>
          <td>${escapeHtml(row.description || "—")}</td>
          <td class="data-table__actions">
            <a href="/maintenance/edit/${row.id}" class="btn btn--sm btn--ghost">Düzenle</a>
            <a href="/maintenance/delete/${row.id}" class="btn btn--sm btn--danger" onclick="return confirm('Bakım kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : emptyState;

  const formTitle = editRecord ? "Bakım kaydı düzenle" : "Bakım Kaydı";
  const formAction = editRecord ? `/maintenance/edit/${editRecord.id}` : "/maintenance/add";

  const formPanel = `<section class="panel fade-in maintenance-form-panel">
    <header class="panel__head"><h2 class="panel__title">${escapeHtml(formTitle)}</h2></header>
    <div class="panel__body">
      <form method="POST" action="${formAction}" class="form-grid maintenance-form">
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

        <label class="field-label">Bakım Türü</label>
        <select name="maintenance_type" required>${maintenanceTypeOptions(selectedType)}</select>

        <label class="field-label">Tarih</label>
        <input type="date" name="maintenance_date" required value="${escapeHtml(editRecord?.maintenance_date || "")}"/>

        <label class="field-label">KM</label>
        <input type="number" name="odometer_km" min="0" step="1" placeholder="Kilometre" value="${editRecord?.odometer_km ?? ""}"/>

        <label class="field-label">Maliyet</label>
        ${moneyInputHtml("cost", {
          value: costValue,
          required: false,
          placeholder: "Maliyet (örn. 4.250,00)",
          className: "money-input",
        })}

        <label class="field-label">Servis / Tedarikçi</label>
        <input name="vendor" placeholder="Servis veya tedarikçi" value="${escapeHtml(editRecord?.vendor || "")}"/>

        <label class="field-label full">Açıklama</label>
        <input class="full" name="description" placeholder="İşlem açıklaması" value="${escapeHtml(editRecord?.description || "")}"/>

        <div class="form-actions full">
          <button type="submit" class="btn btn--primary">${editRecord ? "Güncelle" : "Kaydet"}</button>
          ${editRecord ? `<a href="/maintenance" class="btn btn--ghost">İptal</a>` : ""}
        </div>
      </form>
    </div>
  </section>`;

  return `<div class="dash page-enter dash--dense maintenance-hub">
    <header class="maintenance-hub__header fade-in">
      <p class="maintenance-hub__eyebrow">Filo Bakım</p>
      <h2 class="maintenance-hub__title">Bakım Merkezi</h2>
      <p class="maintenance-hub__desc">Araç bakım geçmişi ve maliyet takibi</p>
    </header>

    ${summaryCards}

    <div class="grid2 maintenance-hub__entry-grid">
      ${formPanel}
      <section class="panel fade-in maintenance-info-panel">
        <header class="panel__head">
          <h2 class="panel__title">Bakım Merkezi</h2>
          <p class="panel__desc">Araç bakım kayıtlarını buradan oluşturun ve yönetin.</p>
        </header>
        <div class="panel__body">
          <ul class="maintenance-info-list">
            <li>Motor yağı, filtre, fren ve periyodik bakım kayıtları</li>
            <li>KM ve maliyet bilgisi ile servis geçmişi</li>
            <li>Araç bazlı filtreleme ve en yeni kayıt önce sıralama</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Bakım Kayıtları</h2>
          <p class="panel__desc">${rows.length} kayıt · en yeni önce</p>
        </div>
        <form class="filters" method="GET" action="/maintenance">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <a href="/maintenance" class="btn btn--ghost btn--sm">Temizle</a>
          <a href="/export/maintenance/xlsx" class="btn btn--ghost btn--sm">Excel</a>
        </form>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Araç</th><th>Tür</th><th>Tarih</th><th>KM</th><th>Maliyet</th><th>Servis</th><th>Açıklama</th><th>İşlem</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  maintenanceCenterPageHtml,
  maintenanceTypeOptions,
};
