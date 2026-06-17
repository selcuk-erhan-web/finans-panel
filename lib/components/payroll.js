const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatDateDisplay } = require("../../utils/date");
const { moneyInputHtml } = require("../../utils/money");
const { TYPE_LABELS, STATUS_LABELS } = require("../../services/payrollObligationService");

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

function payrollPageHtml({ kpi, rows, importResult }) {
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

  return `<div class="dash page-enter payroll-hub">
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
          <p class="panel__desc">${rows.length} kayıt · SGK/Muhtasar araç kârlılığına dağıtılmaz (HR-03)</p>
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
  </div>`;
}

module.exports = {
  payrollPageHtml,
};
