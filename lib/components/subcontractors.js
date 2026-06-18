const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { moneyInputHtml } = require("../../utils/money");
const { SHIFT_TYPES } = require("../../services/subcontractorService");

function shiftOptions(selected = "both") {
  return Object.entries(SHIFT_TYPES)
    .map(
      ([k, label]) =>
        `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function subcontractorOptions(subcontractors, selected = "") {
  return subcontractors
    .map(
      (s) =>
        `<option value="${s.id}" ${String(selected) === String(s.id) ? "selected" : ""}>${escapeHtml(s.name)}</option>`
    )
    .join("");
}

function vehicleOptions(vehicles, selected = "") {
  return `<option value="">— MISTUR aracı yok —</option>${vehicles
    .map(
      (v) =>
        `<option value="${v.id}" ${String(selected) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
    )
    .join("")}`;
}

function assignmentOptions(assignments, selected = "") {
  return `<option value="">— Görev seçin —</option>${assignments
    .map((a) => {
      const label = [a.customer_name, a.route_name, a.external_plate].filter(Boolean).join(" · ");
      return `<option value="${a.id}" ${String(selected) === String(a.id) ? "selected" : ""}>${escapeHtml(label || `#${a.id}`)}</option>`;
    })
    .join("")}`;
}

function subcontractorsPageHtml({ kpi, subcontractors, assignments, payments, vehicles }) {
  const subRows = subcontractors.length
    ? subcontractors
        .map(
          (s) => `<tr>
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td>${escapeHtml(s.phone || "—")}</td>
          <td>${escapeHtml(s.tax_info || "—")}</td>
          <td>${s.is_active ? '<span class="pill pill--green">Aktif</span>' : '<span class="pill pill--muted">Pasif</span>'}</td>
          <td>${escapeHtml(s.note || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Henüz taşeron kaydı yok.</td></tr>`;

  const assignRows = assignments.length
    ? assignments
        .map(
          (a) => `<tr>
          <td>${escapeHtml(a.subcontractor_name || "—")}</td>
          <td>${escapeHtml(a.customer_name || "—")}</td>
          <td>${escapeHtml(a.route_name || "—")}</td>
          <td>${escapeHtml(a.shift_label || "—")}</td>
          <td>${escapeHtml(a.external_plate || "—")}</td>
          <td>${a.related_plate ? `<a class="plate-link" href="/vehicle/${a.related_vehicle_id}">${escapeHtml(a.related_plate)}</a>` : "—"}</td>
          <td>${a.monthly_agreed_amount ? money(a.monthly_agreed_amount) : "—"}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="data-table__empty">Görev/hat tanımı yok.</td></tr>`;

  const payRows = payments.length
    ? payments
        .map((p) => {
          const assigned = p.is_assigned
            ? '<span class="pill pill--green">Atanmış</span>'
            : '<span class="pill pill--amber">Atanmamış</span>';
          return `<tr>
          <td>${escapeHtml(p.subcontractor_name || "—")}</td>
          <td>${escapeHtml(p.customer_name || p.route_name || "—")}</td>
          <td>${escapeHtml(p.period || "—")}</td>
          <td>${money(p.amount)}</td>
          <td>${escapeHtml(p.payment_date || "—")}</td>
          <td>${assigned}</td>
          <td class="data-table__actions">
            <a href="/subcontractors/payment/delete/${p.id}" class="btn btn--sm btn--danger" onclick="return confirm('Ödeme kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="data-table__empty">Hakediş ödemesi yok.</td></tr>`;

  return `<div class="dash page-enter dash--dense sub-hub">
    <header class="sub-hub__header fade-in">
      <p class="sub-hub__eyebrow">Filo Operasyon · Taşeron Yönetimi</p>
      <h2 class="sub-hub__title">Taşeron Yönetimi</h2>
      <p class="sub-hub__desc">Başoğlu Lazer gibi taşeron hatları, plakaları ve hakediş ödemelerini yönetin. Taşeron giderleri kârlılık motoruna yansır.</p>
    </header>

    <div class="sub-kpi-row fade-in">
      <article class="sub-kpi"><span>Aktif Taşeron</span><strong>${kpi.activeSubcontractors.toLocaleString("tr-TR")}</strong></article>
      <article class="sub-kpi"><span>Bu Ay Taşeron Hakedişi</span><strong>${money(kpi.monthPayments)}</strong></article>
      <article class="sub-kpi sub-kpi--ok"><span>Atanmış Gider</span><strong>${money(kpi.assignedExpense)}</strong></article>
      <article class="sub-kpi sub-kpi--warn"><span>Atanmamış Gider</span><strong>${money(kpi.unassignedExpense)}</strong></article>
    </div>

    <div class="grid2">
      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">Taşeron Ekle</h2></header>
        <div class="panel__body">
          <form method="POST" action="/subcontractors/add" class="form-grid">
            <input name="name" placeholder="Firma / kişi adı" required class="full"/>
            <input name="phone" placeholder="Telefon"/>
            <input name="tax_info" placeholder="Vergi / açıklama"/>
            <input name="note" placeholder="Not" class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">Kaydet</button></div>
          </form>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">Görev / Hat Tanımı</h2></header>
        <div class="panel__body">
          <form method="POST" action="/subcontractors/assignment/add" class="form-grid">
            <select name="subcontractor_id" required>
              <option value="">Taşeron seçin</option>
              ${subcontractorOptions(subcontractors.filter((s) => s.is_active))}
            </select>
            <input name="customer_name" placeholder="Müşteri (örn. Başoğlu Lazer)" required/>
            <input name="route_name" placeholder="Hat/servis (örn. Akşam Çıkış)"/>
            <select name="shift_type">${shiftOptions()}</select>
            <input name="external_plate" placeholder="Taşeron plakası"/>
            <select name="related_vehicle_id">${vehicleOptions(vehicles)}</select>
            ${moneyInputHtml("monthly_agreed_amount", { placeholder: "Aylık anlaşma (örn. 42.357,00)" })}
            <input name="note" placeholder="Not" class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">Görev Ekle</button></div>
          </form>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Hakediş / Ödeme Girişi</h2></header>
      <div class="panel__body">
        <form method="POST" action="/subcontractors/payment/add" class="form-grid">
          <select name="subcontractor_id" required>
            <option value="">Taşeron seçin</option>
            ${subcontractorOptions(subcontractors.filter((s) => s.is_active))}
          </select>
          <select name="assignment_id">${assignmentOptions(assignments.filter((a) => a.is_active))}</select>
          <input name="period" placeholder="Dönem (YYYY-MM)" value="${new Date().toISOString().slice(0, 7)}"/>
          ${moneyInputHtml("amount", { required: true, placeholder: "Tutar (örn. 22.500,00)" })}
          <input type="date" name="payment_date"/>
          <input name="invoice_no" placeholder="Fatura no"/>
          <input name="note" placeholder="Not" class="full"/>
          <div class="form-actions full"><button type="submit" class="btn btn--primary">Ödeme Kaydet</button></div>
        </form>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head"><h2 class="panel__title">Taşeronlar</h2></header>
      <div class="panel__body table-wrap">
        <table class="data-table"><thead><tr>
          <th>Ad</th><th>Telefon</th><th>Vergi</th><th>Durum</th><th>Not</th>
        </tr></thead><tbody>${subRows}</tbody></table>
      </div>
    </section>

    <div class="grid2">
      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">Görevler</h2></header>
        <div class="panel__body table-wrap">
          <table class="data-table"><thead><tr>
            <th>Taşeron</th><th>Müşteri</th><th>Hat</th><th>Vardiya</th><th>Taşeron Plaka</th><th>MISTUR Araç</th><th>Anlaşma</th>
          </tr></thead><tbody>${assignRows}</tbody></table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">Son Hakediş Ödemeleri</h2></header>
        <div class="panel__body table-wrap">
          <table class="data-table"><thead><tr>
            <th>Taşeron</th><th>Görev</th><th>Dönem</th><th>Tutar</th><th>Tarih</th><th>Durum</th><th></th>
          </tr></thead><tbody>${payRows}</tbody></table>
        </div>
      </section>
    </div>
  </div>`;
}

module.exports = {
  subcontractorsPageHtml,
};
