const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { moneyInputHtml } = require("../../utils/money");
const { kpiValueHtml } = require("./kpi");

function employeeOptions(employees, selected = "") {
  return employees
    .filter((e) => e.is_active)
    .map(
      (e) =>
        `<option value="${e.id}" ${String(selected) === String(e.id) ? "selected" : ""}>${escapeHtml(e.full_name)}${e.vehicle_plate ? ` · ${escapeHtml(e.vehicle_plate)}` : ""}</option>`
    )
    .join("");
}

function vehicleOptions(vehicles, selected = "") {
  return `<option value="">— Araç atanmadı —</option>${vehicles
    .map(
      (v) =>
        `<option value="${v.id}" ${String(selected) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
    )
    .join("")}`;
}

function employeesPageHtml({ kpi, employees, costs, vehicles }) {
  const employeeRows = employees.length
    ? employees
        .map(
          (e) => `<tr>
          <td><strong>${escapeHtml(e.full_name)}</strong></td>
          <td>${escapeHtml(e.role || "—")}</td>
          <td>${escapeHtml(e.phone || "—")}</td>
          <td>${e.vehicle_plate ? `<a class="plate-link" href="/vehicle/${e.vehicle_id}">${escapeHtml(e.vehicle_plate)}</a>` : '<span class="pill pill--amber">Atanmamış</span>'}</td>
          <td>${e.is_active ? '<span class="pill pill--green">Aktif</span>' : '<span class="pill pill--muted">Pasif</span>'}</td>
          <td>${escapeHtml(e.note || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Henüz personel kaydı yok.</td></tr>`;

  const costRows = costs.length
    ? costs
        .map(
          (c) => `<tr>
          <td>${escapeHtml(c.full_name || "—")}</td>
          <td>${escapeHtml(c.period || "—")}</td>
          <td>${money(c.salary_amount)}</td>
          <td>${money(c.travel_amount)}</td>
          <td>${money(c.washing_amount)}</td>
          <td><strong>${money(c.personnelCost)}</strong></td>
          <td>${c.vehicle_plate ? escapeHtml(c.vehicle_plate) : "—"}</td>
          <td class="data-table__actions">
            <a href="/employees/cost/delete/${c.id}" class="btn btn--sm btn--danger" onclick="return confirm('Maliyet kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="data-table__empty">Maliyet kaydı yok.</td></tr>`;

  return `<div class="dash page-enter dash--dense hr-hub">
    <header class="hr-hub__header fade-in">
      <p class="hr-hub__eyebrow">İnsan Kaynakları · Personel Maliyet Merkezi</p>
      <h2 class="hr-hub__title">Personel ve Şoför Maliyetleri</h2>
      <p class="hr-hub__desc">Maaş, yol parası, yıkama ve diğer personel giderlerini yönetin. Araç atanan maliyetler kârlılık motoruna yansır.</p>
    </header>

    <div class="hr-kpi-row fade-in">
      <article class="hr-kpi${kpi.activeEmployees ? "" : " hr-kpi--empty"}"><span>Aktif Personel</span>${kpi.activeEmployees ? `<strong>${kpiValueHtml(kpi.activeEmployees, { format: "count" })}</strong>` : kpiValueHtml(0)}</article>
      <article class="hr-kpi${kpi.monthPersonnelCost ? "" : " hr-kpi--empty"}"><span>Bu Ay Personel Maliyeti</span>${kpi.monthPersonnelCost ? `<strong>${kpiValueHtml(kpi.monthPersonnelCost)}</strong>` : kpiValueHtml(0)}</article>
      <article class="hr-kpi hr-kpi--ok${kpi.assignedEmployees ? "" : " hr-kpi--empty"}"><span>Araç Atanmış Personel</span>${kpi.assignedEmployees ? `<strong>${kpiValueHtml(kpi.assignedEmployees, { format: "count" })}</strong>` : kpiValueHtml(0)}</article>
      <article class="hr-kpi hr-kpi--warn${kpi.unassignedEmployees ? "" : " hr-kpi--empty"}"><span>Araç Atanmamış Personel</span>${kpi.unassignedEmployees ? `<strong>${kpiValueHtml(kpi.unassignedEmployees, { format: "count" })}</strong>` : kpiValueHtml(0)}</article>
    </div>

    <div class="hr-forms-grid">
      <section class="panel hr-form-card fade-in">
        <header class="panel__head"><h2 class="panel__title">Personel Ekle</h2></header>
        <div class="panel__body">
          <form method="POST" action="/employees/add" class="form-grid hr-form">
            <input name="full_name" placeholder="Ad Soyad" required class="full"/>
            <input name="phone" placeholder="Telefon"/>
            <input name="role" placeholder="Görev (örn. Şoför)" value="Şoför"/>
            <select name="vehicle_id">${vehicleOptions(vehicles)}</select>
            <input name="note" placeholder="Not" class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">Kaydet</button></div>
          </form>
        </div>
      </section>

      <section class="panel hr-form-card fade-in">
        <header class="panel__head"><h2 class="panel__title">Aylık Personel Maliyeti</h2></header>
        <div class="panel__body">
          <form method="POST" action="/employees/cost/add" class="form-grid hr-form">
            <select name="employee_id" required class="full">
              <option value="">Personel seçin</option>
              ${employeeOptions(employees)}
            </select>
            <input name="period" placeholder="Dönem (YYYY-MM)" value="${new Date().toISOString().slice(0, 7)}"/>
            ${moneyInputHtml("salary_amount", { placeholder: "Maaş (örn. 45.000,00)" })}
            ${moneyInputHtml("travel_amount", { placeholder: "Yol parası" })}
            ${moneyInputHtml("washing_amount", { placeholder: "Yıkama parası" })}
            ${moneyInputHtml("bonus_amount", { placeholder: "Prim / ikramiye" })}
            ${moneyInputHtml("advance_amount", { placeholder: "Avans (düşülür)" })}
            ${moneyInputHtml("deduction_amount", { placeholder: "Kesinti (düşülür)" })}
            <input name="note" placeholder="Not" class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">Maliyet Kaydet</button></div>
          </form>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Personeller</h2></header>
      <div class="panel__body table-wrap">
        <table class="data-table"><thead><tr>
          <th>Ad Soyad</th><th>Görev</th><th>Telefon</th><th>Araç</th><th>Durum</th><th>Not</th>
        </tr></thead><tbody>${employeeRows}</tbody></table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Son Maliyet Kayıtları</h2></header>
      <div class="panel__body table-wrap">
        <table class="data-table"><thead><tr>
          <th>Personel</th><th>Dönem</th><th>Maaş</th><th>Yol</th><th>Yıkama</th><th>Toplam</th><th>Araç</th><th></th>
        </tr></thead><tbody>${costRows}</tbody></table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  employeesPageHtml,
};
