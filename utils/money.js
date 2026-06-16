const { parseTrNumber } = require("./numbers");

const INVALID_AMOUNT_MSG = "Tutar geçerli değil";

/**
 * Manuel tutar alanı → sayı (null = geçersiz/boş).
 * 42.357,00 · 153.662,50 · 42357 · ₺42.357,00 · 42.357 TL
 */
function parseMoneyInput(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let s = String(value).trim();
  if (!s) return null;

  s = s.replace(/₺/g, "").replace(/\btl\b/gi, "").replace(/\s+/g, " ").trim();
  if (!/\d/.test(s)) return null;

  const stripped = s.replace(/[^\d.,\-–—]/g, "");
  if (!stripped || !/\d/.test(stripped)) return null;
  if (/^[.\-,–—]+$/.test(stripped)) return null;

  const n = parseTrNumber(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseMoneyInputRequired(value, { allowZero = false, round = true } = {}) {
  const n = parseMoneyInput(value);
  if (n == null || (!allowZero && n <= 0)) {
    throw new Error(INVALID_AMOUNT_MSG);
  }
  return round ? Math.round(n) : n;
}

/** Düzenleme formlarında gösterim */
function formatMoneyInputValue(amount) {
  if (amount == null || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const MONEY_INPUT_ATTRS = 'type="text" inputmode="decimal" autocomplete="off"';

function moneyInputHtml(name, { value = "", placeholder = "Tutar (örn. 42.357,00)", required = true, id = "", className = "" } = {}) {
  const req = required ? " required" : "";
  const idAttr = id ? ` id="${id}"` : "";
  const cls = className ? ` class="${className}"` : "";
  const val = value != null && value !== "" ? ` value="${String(value).replace(/"/g, "&quot;")}"` : "";
  return `<input name="${name}" ${MONEY_INPUT_ATTRS}${idAttr}${cls}${val} placeholder="${placeholder}"${req} />`;
}

module.exports = {
  INVALID_AMOUNT_MSG,
  parseMoneyInput,
  parseMoneyInputRequired,
  formatMoneyInputValue,
  moneyInputHtml,
  MONEY_INPUT_ATTRS,
};
