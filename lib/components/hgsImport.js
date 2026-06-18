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
  const imported = result.ok && !result.duplicate;
  const matched = !!result.vehicleMatched;
  const expenseCreated = expenseCount > 0;

  const pipeline = `<div class="hgs-status-pipeline" aria-label="Import durumu">
    <span class="hgs-pipe ${imported ? "hgs-pipe--ok" : "hgs-pipe--err"}">1 · ${imported ? "İçe aktarıldı" : "İçe aktarılamadı"}</span>
    <span class="hgs-pipe ${matched ? "hgs-pipe--ok" : imported ? "hgs-pipe--warn" : "hgs-pipe--muted"}">2 · ${matched ? "Plaka eşleşti" : "Plaka eşleşmedi"}</span>
    <span class="hgs-pipe ${expenseCreated ? "hgs-pipe--ok" : matched ? "hgs-pipe--warn" : "hgs-pipe--muted"}">3 · ${expenseCreated ? "Gider oluşturuldu" : "Gider oluşturulmadı"}</span>
  </div>`;

  const expenseExplain =
    imported && !expenseCreated
      ? `<p class="hgs-expense-hint">${matched ? "Gider satırı oluşmadı — satırlar mükerrer olabilir veya tutar sıfır." : "Eşleşen araç bulunamadı. HGS satırları kaydedildi ancak <strong>gider yazılmadı</strong>. <a href=\"/vehicles\">Araçlar</a> modülünden plakayı ekleyin (ör. boşluklu format: 16 S 4605)."}</p>`
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
      <div><span>Toplam satır</span><strong>${Number(totalRows).toLocaleString("tr-TR")}</strong></div>
      <div><span>Başarılı gider kaydı</span><strong>${Number(expenseCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Mükerrer atlanan</span><strong>${Number(skippedCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Hata sayısı</span><strong>${Number(errorCount).toLocaleString("tr-TR")}</strong></div>
      <div><span>Geçiş toplamı</span><strong>${money(result.passage_total || 0)}</strong></div>
      <div><span>Yükleme toplamı</span><strong>${money(result.loading_total || 0)}</strong></div>
      <div><span>HGS satır kaydı</span><strong>${Number(result.insertedCount || 0).toLocaleString("tr-TR")}</strong></div>
    </div>
    ${pipeline}
    ${expenseExplain}
    ${unmatched}
    ${warnings}
    ${errors}
  </div>`;
}

function hgsImportFormHtml() {
  return `<div class="hgs-workflow-steps" aria-label="HGS içe aktarma adımları">
    <div class="hgs-workflow-step hgs-workflow-step--active"><span>1</span> PDF Seç</div>
    <div class="hgs-workflow-step"><span>2</span> İçe Aktar</div>
    <div class="hgs-workflow-step"><span>3</span> Sonuç</div>
  </div>
  <form id="hgsPdfImportForm" method="POST" action="/hgs/import" enctype="multipart/form-data" class="fuel-import-form hgs-import-form">
    <label class="hgs-upload-dropzone" for="hgsPdfFileInput" id="hgsUploadDropzone">
      <input
        type="file"
        name="pdfFile"
        id="hgsPdfFileInput"
        accept=".pdf,application/pdf"
        required
        class="hgs-upload-input"
      />
      <span class="hgs-upload-dropzone__visual">
        <strong>PDF dosyası seçin</strong>
        <span>İş Bankası HGS ekstre · .pdf · tıklayın veya sürükleyin</span>
        <em class="hgs-upload-dropzone__file" id="hgsSelectedFileName">Henüz dosya seçilmedi</em>
      </span>
    </label>
    <p class="hgs-upload-hint">Adım 1: PDF seçin · Adım 2: <strong>PDF İçe Aktar</strong> butonuna basın</p>
    <button type="submit" class="btn btn--primary btn--lg hgs-submit-btn">PDF İçe Aktar</button>
  </form>
  <script>
    (function(){
      var input = document.getElementById("hgsPdfFileInput");
      var label = document.getElementById("hgsSelectedFileName");
      var zone = document.getElementById("hgsUploadDropzone");
      if (!input || !label) return;
      input.addEventListener("change", function(){
        var name = input.files && input.files[0] ? input.files[0].name : "Henüz dosya seçilmedi";
        label.textContent = name;
        if (zone) zone.classList.toggle("has-file", !!(input.files && input.files[0]));
      });
    })();
  </script>`;
}

function hgsReportsTableHtml(reports) {
  if (!reports.length) {
    return `<div class="empty empty--rich empty--sm">
      <div class="empty__ring">🛣️</div>
      <h3>Henüz HGS PDF içe aktarılmadı</h3>
      <p>Yukarıdan İş Bankası ekstre PDF yükleyin. Geçiş ve yükleme satırları burada listelenir.</p>
    </div>`;
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
        <td>${r.matched ? `<span class="pill pill--green">Eşleşti</span>` : `<span class="pill pill--amber" title="Araç bulunamadı — gider yazılmaz">Eşleşmedi</span>`}</td>
        <td>${r.expense_count > 0 ? `<span class="pill pill--green">${Number(r.expense_count)} gider</span>` : `<span class="pill pill--muted">Gider yok</span>`}</td>
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
          <th>Gider</th>
          <th>Import</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function hgsExpensesTableHtml(expenses) {
  if (!expenses.length) {
    return `<div class="empty empty--rich empty--sm">
      <div class="empty__ring">💳</div>
      <h3>Henüz HGS/OGS gider kaydı yok</h3>
      <p>PDF içe aktarıldığında plaka filodaki bir araçla eşleşirse giderler otomatik yazılır. Eşleşme yoksa satırlar kaydedilir ancak gider oluşmaz.</p>
      <div class="empty__action"><a href="/vehicles" class="btn btn--ghost btn--sm">Araç Ekle</a></div>
    </div>`;
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
  hgsImportFormHtml,
  hgsReportsTableHtml,
  hgsExpensesTableHtml,
};
