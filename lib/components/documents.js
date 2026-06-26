const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { formatMoneyInputValue, moneyInputHtml } = require("../../utils/money");
const { renderModuleTabs } = require("./moduleTabs");
const { executiveKpi, executiveKpiGrid, executiveHubHeader } = require("./executiveDesign");
const { buildComplianceRiskSummary, complianceRiskSummaryPanel } = require("./executiveIntelligence");
const {
  COMPLIANCE_TYPES,
  DOCUMENT_TYPES,
  STATUS_LABELS,
  typeLabel,
} = require("../../services/documentService");
const {
  complianceImportUploadHtml,
  compliancePreviewHtml,
  complianceImportResultHtml,
} = require("./complianceImport");
const { entityAuditHistoryLink } = require("./auditLogs");

const INSURANCE_TYPE_KEYS = ["traffic_insurance", "casco", "seat_insurance"];
const TECHNICAL_TYPE_KEYS = ["inspection", "emission"];
const LICENSE_TYPE_KEYS = ["license", "license_note", "authorization_certificate"];

function statusBadge(status) {
  const map = {
    expired: "pill pill--red",
    critical: "pill pill--red",
    warning: "pill pill--amber",
    upcoming: "pill pill--blue",
    ok: "pill pill--green",
    no_date: "pill pill--muted",
  };
  const cls = map[status] || map.no_date;
  const label = STATUS_LABELS[status] || status;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function resultLabel(result) {
  if (!result) return "";
  if (result === "passed") return "Geçti";
  if (result === "failed") return "Kaldı";
  return String(result);
}

function companyOrStation(row) {
  return row.insurer || row.station || "—";
}

function policyOrResult(row) {
  if (row.policy_number) return row.policy_number;
  const rl = resultLabel(row.result);
  return rl || "—";
}

function complianceTypeOptions(selected = "") {
  const keys = new Set(Object.keys(COMPLIANCE_TYPES));
  if (selected && !keys.has(selected) && DOCUMENT_TYPES[selected]) {
    keys.add(selected);
  }
  return [...keys]
    .map((k) => {
      const label = typeLabel(k);
      return `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function typeOptions(selected = "") {
  return complianceTypeOptions(selected);
}

function documentsPageHtml({ kpi, upcoming, rows, vehicles, filters, editDoc, importPreview, importResult, path = "/documents" }) {
  const vehicleFilter = filters.vehicle_id || "";
  const selectedType = editDoc?.document_type || "";
  const importResultBlock = importResult ? complianceImportResultHtml(importResult) : "";
  const importPreviewBlock = importPreview ? compliancePreviewHtml(importPreview, vehicles) : "";

  const kpiCards = executiveKpiGrid(
    [
      executiveKpi({ label: "Süresi Geçen", value: String(kpi.expired), tone: "danger" }),
      executiveKpi({ label: "7 Gün İçinde", value: String(kpi.within7), tone: "danger" }),
      executiveKpi({ label: "30 Gün İçinde", value: String(kpi.within30), tone: "warning" }),
      executiveKpi({ label: "60 Gün İçinde", value: String(kpi.within60), tone: "info" }),
    ].join("")
  );

  const emptyState = `<tr><td colspan="8" class="data-table__empty executive-table__empty">
      FleetOS bu alan için veri bekliyor
      <span class="data-table__empty-hint">İlk sigorta, muayene veya egzoz kaydını oluşturun — risk analizi otomatik oluşacaktır.</span>
    </td></tr>`;

  const allRows = rows.length
    ? rows
        .map(
          (d) => `<tr>
          <td><a class="plate-link" href="/vehicle/${d.vehicle_id}">${escapeHtml(d.plate || "—")}</a></td>
          <td>${escapeHtml(d.type_label)}</td>
          <td>${formatDateDisplay(d.expiry_date)}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${escapeHtml(companyOrStation(d))}</td>
          <td>${escapeHtml(policyOrResult(d))}</td>
          <td>${escapeHtml(d.note || "—")}</td>
          <td class="data-table__actions">
            <a href="/documents/edit/${d.id}" class="btn btn--sm btn--ghost">Düzenle</a>
            <a href="/documents/delete/${d.id}" class="btn btn--sm btn--danger" onclick="return confirm('Evrak kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : emptyState;

  const formTitle = editDoc ? "Uygunluk kaydı düzenle" : "Manuel Evrak Kaydı";
  const formAction = editDoc ? `/documents/edit/${editDoc.id}` : "/documents/add";
  const selectedVehicle = editDoc ? String(editDoc.vehicle_id) : vehicleFilter;
  const issueValue = editDoc?.issue_date ? formatDateDisplay(editDoc.issue_date) : "";
  const expiryValue = editDoc?.expiry_date ? formatDateDisplay(editDoc.expiry_date) : "";
  const premiumValue = editDoc?.premium_amount != null ? formatMoneyInputValue(editDoc.premium_amount) : "";
  const resultValue =
    editDoc?.result === "passed" ? "geçti" : editDoc?.result === "failed" ? "kaldı" : editDoc?.result || "";

  const formPanel = `<section class="panel executive-panel executive-panel--form fade-in compliance-form-panel">
    <header class="panel__head executive-panel__head">
      <h2 class="panel__title executive-panel__title">${escapeHtml(formTitle)}</h2>
      ${
        editDoc
          ? entityAuditHistoryLink({
              module: "compliance",
              entity_type: "vehicle_document",
              entity_id: editDoc.id,
            })
          : ""
      }
    </header>
    <div class="panel__body executive-panel__body">
      <form method="POST" action="${formAction}" class="form-grid executive-form compliance-form" id="complianceEntryForm">
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

        <label class="field-label">Evrak Türü</label>
        <select name="document_type" id="complianceDocType" required>${complianceTypeOptions(selectedType)}</select>

        <label class="field-label">Başlangıç / Düzenlenme Tarihi</label>
        <input name="issue_date" placeholder="GG.AA.YYYY veya YYYY-MM-DD" value="${escapeHtml(issueValue === "—" ? "" : issueValue)}"/>

        <label class="field-label">Bitiş Tarihi</label>
        <input name="expiry_date" id="complianceExpiryDate" placeholder="GG.AA.YYYY veya YYYY-MM-DD" value="${escapeHtml(expiryValue === "—" ? "" : expiryValue)}"/>

        <div class="compliance-form__section full" id="complianceInsuranceFields" hidden>
          <p class="compliance-form__section-title">Sigorta Bilgileri</p>
          <div class="form-grid compliance-form__section-grid">
            <label class="field-label">Poliçe No</label>
            <input name="policy_number" placeholder="Poliçe numarası" value="${escapeHtml(editDoc?.policy_number || "")}"/>
            <label class="field-label">Sigorta Şirketi</label>
            <input name="insurer" placeholder="Sigorta şirketi" value="${escapeHtml(editDoc?.insurer || "")}"/>
            <label class="field-label">Prim Tutarı</label>
            ${moneyInputHtml("premium_amount", {
              value: premiumValue,
              required: false,
              placeholder: "Prim tutarı (örn. 12.500,00)",
              className: "money-input",
            })}
          </div>
        </div>

        <div class="compliance-form__section full" id="complianceTechnicalFields" hidden>
          <p class="compliance-form__section-title">Muayene / Egzoz</p>
          <div class="form-grid compliance-form__section-grid">
            <label class="field-label">İstasyon</label>
            <input name="station" placeholder="TÜVTÜRK / egzoz istasyonu" value="${escapeHtml(editDoc?.station || "")}"/>
            <label class="field-label">Sonuç</label>
            <select name="result">
              <option value="">Sonuç seçin</option>
              <option value="geçti" ${resultValue === "geçti" ? "selected" : ""}>Geçti</option>
              <option value="kaldı" ${resultValue === "kaldı" ? "selected" : ""}>Kaldı</option>
            </select>
          </div>
        </div>

        <div class="compliance-form__section full" id="complianceLicenseFields" hidden>
          <p class="compliance-form__section-title">Belge Bilgileri</p>
          <div class="form-grid compliance-form__section-grid">
            <label class="field-label">Belge No / Açıklama</label>
            <input name="title" placeholder="Ruhsat veya yetki belgesi no" value="${escapeHtml(editDoc?.title && editDoc.title !== editDoc.type_label ? editDoc.title : "")}"/>
          </div>
          <p class="compliance-form__hint" id="complianceLicenseHint">Ruhsat için bitiş tarihi opsiyoneldir.</p>
        </div>

        <label class="field-label full">Not</label>
        <input class="full" name="note" placeholder="Ek notlar" value="${escapeHtml(editDoc?.note || "")}"/>

        <div class="form-actions full">
          <button type="submit" class="btn btn--primary">${editDoc ? "Güncelle" : "Kaydet"}</button>
          ${editDoc ? `<a href="/documents" class="btn btn--ghost">İptal</a>` : ""}
        </div>
      </form>
    </div>
  </section>`;

  const complianceFormScript = `<script>
(function () {
  var typeEl = document.getElementById("complianceDocType");
  var insuranceEl = document.getElementById("complianceInsuranceFields");
  var technicalEl = document.getElementById("complianceTechnicalFields");
  var licenseEl = document.getElementById("complianceLicenseFields");
  var licenseHint = document.getElementById("complianceLicenseHint");
  if (!typeEl) return;

  var INSURANCE = ${JSON.stringify(INSURANCE_TYPE_KEYS)};
  var TECHNICAL = ${JSON.stringify(TECHNICAL_TYPE_KEYS)};
  var LICENSE = ${JSON.stringify(LICENSE_TYPE_KEYS)};

  function syncComplianceForm() {
    var t = typeEl.value || "";
    if (insuranceEl) insuranceEl.hidden = INSURANCE.indexOf(t) === -1;
    if (technicalEl) technicalEl.hidden = TECHNICAL.indexOf(t) === -1;
    if (licenseEl) licenseEl.hidden = LICENSE.indexOf(t) === -1;
    if (licenseHint) {
      if (t === "authorization_certificate") {
        licenseHint.textContent = "Yetki belgesi için bitiş tarihi önerilir.";
      } else {
        licenseHint.textContent = "Ruhsat için bitiş tarihi opsiyoneldir.";
      }
    }
  }

  typeEl.addEventListener("change", syncComplianceForm);
  syncComplianceForm();
})();
</script>`;

  const complianceRisk = buildComplianceRiskSummary({ kpi, upcoming });
  complianceRisk.upcomingRowsHtml = upcoming.length
    ? `<div class="executive-risk-upcoming">
        <h3 class="executive-risk-upcoming__title">Yaklaşan Evraklar</h3>
        <div class="table-wrap executive-table-wrap executive-table-wrap--compact">
          <table class="data-table data-table--compact executive-table">
            <thead><tr>
              <th>Araç</th><th>Tür</th><th>Bitiş</th><th>Durum</th>
            </tr></thead>
            <tbody>${upcoming
              .slice(0, 8)
              .map(
                (d) => `<tr>
              <td><a class="plate-link" href="/vehicle/${d.vehicle_id}">${escapeHtml(d.plate || "—")}</a></td>
              <td>${escapeHtml(d.type_label)}</td>
              <td>${formatDateDisplay(d.expiry_date)}</td>
              <td>${statusBadge(d.status)}</td>
            </tr>`
              )
              .join("")}</tbody>
          </table>
        </div>
      </div>`
    : "";

  const riskPanel = complianceRiskSummaryPanel(complianceRisk);

  return `<div class="dash page-enter dash--executive executive-hub documents-hub compliance-hub">
    ${executiveHubHeader({
      eyebrow: "Filo · Uygunluk",
      description: "Sigorta, muayene, egzoz ve araç evrak takibi",
      tabsHtml: renderModuleTabs("compliance", path),
    })}

    <div class="grid2 grid2--executive documents-hub__entry-grid">
      <div class="documents-hub__left-stack">
        ${importResultBlock}
        ${importPreviewBlock || complianceImportUploadHtml()}
        ${formPanel}
      </div>
      ${riskPanel}
    </div>

    ${kpiCards}

    <section class="panel executive-panel executive-panel--table fade-in">
      <header class="panel__head executive-panel__head">
        <div>
          <h2 class="panel__title executive-panel__title">Tüm Evraklar</h2>
          <p class="panel__desc executive-panel__subtitle">${
            rows.length ? `${rows.length} kayıt görüntüleniyor` : "Veri bekleniyor — ilk evrak kaydı sonrası liste dolacak"
          }</p>
        </div>
        <form class="filters" method="GET" action="/documents">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <a href="/documents" class="btn btn--ghost btn--sm">Temizle</a>
        </form>
      </header>
      <div class="panel__body executive-panel__body">
        <div class="table-wrap executive-table-wrap">
        <table class="data-table executive-table">
          <thead><tr>
            <th>Araç</th><th>Evrak Türü</th><th>Bitiş</th><th>Durum</th><th>Şirket / İstasyon</th><th>Poliçe / Sonuç</th><th>Not</th><th>İşlem</th>
          </tr></thead>
          <tbody>${allRows}</tbody>
        </table>
        </div>
      </div>
    </section>
  </div>${complianceFormScript}`;
}

module.exports = {
  documentsPageHtml,
  statusBadge,
  typeOptions,
  complianceTypeOptions,
  resultLabel,
  companyOrStation,
  policyOrResult,
  INSURANCE_TYPE_KEYS,
  TECHNICAL_TYPE_KEYS,
  LICENSE_TYPE_KEYS,
};
