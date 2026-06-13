/** Gelir kategori tanımları ve legacy eşleme */

const INCOME_CATEGORY_SEED = [
  {
    name: "Servis Gelirleri",
    slug: "service",
    pageTitle: "SERVİS GELİRLERİ",
    pageDesc: "Fabrika, okul ve personel taşıma operasyonlarından elde edilen gelirler",
    panelTitle: "Servis Geliri Yönetimi",
    description: "Fabrika, okul ve personel taşıma gelirleri",
    sort_order: 1,
    addLabel: "Yeni Servis Geliri",
  },
  {
    name: "Turizm Gelirleri",
    slug: "tourism",
    pageTitle: "TURİZM GELİRLERİ",
    pageDesc: "Transfer, tur ve organizasyon operasyon gelirleri",
    panelTitle: "Turizm Geliri Yönetimi",
    description: "Transfer, tur, VIP ve acente gelirleri",
    sort_order: 2,
    addLabel: "Yeni Turizm Geliri",
  },
  {
    name: "Diğer Gelirler",
    slug: "other",
    pageTitle: "DİĞER GELİRLER",
    pageDesc: "Sigorta ödemeleri, iadeler ve operasyon dışı gelirler",
    panelTitle: "Diğer Gelir Yönetimi",
    description: "Sigorta ödemesi, hurda/parça satışı, iade ve operasyon dışı gelirler",
    sort_order: 3,
    addLabel: "Yeni Diğer Gelir",
  },
];

const SLUG_BY_NAME = Object.fromEntries(INCOME_CATEGORY_SEED.map((c) => [c.name, c.slug]));

const LEGACY_CATEGORY_TO_SLUG = {
  "servis geliri": "service",
  "servis gelirleri": "service",
  servis: "service",
  service: "service",
  "turizm geliri": "tourism",
  "turizm gelirleri": "tourism",
  turizm: "tourism",
  tourism: "tourism",
  "diger gelir": "other",
  "diğer gelir": "other",
  "diger gelirler": "other",
  "diğer gelirler": "other",
  other: "other",
};

function normalizeKey(val) {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function normalizeIncomeSlug(category) {
  if (!category) return "other";
  const raw = String(category).trim();
  if (INCOME_CATEGORY_SEED.some((c) => c.slug === raw)) return raw;
  if (SLUG_BY_NAME[raw]) return SLUG_BY_NAME[raw];
  const key = normalizeKey(raw);
  if (LEGACY_CATEGORY_TO_SLUG[key]) return LEGACY_CATEGORY_TO_SLUG[key];
  return "other";
}

function resolveNameFromSlug(slug) {
  const found = INCOME_CATEGORY_SEED.find((c) => c.slug === normalizeIncomeSlug(slug));
  return found ? found.name : "Diğer Gelirler";
}

function getCategoryBySlug(slug) {
  const s = normalizeIncomeSlug(slug);
  return INCOME_CATEGORY_SEED.find((c) => c.slug === s) || INCOME_CATEGORY_SEED[2];
}

function getCategoryNames() {
  return INCOME_CATEGORY_SEED.map((c) => c.name);
}

/** Legacy constants uyumu */
function getLegacyCategoryNames() {
  return ["Servis Geliri", "Turizm Geliri", "Diğer Gelir"];
}

module.exports = {
  INCOME_CATEGORY_SEED,
  normalizeIncomeSlug,
  resolveNameFromSlug,
  getCategoryBySlug,
  getCategoryNames,
  getLegacyCategoryNames,
  SLUG_BY_NAME,
};
