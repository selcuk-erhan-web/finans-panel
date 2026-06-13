/** Gider kategori tanımları ve legacy eşleme — DB bağımsız */

const EXPENSE_CATEGORY_SEED = [
  { name: "Yakıt", slug: "yakit", icon: "⛽", description: "Akaryakıt ve yakıt giderleri", sort_order: 1 },
  { name: "Bakım & Onarım", slug: "bakim-onarim", icon: "🛠️", description: "Periyodik bakım, onarım ve servis giderleri", sort_order: 2 },
  { name: "HGS / OGS", slug: "hgs-ogs", icon: "🛣️", description: "Otoyol geçiş ve HGS/OGS giderleri", sort_order: 3 },
  { name: "Personel", slug: "personel", icon: "👨‍✈️", description: "Şoför, personel maaş ve yan hak giderleri", sort_order: 4 },
  { name: "Sigorta ve Vergiler", slug: "sigorta-vergiler", icon: "🛡️", description: "Sigorta, vergi, muayene ve resmi yükümlülükler", sort_order: 5 },
  { name: "Lastik", slug: "lastik", icon: "🛞", description: "Lastik alımı ve değişim giderleri", sort_order: 6 },
  { name: "Trafik Cezaları", slug: "trafik-cezalari", icon: "🚨", description: "Trafik cezası ve ihlal giderleri", sort_order: 7 },
  { name: "Temizlik & Yıkama", slug: "temizlik-yikama", icon: "🧽", description: "Araç temizlik, yıkama ve hijyen giderleri", sort_order: 8 },
  { name: "Teknoloji ve Takip Sistemleri", slug: "teknoloji-takip", icon: "📱", description: "Takip cihazı, yazılım ve teknoloji giderleri", sort_order: 9 },
  { name: "Genel İşletme Giderleri", slug: "genel-isletme", icon: "🏢", description: "Ofis, idari ve genel işletme giderleri", sort_order: 10 },
  { name: "Diğer", slug: "diger", icon: "📦", description: "Sınıflandırılmayan diğer giderler", sort_order: 11 },
];

const SLUG_BY_NAME = Object.fromEntries(EXPENSE_CATEGORY_SEED.map((c) => [c.name, c.slug]));

const LEGACY_CATEGORY_TO_SLUG = {
  yakıt: "yakit",
  yakit: "yakit",
  bakım: "bakim-onarim",
  bakim: "bakim-onarim",
  "bakım & onarım": "bakim-onarim",
  "hgs/ogs": "hgs-ogs",
  "hgs / ogs": "hgs-ogs",
  sigorta: "sigorta-vergiler",
  kasko: "sigorta-vergiler",
  muayene: "sigorta-vergiler",
  lastik: "lastik",
  ceza: "trafik-cezalari",
  diğer: "diger",
  diger: "diger",
};

const OPERATIONAL_SLUGS = ["yakit", "hgs-ogs", "bakim-onarim"];

/** URL / nav alias → canonical DB slug */
const SLUG_ALIASES = {
  "sigorta-ve-vergiler": "sigorta-vergiler",
};

function normalizeExpenseSlug(slug) {
  const raw = String(slug || "").trim();
  if (!raw) return "";
  if (EXPENSE_CATEGORY_SEED.some((c) => c.slug === raw)) return raw;
  if (SLUG_ALIASES[raw]) return SLUG_ALIASES[raw];
  return resolveSlugFromCategory(raw);
}

function navSlugForCategory(slug) {
  const canonical = normalizeExpenseSlug(slug);
  if (canonical === "sigorta-vergiler") return "sigorta-ve-vergiler";
  return canonical;
}

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

function resolveSlugFromCategory(category) {
  if (!category) return "diger";
  const raw = String(category).trim();
  if (SLUG_ALIASES[raw]) return SLUG_ALIASES[raw];
  if (EXPENSE_CATEGORY_SEED.some((c) => c.slug === raw)) return raw;
  if (SLUG_BY_NAME[raw]) return SLUG_BY_NAME[raw];
  const key = normalizeKey(raw);
  if (LEGACY_CATEGORY_TO_SLUG[key]) return LEGACY_CATEGORY_TO_SLUG[key];
  if (SLUG_BY_NAME[raw]) return SLUG_BY_NAME[raw];
  return "diger";
}

function resolveNameFromSlug(slug) {
  const found = EXPENSE_CATEGORY_SEED.find((c) => c.slug === slug);
  return found ? found.name : "Diğer";
}

function getCategoryNames() {
  return EXPENSE_CATEGORY_SEED.map((c) => c.name);
}

module.exports = {
  EXPENSE_CATEGORY_SEED,
  OPERATIONAL_SLUGS,
  SLUG_ALIASES,
  normalizeExpenseSlug,
  navSlugForCategory,
  resolveSlugFromCategory,
  resolveNameFromSlug,
  getCategoryNames,
  SLUG_BY_NAME,
};
