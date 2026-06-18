const { escapeHtml } = require("./escape");

function setupCallout({ title, message, steps = [], actions = "" }) {
  const stepsHtml = steps.length
    ? `<ol class="setup-callout__steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
    : "";
  return `<aside class="setup-callout fade-in" role="status">
    <div class="setup-callout__icon" aria-hidden="true">ℹ️</div>
    <div class="setup-callout__body">
      <h3 class="setup-callout__title">${escapeHtml(title)}</h3>
      <p class="setup-callout__msg">${escapeHtml(message)}</p>
      ${stepsHtml}
      ${actions ? `<div class="setup-callout__actions">${actions}</div>` : ""}
    </div>
  </aside>`;
}

function dashboardSetupBanner({ vehicleCount = 0, incomeCount = 0, expenseCount = 0, hgsReportCount = 0 }) {
  if (vehicleCount > 0 && incomeCount > 0 && expenseCount > 0) return "";

  const steps = [];
  if (vehicleCount === 0) {
    steps.push("Araçlar modülünden filo kayıtlarını oluşturun (plaka HGS PDF ile eşleşmeli).");
  }
  if (incomeCount === 0) {
    steps.push("Gelirler üzerinden servis/turizm geliri veya hakediş PDF içe aktarın.");
  }
  if (expenseCount === 0) {
    steps.push("Giderler, Yakıt veya HGS modülünden operasyonel gider kaydı girin.");
  }
  if (hgsReportCount > 0 && vehicleCount === 0) {
    steps.push("HGS import mevcut ancak araç eşleşmediği için gider yazılmadı — plakayı filoya ekleyin.");
  }

  const actions = `<a href="/vehicles" class="btn btn--primary btn--sm">Araç Ekle</a>
    <a href="/income/service" class="btn btn--ghost btn--sm">Gelir / Hakediş</a>
    <a href="/hgs" class="btn btn--ghost btn--sm">HGS</a>`;

  return setupCallout({
    title: "Kurulum aşaması — veri eksik",
    message:
      vehicleCount === 0
        ? "KPI değerleri sıfır görünüyor çünkü henüz araç kaydı yok. Sistem çalışıyor; filo verisini tamamladığınızda özet otomatik dolacak."
        : "Bazı finansal göstergeler araç ve işlem verisi bekliyor. Aşağıdaki adımlarla operasyonu başlatın.",
    steps,
    actions,
  });
}

function kpiZeroHint(label, reason, href, linkLabel) {
  return `<p class="kpi-zero-hint" title="${escapeHtml(reason)}">
    ${escapeHtml(label)}: <span>${escapeHtml(reason)}</span>
    ${href ? `<a href="${href}">${escapeHtml(linkLabel)}</a>` : ""}
  </p>`;
}

module.exports = {
  setupCallout,
  dashboardSetupBanner,
  kpiZeroHint,
};
