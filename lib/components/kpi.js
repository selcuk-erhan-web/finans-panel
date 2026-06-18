const { escapeHtml } = require("./escape");
const { money } = require("../finance");

const KPI_EMPTY_HTML = `<span class="kpi-empty">
  <strong class="kpi-empty__title">Henüz veri bulunmuyor</strong>
  <span class="kpi-empty__lines">İlk kaydı oluşturun · Veri geldikçe analiz üretilecektir</span>
</span>`;

function isKpiEmpty(value) {
  return value == null || Number(value) === 0;
}

function kpiValueHtml(value, { format = "money" } = {}) {
  const n = Number(value) || 0;
  if (n === 0) return KPI_EMPTY_HTML;
  if (format === "count") return n.toLocaleString("tr-TR");
  return money(n);
}

function metricCard({ label, value, amount, hint, desc, tone = "neutral", icon = "" }) {
  const displayValue = amount !== undefined ? kpiValueHtml(amount) : value;
  const hasData = amount !== undefined ? !isKpiEmpty(amount) : true;
  const description = hasData ? desc || hint : undefined;
  const meta = hasData && hint && desc && hint !== desc ? hint : "";
  const emptyClass = hasData ? "" : " metric--empty";

  return `<article class="metric metric--${tone}${emptyClass} fade-in">
    <div class="metric__top">
      ${icon ? `<div class="metric__icon metric__icon--glow metric__icon--${tone}" aria-hidden="true">${icon}</div>` : ""}
      <span class="metric__label">${escapeHtml(label)}</span>
    </div>
    <div class="metric__value">${displayValue}</div>
    ${description ? `<p class="metric__desc">${escapeHtml(description)}</p>` : ""}
    ${meta ? `<p class="metric__hint">${escapeHtml(meta)}</p>` : ""}
  </article>`;
}

function metricGrid(cards, cols = "5") {
  return `<div class="metric-grid metric-grid--executive metric-grid--${cols} fade-in" style="--delay:40ms">${cards.join("")}</div>`;
}

module.exports = { metricCard, metricGrid, kpiValueHtml, isKpiEmpty, KPI_EMPTY_HTML };
