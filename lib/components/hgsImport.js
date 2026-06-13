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

  const warnings =
    result.warnings?.length
      ? `<ul class="hgs-import-warnings">${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
      : "";
  const errors =
    result.errors?.length
      ? `<ul class="hgs-import-errors">${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

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
      <div><span>Geçiş adedi</span><strong>${Number(result.passage_count || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Yükleme adedi</span><strong>${Number(result.loading_count || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Geçiş toplamı</span><strong>${money(result.passage_total || 0)}</strong></div>
      <div><span>Yükleme toplamı</span><strong>${money(result.loading_total || 0)}</strong></div>
      <div><span>Eklenen satır</span><strong>${Number(result.insertedCount || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Atlanan mükerrer</span><strong>${Number(result.skippedCount || 0).toLocaleString("tr-TR")}</strong></div>
    </div>
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

module.exports = {
  hgsImportResultHtml,
  hgsReportsTableHtml,
};
