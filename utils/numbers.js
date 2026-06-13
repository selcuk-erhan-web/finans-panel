/** Türkçe sayı formatı → JS number (parseFloat kullanmadan güvenli dönüşüm) */
function parseTrNumber(val) {
  if (val === "" || val == null) return 0;
  if (typeof val === "number" && Number.isFinite(val)) return val;

  let s = String(val).trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!s || s === "-" || s === ".") return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseTrMoney(val) {
  return Math.round(parseTrNumber(val));
}

module.exports = { parseTrNumber, parseTrMoney };
