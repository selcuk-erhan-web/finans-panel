const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function hgsImportResultHtml(result) {
  if (!result) return "";
  const tone = result.duplicate ? "hgs-import-result--warn" : result.ok ? "hgs-import-result--ok" : "hgs-import-result--err";
  const title = result.duplicate
    ? "Mükerrer PDF"
    : result.ok
      ? "HGS PDF içe aktarıldı"
      : "İçe aktarma başarısız";

  const unmatched =
    result.unmatchedPlates?.length > 0
      ? `<p class="hgs-unmatched">Eşleşmeyen plaka: ${result.unmatchedPlates.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")}</p>`
      : !result.vehicleMatched && result.plate && result.plate !== "—"
        ? `<p class="hgs-unmatched">Eşleşmeyen plaka: <code>${escapeHtml(result.plate)}</code></p>`
        : "";

  const warnings =
    result.warnings?.length
      ? `<ul class="hgs-import-warnings">${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
      : "";
  const errors =
    result.errors?.length
      ? `<ul class="hgs-import-errors">${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

  const totalRows = result.totalRows ?? result.insertedCount ?? 0;
  const expenseCount = result.expenseCount ?? 0;
  const skippedCount = result.skippedCount ?? 0;
  const errorCount = result.errorCount ?? (result.errors?.length || 0);

  return `<div class="hgs-import-result ${tone}">
    <div class="hgs-import-result__head">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(result.message || result.filename || "")}</p>
    </div>
    <div class="hgs-import-result__grid">
      <div><span>Dosya</span><strong>${escapeHtml(result.filename || "—")}</strong></div>
      <div><span>Plaka</span><strong>${escapeHtml(result.plate || "—")}</strong></div>
      <div><span>HGS No</span><strong>${escapeHtml(result.hgs_no || "—")}</strong></div>
      <div><span>Dönem</span><strong>${escapeHtml(result.period || "—")}</strong></div>
      <div><span>Araç eşleşmesi</span><strong>${result.vehicleMatched ? "Eşleşti" : "Eşleşmedi"}</strong></div>
      <div><span>Toplam satır</span><strong>${Number(totalRows).toLocaleString("tr-TR")}</strong></div>
      <div><span>Başarılı gider kaydı</span><strong>${Number(expenseCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Mükerrer atlanan</span><strong>${Number(skippedCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Hata sayısı</span><strong>${Number(errorCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Geçiş toplamı</span><strong>${money(result.passage_total || 0)}</strong></div>
      <div><span>Yükleme toplamı</span><strong>${money(result.loading_total || 0)}</strong></div>
      <div><span>HGS satır kaydı</span><strong>${Number(result.insertedCount || 0).toLocaleString("tr-TR")}</strong></div>
    </div>
    ${unmatched}
    ${warnings}
    ${errors}
  </div>`;
}

function hgsReportsTableHtml(reports) {
  if (!reports.length) {
    return `<div class="empty empty--sm"><p>Henüz HGS PDF içe aktarılmadı.</p></div>`;
  }

  const rows = reports
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.plate_normalized || "—")}</td>
        <td>${escapeHtml(r.hgs_no || "—")}</td>
        <td>${escapeHtml(r.period_label || "—")}</td>
        <td class="text-neg"><strong>${money(r.passage_total || 0)}</strong></td>
        <td><strong>${money(r.loading_total || 0)}</strong></td>
        <td>${Number(r.passage_count || 0).toLocaleString("tr-TR")}</td>
        <td>${r.matched ? `<span class="pill pill--green">Eşleşti</span>` : `<span class="pill pill--amber">Eşleşmedi</span>`}</td>
        <td>${escapeHtml(String(r.created_at || "").slice(0, 16))}</td>
      </tr>`
    )
    .join("");

  return `<div class="table-scroller">
    <table class="data-table hgs-reports-table">
      <thead>
        <tr>
          <th>Plaka</th>
          <th>HGS No</th>
          <th>Dönem</th>
          <th>Geçiş Toplamı</th>
          <th>Yükleme Toplamı</th>
          <th>Geçiş Adedi</th>
          <th>Eşleşme</th>
          <th>Import</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function hgsExpensesTableHtml(expenses) {
  if (!expenses.length) {
    return `<div class="empty empty--sm"><p>Henüz HGS/OGS gider kaydı yok. PDF içe aktarınca eşleşen araçlara otomatik yazılır.</p></div>`;
  }

  const rows = expenses
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.plate || "—")}</td>
        <td class="text-neg"><strong>${money(t.amount)}</strong></td>
        <td>${escapeHtml(t.note || "—")}</td>
        <td>${escapeHtml(String(t.date || "").slice(0, 10))}</td>
      </tr>`
    )
    .join("");

  return `<div class="table-scroller">
    <table class="data-table hgs-expenses-table">
      <thead>
        <tr>
          <th>Araç</th>
          <th>Tutar</th>
          <th>Açıklama</th>
          <th>Tarih</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

module.exports = {
  hgsImportResultHtml,
  hgsReportsTableHtml,
  hgsExpensesTableHtml,
};
