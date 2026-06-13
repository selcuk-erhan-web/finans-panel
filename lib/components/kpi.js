const { escapeHtml } = require("./escape");

function metricCard({ label, value, hint, desc, tone = "neutral", icon = "" }) {
  const description = desc || hint;
  const meta = hint && desc && hint !== desc ? hint : "";
  return `<article class="metric metric--${tone} fade-in">
    <div class="metric__top">
      ${icon ? `<div class="metric__icon metric__icon--glow metric__icon--${tone}" aria-hidden="true">${icon}</div>` : ""}
      <span class="metric__label">${escapeHtml(label)}</span>
    </div>
    <div class="metric__value">${value}</div>
    ${description ? `<p class="metric__desc">${escapeHtml(description)}</p>` : ""}
    ${meta ? `<p class="metric__hint">${escapeHtml(meta)}</p>` : ""}
  </article>`;
}

function metricGrid(cards, cols = "5") {
  return `<div class="metric-grid metric-grid--executive metric-grid--${cols} fade-in" style="--delay:40ms">${cards.join("")}</div>`;
}

module.exports = { metricCard, metricGrid };
