const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function hakedisImportPanelHtml() {
  return `<section class="fuel-import-card hakedis-import-card" id="import-hakedis">
    <div class="fuel-import-header">
      <div>
        <p class="eyebrow">Taşeron Tahakkuk</p>
        <h2>Hakediş PDF İçe Aktar</h2>
        <p>Taşeron tahakkuk PDF dosyasından servis gelirlerini araçlara otomatik dağıtır.</p>
      </div>
    </div>
    <form method="POST" action="/income/service/import" enctype="multipart/form-data" class="fuel-import-form">
      <label class="fuel-dropzone">
        <input type="file" name="pdfFile" accept=".pdf,application/pdf" required />
        <strong>PDF dosyasını seç</strong>
        <span>Örn. MİSTUR PERSONEL.pdf · yalnızca .pdf</span>
      </label>
      <button type="submit" class="btn btn-primary">PDF İçe Aktar</button>
    </form>
  </section>`;
}

function hakedisImportResultHtml(result) {
  if (!result) return "";
  const tone = result.duplicate
    ? "hgs-import-result--warn"
    : result.ok
      ? "hgs-import-result--ok"
      : "hgs-import-result--err";
  const title = result.duplicate
    ? "Mükerrer PDF"
    : result.ok
      ? "Hakediş PDF içe aktarıldı"
      : "İçe aktarma başarısız";

  const recon = result.reconciliation || {};
  const diff = recon.diff != null ? money(recon.diff) : "—";
  const reconOk =
    recon.ok === true ? "Uyumlu" : recon.ok === false ? "Fark var" : "—";

  const unmatched =
    result.unmatchedList?.length > 0
      ? `<p class="hakedis-unmatched">Eşleşmeyen son 4 hane: ${result.unmatchedList.map((s) => `<code>${escapeHtml(s)}</code>`).join(", ")}</p>`
      : result.unmatchedVehicles > 0
        ? `<p class="hakedis-unmatched">${Number(result.unmatchedVehicles)} araç satırı eşleşmedi.</p>`
        : "";

  return `<div class="hgs-import-result ${tone}">
    <div class="hgs-import-result__head">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(result.message || result.filename || "")}</p>
    </div>
    <div class="hgs-import-result__grid">
      <div><span>Dosya</span><strong>${escapeHtml(result.filename || "—")}</strong></div>
      <div><span>Dönem</span><strong>${escapeHtml(result.period || "—")}</strong></div>
      <div><span>Firma / Hat</span><strong>${escapeHtml(result.company || "—")}</strong></div>
      <div><span>Okunan satır</span><strong>${Number(result.totalRows || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Araç gelir satırı</span><strong>${Number(result.vehicleRows || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Ek gelir satırı</span><strong>${Number(result.extraRows || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Eklenen kayıt</span><strong>${Number(result.imported || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Mükerrer atlanan</span><strong>${Number(result.skippedDuplicate || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Eşleşen araç</span><strong>${Number(result.matchedVehicles || 0).toLocaleString("tr-TR")}</strong></div>
      <div><span>Hesaplanan toplam</span><strong>${money(result.calculatedTotal || 0)}</strong></div>
      <div><span>PDF hakediş toplamı</span><strong>${result.pdfHakedisTotal != null ? money(result.pdfHakedisTotal) : "—"}</strong></div>
      <div><span>Mutabakat farkı</span><strong>${diff}</strong></div>
      <div><span>Mutabakat</span><strong>${reconOk}</strong></div>
    </div>
    ${unmatched}
    ${result.errors?.length ? `<ul class="hgs-import-errors">${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : ""}
  </div>`;
}

module.exports = {
  hakedisImportPanelHtml,
  hakedisImportResultHtml,
};
