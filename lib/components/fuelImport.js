const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { glassPanel } = require("./table");
const { normalizePlate, formatPlateDisplay } = require("../../utils/plate");

function vehicleLinkOptions(vehicles) {
  return (vehicles || [])
    .map((v) => `<option value="${v.id}">${escapeHtml(v.plate)}</option>`)
    .join("");
}

function unmatchedPlateRow(plate, vehicles, batchId = "") {
  const normalized = normalizePlate(plate);
  const normHint =
    normalized && normalized !== normalizePlate(formatPlateDisplay(plate))
      ? `<span class="fuel-plate-norm" title="Normalize plaka">${escapeHtml(normalized)}</span>`
      : normalized
        ? `<span class="fuel-plate-norm" title="Normalize plaka">${escapeHtml(normalized)}</span>`
        : "";
  return `<li class="fuel-unmatched-item" data-plate="${escapeHtml(plate)}">
    <div class="fuel-unmatched-plate">
      <code>${escapeHtml(plate)}</code>
      ${normHint}
    </div>
    <div class="fuel-unmatched-actions">
      <select class="fuel-link-select" aria-label="Araç seç">
        <option value="">Mevcut araç…</option>
        ${vehicleLinkOptions(vehicles)}
      </select>
      <button type="button" class="btn btn--sm btn--primary fuel-link-btn" data-batch="${batchId || ""}">Bağla</button>
      <button type="button" class="btn btn--sm btn--ghost fuel-create-vehicle-btn" data-plate="${escapeHtml(plate)}" data-batch="${batchId || ""}">Yeni araç</button>
    </div>
  </li>`;
}

function unmatchedPlatesPanelHtml(plates, vehicles, batchId = null, title = "Eşleşmeyen plakalar") {
  if (!plates?.length) return "";
  const rows = plates.map((p) => unmatchedPlateRow(p, vehicles, batchId || "")).join("");
  return `<section class="fuel-unmatched-panel fade-in">
    <div class="fuel-unmatched-panel__head">
      <h3>${escapeHtml(title)}</h3>
      <p>${plates.length} plaka araç kaydına bağlanmayı bekliyor. Mevcut araca bağlayın veya yeni araç oluşturun.</p>
    </div>
    <ul class="fuel-unmatched-list fuel-unmatched-list--actions">${rows}</ul>
  </section>`;
}

function fuelImportPanelBody(prefillResultHtml = "") {
  const resultBlock = prefillResultHtml
    ? `<div id="fuelImportResult" class="fuel-import-result">${prefillResultHtml}</div>`
    : `<div id="fuelImportResult" class="fuel-import-result" hidden></div>`;

  return `${resultBlock}
    <form id="fuelImportForm" class="fuel-import-form" enctype="multipart/form-data" action="/fuel/import" method="post">
      <div class="fuel-drop" id="fuelDropZone" role="button" tabindex="0" aria-label="Excel dosyası yükle">
        <input type="file" name="excelFile" id="fuelFileInput" accept=".xlsx,.xls" />
        <div class="fuel-drop__visual">
          <div class="fuel-drop__icon-wrap" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4"/>
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
            </svg>
          </div>
          <span class="fuel-drop__text" id="fuelDropLabel">Dosyayı sürükleyip bırakın</span>
          <span class="fuel-drop__hint">Dokum (SatisListesi) · Yakıt Alım Raporu · .xlsx / .xls · max 20 MB</span>
        </div>
      </div>
      <div class="fuel-import-progress" id="fuelImportProgress" hidden>
        <div class="fuel-import-progress__bar"><div class="fuel-import-progress__fill" id="fuelProgressFill"></div></div>
        <span class="fuel-import-progress__label" id="fuelProgressLabel">Yükleniyor…</span>
      </div>
      <p class="fuel-import-formats">
        <span class="fuel-import-formats__label">Desteklenen format:</span>
        Arkpet / Shell / UTTS Excel
      </p>
      <div class="fuel-import-options">
        <label class="filter-check fuel-import-opt">
          <input type="checkbox" name="auto_create_vehicle" value="1"/> Eşleşmeyen plakalar için otomatik araç oluştur
        </label>
        <label class="filter-check fuel-import-opt">
          <input type="checkbox" name="sync_expense" value="1" checked/> Gider kaydı oluştur (Yakıt)
        </label>
      </div>
      <div class="fuel-import-btn-row">
        <button type="button" class="btn btn--ghost btn--lg" id="fuelPickBtn">Excel seç</button>
        <button type="submit" class="btn btn--primary btn--lg fuel-import-submit" id="fuelImportBtn" disabled>
          İçe aktar
        </button>
      </div>
    </form>`;
}

function fuelImportPanel(prefillResultHtml = "") {
  return glassPanel({
    title: "Yakıt Excel İçe Aktar",
    desc: "Arkpet / Shell / UTTS Excel raporları desteklenir",
    className: "panel--glass fuel-import-panel fuel-import-panel--hero",
    action: '<span class="fuel-import-panel__badge">UTTS</span>',
    body: fuelImportPanelBody(prefillResultHtml),
  });
}

function fuelImportCard(prefill) {
  return fuelImportPanel(prefill);
}

function fuelImportDualFormHtml() {
  return `<form method="POST" action="/fuel/import" enctype="multipart/form-data" class="fuel-import-form">
    <div class="fuel-import-dual">
      <label class="fuel-dropzone fuel-dropzone--detail">
        <input type="file" name="detailFile" accept=".xlsx,.xls" required />
        <strong>Detay Excel (Dokum)</strong>
        <span>Dokum-10.06.2026.xlsx — satır satır yakıt alımları</span>
      </label>
      <label class="fuel-dropzone fuel-dropzone--control">
        <input type="file" name="controlFile" accept=".xlsx,.xls" />
        <strong>Kontrol / Mutabakat Excel (opsiyonel)</strong>
        <span>Yakıt Alım Raporu — toplam litre/tutar doğrulama</span>
      </label>
    </div>
    <div class="fuel-import-options">
      <label class="filter-check fuel-import-opt">
        <input type="checkbox" name="auto_create_vehicle" value="1"/> Eşleşmeyen plakalar için otomatik araç oluştur
      </label>
      <label class="filter-check fuel-import-opt">
        <input type="checkbox" name="sync_expense" value="1" checked/> Gider kaydı oluştur (Yakıt)
      </label>
    </div>
    <button type="submit" class="btn btn-primary">İçe Aktar</button>
  </form>`;
}

function reconciliationResultHtml(reconciliation) {
  if (!reconciliation) return "";
  const ok = reconciliation.ok;
  const statusClass = ok ? "fuel-recon--ok" : "fuel-recon--warn";
  const statusLabel = ok ? "Mutabakat uyumlu" : "Mutabakat farkı var";

  const plateRows = (reconciliation.plateDiffs || [])
    .slice(0, 12)
    .map(
      (p) => `<tr>
        <td><code>${escapeHtml(p.plate)}</code></td>
        <td>${Number(p.detailLiters).toLocaleString("tr-TR")} L</td>
        <td>${Number(p.controlLiters).toLocaleString("tr-TR")} L</td>
        <td class="${p.literDiff ? "text-warn" : ""}">${Number(p.literDiff).toLocaleString("tr-TR")} L</td>
        <td>${money(p.detailAmount)}</td>
        <td>${money(p.controlAmount)}</td>
        <td class="${p.amountDiff ? "text-warn" : ""}">${money(p.amountDiff)}</td>
      </tr>`
    )
    .join("");

  const plateTable =
    plateRows &&
    `<div class="fuel-recon-plates">
      <h4>Plaka bazlı farklar</h4>
      <div class="data-table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr>
            <th>Plaka</th><th>Detay L</th><th>Kontrol L</th><th>Fark L</th>
            <th>Detay ₺</th><th>Kontrol ₺</th><th>Fark ₺</th>
          </tr></thead>
          <tbody>${plateRows}</tbody>
        </table>
      </div>
    </div>`;

  return `<section class="fuel-recon-panel ${statusClass}">
    <div class="fuel-recon-panel__head">
      <strong>${escapeHtml(statusLabel)}</strong>
      <span class="fuel-recon-badge">${ok ? "✓" : "!"}</span>
    </div>
    <div class="fuel-recon-grid">
      <div class="fuel-recon-row">
        <span>Detay toplam litre</span>
        <strong>${Number(reconciliation.detailLiters).toLocaleString("tr-TR")} L</strong>
      </div>
      <div class="fuel-recon-row">
        <span>Kontrol toplam litre</span>
        <strong>${Number(reconciliation.controlLiters).toLocaleString("tr-TR")} L</strong>
      </div>
      <div class="fuel-recon-row">
        <span>Litre farkı</span>
        <strong class="${Math.abs(reconciliation.literDiff) > 0.05 ? "text-warn" : ""}">${Number(reconciliation.literDiff).toLocaleString("tr-TR")} L</strong>
      </div>
      <div class="fuel-recon-row">
        <span>Detay toplam tutar</span>
        <strong>${money(reconciliation.detailAmount)}</strong>
      </div>
      <div class="fuel-recon-row">
        <span>Kontrol toplam tutar</span>
        <strong>${money(reconciliation.controlAmount)}</strong>
      </div>
      <div class="fuel-recon-row">
        <span>Tutar farkı</span>
        <strong class="${Math.abs(reconciliation.amountDiff) > 1 ? "text-warn" : ""}">${money(reconciliation.amountDiff)}</strong>
      </div>
    </div>
    ${plateTable || '<p class="fuel-recon-ok-note">Plaka bazlı fark yok.</p>'}
  </section>`;
}

function fuelImportResultHtml(result, vehicles = []) {
  const stats = [
    ["Okunan satır", result.totalRows, ""],
    ["Eklenen kayıt", result.imported, "text-pos"],
    ["Mükerrer atlanan", result.skippedDuplicate, ""],
    ["Eşleşen plaka", result.matchedPlates ?? 0, ""],
    ["Eşleşmeyen plaka", result.unmatchedPlates, result.unmatchedPlates ? "text-warn" : ""],
    ["Toplam litre", `${Number(result.totalLiters).toLocaleString("tr-TR")} L`, ""],
    ["Toplam tutar", money(result.totalAmount), "text-neg"],
  ];
  const grid = stats
    .map(
      ([label, val, cls]) =>
        `<div class="fuel-result-stat">
          <span class="fuel-result-stat__label">${escapeHtml(label)}</span>
          <strong class="fuel-result-stat__value ${cls}">${escapeHtml(String(val))}</strong>
        </div>`
    )
    .join("");

  const unmatchedBlock =
    result.unmatchedList?.length > 0
      ? unmatchedPlatesPanelHtml(
          result.unmatchedList,
          vehicles,
          result.batchId,
          "Eşleşmeyen plakalar — bu import"
        )
      : "";

  const fileLine = [
    result.filename ? `Detay: ${result.filename}` : "",
    result.controlFilename ? `Kontrol: ${result.controlFilename}` : "",
    result.format ? `(${result.format})` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div class="fuel-import-result__inner fade-in">
    <div class="fuel-import-result__head">
      <span class="fuel-import-result__ok">✓</span>
      <div>
        <strong>İçe aktarma tamamlandı</strong>
        <p>${escapeHtml(fileLine)}</p>
      </div>
    </div>
    <div class="fuel-result-grid">${grid}</div>
    ${reconciliationResultHtml(result.reconciliation)}
    ${unmatchedBlock}
    ${result.errors?.length ? `<p class="fuel-import-errors">${result.errors.length} satırda hata oluştu.</p>` : ""}
  </div>`;
}

function fuelUnmatchedScript() {
  return `<script>
(function(){
  function toast(msg, type) {
    if (window.showToast) window.showToast(msg, type);
    else alert(msg);
  }
  async function postJson(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(function(){ return {}; });
    if (!r.ok || !data.ok) throw new Error(data.message || "İşlem başarısız");
    return data;
  }
  document.querySelectorAll(".fuel-link-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      var row = btn.closest(".fuel-unmatched-item");
      if (!row) return;
      var plate = row.dataset.plate;
      var sel = row.querySelector(".fuel-link-select");
      var vehicleId = sel && sel.value;
      if (!vehicleId) { toast("Lütfen bir araç seçin.", "error"); return; }
      btn.disabled = true;
      try {
        var out = await postJson("/fuel/import/link-vehicle", {
          plate: plate,
          vehicle_id: Number(vehicleId),
          batch_id: btn.dataset.batch ? Number(btn.dataset.batch) : null,
        });
        toast(plate + " → " + out.linked + " kayıt bağlandı", "success");
        row.remove();
      } catch (e) {
        toast(e.message, "error");
        btn.disabled = false;
      }
    });
  });
  document.querySelectorAll(".fuel-create-vehicle-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      var plate = btn.dataset.plate;
      var row = btn.closest(".fuel-unmatched-item");
      if (!confirm(plate + " için yeni araç oluşturulsun mu?")) return;
      btn.disabled = true;
      try {
        var out = await postJson("/fuel/import/create-vehicle", {
          plate: plate,
          batch_id: btn.dataset.batch ? Number(btn.dataset.batch) : null,
        });
        toast(plate + " → " + out.linked + " kayıt bağlandı", "success");
        if (row) row.remove();
      } catch (e) {
        toast(e.message, "error");
        btn.disabled = false;
      }
    });
  });
})();
</script>`;
}

module.exports = {
  fuelImportPanel,
  fuelImportPanelBody,
  fuelImportCard,
  fuelImportDualFormHtml,
  fuelImportResultHtml,
  reconciliationResultHtml,
  unmatchedPlatesPanelHtml,
  fuelUnmatchedScript,
};
