const db = require("../lib/db");
const {
  INCOME_CATEGORY_SEED,
  normalizeIncomeSlug,
  resolveNameFromSlug,
  getCategoryBySlug,
  getCategoryNames,
} = require("../lib/incomeCategoryMap");

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function getAllCategories() {
  const rows = db
    .prepare(
      `SELECT * FROM income_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
    )
    .all();
  if (rows.length) return rows;
  return INCOME_CATEGORY_SEED.map((c, i) => ({
    id: i + 1,
    ...c,
    is_system: 1,
    is_active: 1,
  }));
}

function resolveCategoryInput(input) {
  const raw = String(input || "").trim();
  const byDb = getAllCategories().find((c) => c.name === raw || c.slug === raw);
  if (byDb) return { name: byDb.name, slug: byDb.slug };
  const slug = normalizeIncomeSlug(raw);
  return { name: resolveNameFromSlug(slug), slug };
}

/** Dashboard gelir KPI beslemesi için hazır toplamlar */
function getDashboardIncomeTotals() {
  const rows = db
    .prepare(`SELECT category, category_slug, amount FROM transactions WHERE type = 'income'`)
    .all();
  const totals = { service: 0, tourism: 0, other: 0 };
  rows.forEach((r) => {
    const slug = normalizeIncomeSlug(r.category_slug || r.category);
    if (totals[slug] != null) totals[slug] += safeAmount(r.amount);
    else totals.other += safeAmount(r.amount);
  });
  return totals;
}

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  getCategoryNames,
  resolveCategoryInput,
  normalizeIncomeSlug,
  getDashboardIncomeTotals,
};
