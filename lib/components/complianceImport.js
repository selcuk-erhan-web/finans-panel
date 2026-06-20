const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { formatMoneyInputValue, moneyInputHtml } = require("../../utils/money");
const { COMPLIANCE_TYPES } = require("../../services/documentService");
const { IMPORTABLE_TYPES } = require("../../services/complianceImportService");

const IMPORT_TYPE_OPTIONS = [
  ["", "Otomatik tespit"],
  ["traffic_insurance", "Trafik Sigortası"],
  ["casco", "Kasko"],
  ["seat_insurance", "Koltuk Ferdi Kaza"],
  ["inspection", "Muayene (TÜVTÜRK)"],
];

function importTypeHintOptions(selected = "") {
  return IMPORT_TYPE_OPTIONS.map(
    ([k, label]) =>
      `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function complianceImportUploadHtml() {
  return `<section class="panel fade-in compliance-import-panel" id="complianceImportPanel">
    <header class="panel__head panel__head--compact">
      <div>
        <h2 class="panel__title">PDF'den Otomatik Evrak Aktar</h2>
        <p class="panel__desc">Trafik, kasko, koltuk ferdi kaza ve TÜVTÜRK muayene PDF'lerini yükleyin; bilgiler otomatik okunur.</p>
      </div>
    </header>
    <div class="panel__body panel__body--compact">
      <form method="POST" action="/documents/import/preview" enctype="multipart/form-data" class="compliance-import-upload" id="complianceImportUploadForm">
        <label class="hgs-upload-dropzone compliance-upload-dropzone" for="compliancePdfFileInput">
          <input type="file" name="pdfFile" id="compliancePdfFileInput" accept=".pdf,application/pdf" required class="hgs-upload-input"/>
          <span class="hgs-upload-dropzone__visual">
            <strong>PDF dosyası seçin</strong>
            <span>Trafik · Kasko · Koltuk · TÜVTÜRK muayene</span>
            <em class="hgs-upload-dropzone__file" id="complianceSelectedFileName">Henüz dosya seçilmedi</em>
          </span>
        </label>
        <div class="compliance-import-upload__meta">
          <label class="field-label">Tür ipucu (opsiyonel)</label>
          <select name="type_hint">${importTypeHintOptions("")}</select>
          <button type="submit" class="btn btn--primary">Önizleme Oluştur</button>
        </div>
      </form>
    </div>
  </section>
  <script>
  (function(){
    var input = document.getElementById("compliancePdfFileInput");
    var label = document.getElementById("complianceSelectedFileName");
    var zone = document.querySelector(".compliance-upload-dropzone");
    if (!input || !label) return;
    input.addEventListener("change", function(){
      var name = input.files && input.files[0] ? input.files[0] : null;
      label.textContent = name ? name.name : "Henüz dosya seçilmedi";
      if (zone) zone.classList.toggle("has-file", !!name);
    });
  })();
  </script>`;
}

function compliancePreviewHtml(preview, vehicles) {
  if (!preview) return "";
  const f = preview.fields || {};
  const token = preview.previewToken || "";
  const vehicleId = preview.vehicleMatch?.vehicleId || "";
  const docType = f.document_type || preview.detectedType || "";
  const isInsurance = ["traffic_insurance", "casco", "seat_insurance"].includes(docType);
  const isInspection = docType === "inspection";

  const issueVal = f.issue_date ? formatDateDisplay(f.issue_date) : "";
  const expiryVal = f.expiry_date ? formatDateDisplay(f.expiry_date) : "";
  const premiumVal = f.premium_amount != null ? formatMoneyInputValue(f.premium_amount) : "";
  const resultVal = f.result === "passed" ? "geçti" : f.result === "failed" ? "kaldı" : "";

  const warnings = (preview.warnings || [])
    .map((w) => `<li>${escapeHtml(w)}</li>`)
    .join("");
  const warnBlock = warnings
    ? `<ul class="compliance-preview-warnings">${warnings}</ul>`
    : "";

  const dupBlock = preview.duplicate?.isDuplicate
    ? `<p class="compliance-preview-dup">Mükerrer uyarısı: kayıt onayında engellenebilir.</p>`
    : "";

  const typeOptions = [...IMPORTABLE_TYPES]
    .map((k) => {
      const label = COMPLIANCE_TYPES[k] || k;
      return `<option value="${k}" ${k === docType ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");

  const vehicleOptions = (vehicles || [])
    .map(
      (v) =>
        `<option value="${v.id}" ${String(vehicleId) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
    )
    .join("");

  return `<section class="panel fade-in compliance-preview-panel" id="compliancePreviewPanel">
    <header class="panel__head panel__head--compact">
      <h2 class="panel__title">PDF Önizleme</h2>
      <p class="panel__desc">${escapeHtml(preview.filename || "belge.pdf")} · güven ${preview.overallConfidence ?? 0}%</p>
    </header>
    <div class="panel__body panel__body--compact">
      ${warnBlock}
      ${dupBlock}
      <form method="POST" action="/documents/import/confirm" class="compliance-preview-form" id="complianceConfirmForm">
        <input type="hidden" name="preview_token" value="${escapeHtml(token)}"/>
        <div class="compliance-preview-field">
          <label class="field-label">Araç</label>
          <select name="vehicle_id" required>
            <option value="">Araç seçin</option>
            ${vehicleOptions}
          </select>
        </div>
        <div class="compliance-preview-field">
          <label class="field-label">Evrak Türü</label>
          <select name="document_type" id="complianceImportDocType" required>${typeOptions}</select>
        </div>
        <div class="compliance-preview-field">
          <label class="field-label">Başlangıç / Düzenlenme</label>
          <input name="issue_date" value="${escapeHtml(issueVal === "—" ? "" : issueVal)}"/>
        </div>
        <div class="compliance-preview-field">
          <label class="field-label">Bitiş Tarihi</label>
          <input name="expiry_date" value="${escapeHtml(expiryVal === "—" ? "" : expiryVal)}"/>
        </div>
        <div class="compliance-preview-field" data-preview-insurance ${isInsurance ? "" : "hidden"}>
          <label class="field-label">Poliçe No</label>
          <input name="policy_number" value="${escapeHtml(f.policy_number || "")}"/>
        </div>
        <div class="compliance-preview-field" data-preview-insurance ${isInsurance ? "" : "hidden"}>
          <label class="field-label">Prim Tutarı</label>
          ${moneyInputHtml("premium_amount", { value: premiumVal, required: false, placeholder: "Prim", className: "money-input" })}
        </div>
        <div class="compliance-preview-field" data-preview-insurance ${isInsurance ? "" : "hidden"}>
          <label class="field-label">Sigorta Şirketi</label>
          <input name="insurer" value="${escapeHtml(f.insurer || "")}"/>
        </div>
        <div class="compliance-preview-field" data-preview-inspection ${isInspection ? "" : "hidden"}>
          <label class="field-label">İstasyon</label>
          <input name="station" value="${escapeHtml(f.station || "")}"/>
        </div>
        <div class="compliance-preview-field" data-preview-inspection ${isInspection ? "" : "hidden"}>
          <label class="field-label">Sonuç</label>
          <select name="result">
            <option value="">—</option>
            <option value="geçti" ${resultVal === "geçti" ? "selected" : ""}>Geçti</option>
            <option value="kaldı" ${resultVal === "kaldı" ? "selected" : ""}>Kaldı</option>
          </select>
        </div>
        <div class="compliance-preview-field compliance-preview-field--full">
          <label class="field-label">Not</label>
          <input name="note" value="${escapeHtml(f.note || "")}"/>
        </div>
        <div class="compliance-preview-actions">
          <button type="submit" formaction="/documents/import/cancel" class="btn btn--ghost btn--sm">İptal</button>
          <button type="submit" class="btn btn--primary btn--sm">Kaydet</button>
        </div>
      </form>
    </div>
  </section>
  <script>
  (function(){
    var typeEl = document.getElementById("complianceImportDocType");
    if (!typeEl) return;
    var INS = ["traffic_insurance","casco","seat_insurance"];
    function sync(){
      var t = typeEl.value;
      var isIns = INS.indexOf(t) !== -1;
      var isInsp = t === "inspection";
      document.querySelectorAll("[data-preview-insurance]").forEach(function(el){
        el.hidden = !isIns;
      });
      document.querySelectorAll("[data-preview-inspection]").forEach(function(el){
        el.hidden = !isInsp;
      });
    }
    typeEl.addEventListener("change", sync);
    sync();
  })();
  </script>`;
}

function complianceImportResultHtml({ ok, message, duplicate }) {
  const tone = ok ? "compliance-import-result--ok" : "compliance-import-result--err";
  return `<div class="compliance-import-result ${tone}">
    <strong>${ok ? "Belge kaydedildi" : "İçe aktarma başarısız"}</strong>
    <p>${escapeHtml(message || "")}</p>
    ${duplicate?.isDuplicate ? `<p class="compliance-preview-dup">Mükerrer uyarısı vardı.</p>` : ""}
  </div>`;
}

module.exports = {
  complianceImportUploadHtml,
  compliancePreviewHtml,
  complianceImportResultHtml,
  importTypeHintOptions,
};
