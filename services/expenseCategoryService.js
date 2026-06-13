const db = require("../lib/db");
const {
  EXPENSE_CATEGORY_SEED,
  OPERATIONAL_SLUGS,
  resolveSlugFromCategory,
  resolveNameFromSlug,
  getCategoryNames,
} = require("../lib/expenseCategoryMap");

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getAllCategories() {
  const rows = db
    .prepare(
      `SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
    )
    .all();
  if (rows.length) return rows;
  return EXPENSE_CATEGORY_SEED.map((c, i) => ({ id: i + 1, ...c, is_system: 1, is_active: 1 }));
}

function getTransactionAgg() {
  const rows = db
    .prepare(
      `SELECT id, category, category_slug, amount, date FROM transactions WHERE type = 'expense'`
    )
    .all();
  const since = daysAgoIso(30);
  const bySlug = {};

  rows.forEach((r) => {
    const slug = r.category_slug || resolveSlugFromCategory(r.category);
    if (!bySlug[slug]) bySlug[slug] = { total: 0, total30: 0, count: 0, count30: 0 };
    const amt = safeAmount(r.amount);
    bySlug[slug].total += amt;
    bySlug[slug].count += 1;
    const d = String(r.date || "").slice(0, 10);
    if (d >= since) {
      bySlug[slug].total30 += amt;
      bySlug[slug].count30 += 1;
    }
  });

  return bySlug;
}

function getHgsAgg() {
  const since = daysAgoIso(30);
  const all = db
    .prepare(
      `SELECT amount, transaction_date FROM hgs_transactions WHERE transaction_type = 'passage'`
    )
    .all();
  let total = 0;
  let total30 = 0;
  let count = all.length;
  let count30 = 0;
  all.forEach((r) => {
    const amt = safeAmount(r.amount);
    total += amt;
    const d = String(r.transaction_date || "").slice(0, 10);
    if (d >= since) {
      total30 += amt;
      count30 += 1;
    }
  });
  return { total, total30, count, count30 };
}

function getMaintenanceAgg() {
  const since = daysAgoIso(30);
  const rows = db
    .prepare(
      `SELECT COALESCE(amount, cost, 0) AS amt, COALESCE(service_date, substr(created_at,1,10)) AS d FROM maintenance_records`
    )
    .all();
  let total = 0;
  let total30 = 0;
  let count = rows.length;
  let count30 = 0;
  rows.forEach((r) => {
    const amt = safeAmount(r.amt);
    total += amt;
    const d = String(r.d || "").slice(0, 10);
    if (d >= since) {
      total30 += amt;
      count30 += 1;
    }
  });
  return { total, total30, count, count30 };
}

function mergeAgg(base, extra) {
  return {
    total: (base?.total || 0) + (extra?.total || 0),
    total30: (base?.total30 || 0) + (extra?.total30 || 0),
    count: (base?.count || 0) + (extra?.count || 0),
    count30: (base?.count30 || 0) + (extra?.count30 || 0),
  };
}

function getCategorySummaries() {
  const txAgg = getTransactionAgg();
  const hgsAgg = getHgsAgg();
  const maintAgg = getMaintenanceAgg();

  return getAllCategories().map((cat) => {
    let stats = txAgg[cat.slug] || { total: 0, total30: 0, count: 0, count30: 0 };
    if (cat.slug === "hgs-ogs") stats = mergeAgg(stats, hgsAgg);
    if (cat.slug === "bakim-onarim") stats = mergeAgg(stats, maintAgg);
    return {
      ...cat,
      total: stats.total,
      total30: stats.total30,
      count: stats.count,
      count30: stats.count30,
    };
  });
}

function getDashboardOpsSummary() {
  const summaries = getCategorySummaries();
  const bySlug = Object.fromEntries(summaries.map((s) => [s.slug, s]));
  const empty = { total: 0, total30: 0, count: 0, count30: 0, name: "" };

  let other = { ...empty, name: "Diğer Giderler" };
  summaries.forEach((s) => {
    if (!OPERATIONAL_SLUGS.includes(s.slug)) {
      other.total += s.total30;
      other.count += s.count30;
    }
  });

  return {
    yakit: bySlug.yakit || { ...empty, name: "Yakıt" },
    hgs: bySlug["hgs-ogs"] || { ...empty, name: "HGS / OGS" },
    bakim: bySlug["bakim-onarim"] || { ...empty, name: "Bakım & Onarım" },
    other,
  };
}

function resolveCategoryInput(categoryInput) {
  const raw = String(categoryInput || "").trim();
  const byDb = getAllCategories().find((c) => c.name === raw || c.slug === raw);
  if (byDb) return { name: byDb.name, slug: byDb.slug };
  const slug = resolveSlugFromCategory(raw);
  return { name: resolveNameFromSlug(slug), slug };
}

function isValidCategoryName(name) {
  return getAllCategories().some((c) => c.name === name);
}

module.exports = {
  getAllCategories,
  getCategorySummaries,
  getDashboardOpsSummary,
  getCategoryNames,
  resolveSlugFromCategory,
  resolveNameFromSlug,
  resolveCategoryInput,
  isValidCategoryName,
  OPERATIONAL_SLUGS,
};
