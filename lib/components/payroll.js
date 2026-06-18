const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatDateDisplay } = require("../../utils/date");
const { moneyInputHtml } = require("../../utils/money");
const { TYPE_LABELS, STATUS_LABELS } = require("../../services/payrollObligationService");
const { BASIS_LABELS } = require("../../services/payrollAllocationService");

function statusBadge(status) {
  const map = {
    pending: "pill pill--amber",
    paid: "pill pill--green",
    overdue: "pill pill--red",
  };
  return `<span class="${map[status] || "pill pill--muted"}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function typeOptions(selected = "") {
  return Object.entries(TYPE_LABELS)
    .map(
      ([k, label]) =>
        `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function allocationTypeBadge(type) {
  const map = {
    vehicle: "pill pill--green",
    general: "pill pill--amber",
  };
  const labels = { vehicle: "Araç", general: "Genel" };
  return `<span class="${map[type] || "pill pill--muted"}">${escapeHtml(labels[type] || type)}</span>`;
}

function allocationCenterHtml({ allocSummary = {}, unallocated = [], allocated = [], allocationDetails = [] }) {
  const unallocatedRows = unallocated.length
    ? unallocated
        .map(
          (r) => `<tr>
          <td>${escapeHtml(r.type_label)}</td>
          <td>${escapeHtml(r.period_label || r.period)}</td>
          <td><strong>${money(r.amount)}</strong></td>
          <td>${statusBadge(r.status)}</td>
          <td class="data-table__actions">
            <a href="/payroll/allocate/${r.id}" class="btn btn--sm btn--primary">Dağıt</a>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Dağıtılmayı bekleyen tahakkuk yok.</td></tr>`;

  const allocatedRows = allocated.length
    ? allocated
        .map((r) => {
          const summary = allocSummary?.allocated?.find?.((a) => a.id === r.id);
          const detail = allocationDetails.filter((d) => d.obligation_id === r.id);
          const vehicleTotal = detail
            .filter((d) => d.allocation_type === "vehicle")
            .reduce((s, d) => s + d.amount, 0);
          const generalTotal = detail
            .filter((d) => d.allocation_type === "general")
            .reduce((s, d) => s + d.amount, 0);
          return `<tr>
          <td>${escapeHtml(r.type_label)}</td>
          <td>${escapeHtml(r.period_label || r.period)}</td>
          <td><strong>${money(r.amount)}</strong></td>
          <td>${money(vehicleTotal)}</td>
          <td>${money(generalTotal)}</td>
          <td class="data-table__actions">
            <a href="/payroll/revoke/${r.id}" class="btn btn--sm btn--ghost" onclick="return confirm('Dağıtım geri alınsın mı?')">Geri Al</a>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Henüz dağıtılmış tahakkuk yok.</td></tr>`;

  const detailRows = allocationDetails.length
    ? allocationDetails
        .map(
          (a) => `<tr>
          <td>${escapeHtml(a.obligation_period || a.period)}</td>
          <td>${escapeHtml(a.full_name || "—")}</td>
          <td>${escapeHtml(a.vehicle_plate || "—")}</td>
          <td>${allocationTypeBadge(a.allocation_type)}</td>
          <td><strong>${money(a.amount)}</strong></td>
          <td>${escapeHtml(a.basis_label || BASIS_LABELS[a.basis] || a.basis || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Dağıtım satırı yok.</td></tr>`;

  const s = allocSummary || {};

  return `<section class="panel fade-in payroll-alloc-center" id="allocations">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">Dağıtım Merkezi</h2>
        <p class="panel__desc">SGK/Muhtasar tahakkuklarını aktif personele eşit paylaştırın · analiz tahsisi (muhasebe kaydı değil)</p>
      </div>
    </header>
    <div class="panel__body">
      <div class="payroll-alloc-kpi-row">
        <article class="payroll-alloc-kpi"><span>Toplam Tahakkuk</span><strong>${money(s.totalObligationAmount || 0)}</strong></article>
        <article class="payroll-alloc-kpi"><span>Araçlara Dağıtılan</span><strong>${money(s.vehicleTotal || 0)}</strong></article>
        <article class="payroll-alloc-kpi payroll-alloc-kpi--general"><span>Genel Gider</span><strong>${money(s.generalTotal || 0)}</strong></article>
        <article class="payroll-alloc-kpi"><span>Dağıtım Oranı</span><strong>${s.ratio != null ? `${Number(s.ratio).toLocaleString("tr-TR")}%` : "—"}</strong></article>
      </div>

      <div class="grid2 payroll-alloc-grid">
        <div class="table-wrap">
          <h3 class="payroll-alloc-subtitle">Dağıtılmamış Tahakkuklar</h3>
          <table class="data-table payroll-table">
            <thead><tr><th>Tür</th><th>Dönem</th><th>Tutar</th><th>Durum</th><th></th></tr></thead>
            <tbody>${unallocatedRows}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <h3 class="payroll-alloc-subtitle">Dağıtılmış Tahakkuklar</h3>
          <table class="data-table payroll-table">
            <thead><tr><th>Tür</th><th>Dönem</th><th>Tutar</th><th>Araç</th><th>Genel</th><th></th></tr></thead>
            <tbody>${allocatedRows}</tbody>
          </table>
        </div>
      </div>

      <div class="table-wrap payroll-alloc-detail">
        <h3 class="payroll-alloc-subtitle">Dağıtım Detayı</h3>
        <table class="data-table payroll-table">
          <thead><tr><th>Dönem</th><th>Personel</th><th>Araç</th><th>Tip</th><th>Tutar</th><th>Esas</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function payrollPageHtml({ kpi, rows, importResult, allocSummary, unallocated, allocated, allocationDetails }) {
  const resultBlock = importResult
    ? `<section class="panel payroll-import-result fade-in">
        <div class="panel__body">
          <p class="${importResult.ok ? "text-pos" : "text-neg"}">${escapeHtml(importResult.message || "")}</p>
        </div>
      </section>`
    : "";

  const tableRows = rows.length
    ? rows
        .map(
          (r) => `<tr class="payroll-row payroll-row--${escapeHtml(r.status)}">
          <td>${escapeHtml(r.type_label)}</td>
          <td>${escapeHtml(r.period_label || r.period)}</td>
          <td><strong>${money(r.amount)}</strong></td>
          <td>${r.person_count != null ? r.person_count.toLocaleString("tr-TR") : "—"}</td>
          <td>${formatDateDisplay(r.due_date)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${formatDateDisplay(r.paid_date)}</td>
          <td>${escapeHtml(r.source_file_name || "Manuel")}</td>
          <td class="data-table__actions">
            ${
              r.status !== "paid"
                ? `<a href="/payroll/mark-paid/${r.id}" class="btn btn--sm btn--primary">Ödendi</a>`
                : `<a href="/payroll/mark-pending/${r.id}" class="btn btn--sm btn--ghost">Bekliyor</a>`
            }
            <a href="/payroll/delete/${r.id}" class="btn btn--sm btn--danger" onclick="return confirm('Kayıt silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="data-table__empty">SGK / Muhtasar kaydı yok.</td></tr>`;

  return `<div class="dash page-enter dash--dense payroll-hub">
    <header class="payroll-hub__header fade-in">
      <p class="payroll-hub__eyebrow">İnsan Kaynakları · Bordro Yükümlülükleri</p>
      <h2 class="payroll-hub__title">SGK & Muhtasar Takip Merkezi</h2>
      <p class="payroll-hub__desc">Muhasebeden gelen SGK Tahakkuk Fişi ve Muhtasar Tahakkuk Fişi PDF’lerini içe aktarın, vade ve ödeme durumunu izleyin.</p>
    </header>

    <div class="payroll-kpi-row fade-in">
      <article class="payroll-kpi"><span>Bekleyen SGK</span><strong>${money(kpi.pendingSgkAmount)}</strong></article>
      <article class="payroll-kpi"><span>Bekleyen Muhtasar</span><strong>${money(kpi.pendingMuhtasarAmount)}</strong></article>
      <article class="payroll-kpi payroll-kpi--warn"><span>Yaklaşan Vade</span><strong>${kpi.upcomingDueCount.toLocaleString("tr-TR")}</strong></article>
      <article class="payroll-kpi payroll-kpi--alert"><span>Geciken Ödeme</span><strong>${kpi.overdueCount.toLocaleString("tr-TR")}</strong></article>
    </div>

    ${resultBlock}

    <div class="grid2">
      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">PDF Import</h2></header>
        <div class="panel__body">
          <form method="POST" action="/payroll/import" enctype="multipart/form-data" class="form-grid">
            <select name="obligation_type">
              <option value="">Otomatik tespit</option>
              ${typeOptions()}
            </select>
            <input type="file" name="pdfFile" accept=".pdf,application/pdf" required class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">PDF İçe Aktar</button></div>
          </form>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head"><h2 class="panel__title">Manuel Kayıt</h2></header>
        <div class="panel__body">
          <form method="POST" action="/payroll/add" class="form-grid">
            <select name="obligation_type" required>${typeOptions()}</select>
            <input name="period" placeholder="Dönem (YYYY-MM veya MM/YYYY)" required/>
            ${moneyInputHtml("amount", { required: true, placeholder: "Tutar (örn. 27.695,66)" })}
            <input name="due_date" placeholder="Vade (GG/AA/YYYY veya YYYY-MM-DD)"/>
            <input type="number" name="person_count" min="0" placeholder="Kişi sayısı (SGK)"/>
            <input name="note" placeholder="Not" class="full"/>
            <div class="form-actions full"><button type="submit" class="btn btn--primary">Kaydet</button></div>
          </form>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Yükümlülük Listesi</h2>
          <p class="panel__desc">${rows.length} kayıt · Dağıtım sonrası kârlılığa yansır (HR-03)</p>
        </div>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table payroll-table">
          <thead><tr>
            <th>Tür</th><th>Dönem</th><th>Tutar</th><th>Kişi</th><th>Vade</th><th>Durum</th><th>Ödeme</th><th>Kaynak</th><th></th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>

    ${allocationCenterHtml({ allocSummary, unallocated, allocated, allocationDetails })}
  </div>`;
}

module.exports = {
  payrollPageHtml,
  allocationCenterHtml,
};
