const { escapeHtml } = require("./escape");

const KPI_TONES = new Set(["success", "warning", "danger", "info", "neutral"]);

function executiveKpi({ label, value, meta = "", tone = "neutral" }) {
  const t = KPI_TONES.has(tone) ? tone : "neutral";
  const metaHtml = meta ? `<em class="executive-kpi__meta">${escapeHtml(meta)}</em>` : "";
  return `<article class="executive-kpi executive-kpi--${t}">
    <span class="executive-kpi__label">${escapeHtml(label)}</span>
    <strong class="executive-kpi__value">${value}</strong>
    ${metaHtml}
  </article>`;
}

function executiveKpiGrid(kpisHtml) {
  return `<section class="executive-kpi-grid fade-in" aria-label="Özet göstergeler">${kpisHtml}</section>`;
}

function executiveHubHeader({ eyebrow, description, tabsHtml = "" }) {
  return `<header class="executive-hub__header fade-in">
    <p class="executive-hub__eyebrow">${escapeHtml(eyebrow)}</p>
    ${description ? `<p class="executive-hub__description">${escapeHtml(description)}</p>` : ""}
    ${tabsHtml}
  </header>`;
}

module.exports = {
  executiveKpi,
  executiveKpiGrid,
  executiveHubHeader,
};
