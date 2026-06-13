const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { navSlugForCategory } = require("../expenseCategoryMap");

function expenseCategoryGrid(categories) {
  if (!categories.length) {
    return `<div class="empty empty--sm"><p>Gider kategorisi bulunamadı.</p></div>`;
  }

  const cards = categories
    .map(
      (c) => `<a class="expense-cat-card" href="/expenses?category=${encodeURIComponent(navSlugForCategory(c.slug))}">
        <span class="expense-cat-card__icon" aria-hidden="true">${escapeHtml(c.icon || "📦")}</span>
        <span class="expense-cat-card__body">
          <strong class="expense-cat-card__name">${escapeHtml(c.name)}</strong>
          <span class="expense-cat-card__desc">${escapeHtml(c.description || "")}</span>
        </span>
        <span class="expense-cat-card__stats">
          <span class="expense-cat-card__stat"><em>Toplam</em><strong>${money(c.total)}</strong></span>
          <span class="expense-cat-card__stat"><em>30 gün</em><strong>${money(c.total30)}</strong></span>
          <span class="expense-cat-card__stat"><em>Kayıt</em><strong>${Number(c.count).toLocaleString("tr-TR")}</strong></span>
        </span>
      </a>`
    )
    .join("");

  return `<section class="expense-cat-grid fade-in">${cards}</section>`;
}

module.exports = { expenseCategoryGrid };
