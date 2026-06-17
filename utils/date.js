/**
 * Tarih girişi: YYYY-MM-DD veya DD.MM.YYYY
 */
function parseDateInput(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }

  const tr = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (tr) {
    const day = tr[1].padStart(2, "0");
    const month = tr[2].padStart(2, "0");
    return `${tr[3]}-${month}-${day}`;
  }

  return null;
}

function parsePeriodInput(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{4})[/.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;

  return null;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

module.exports = {
  parseDateInput,
  parsePeriodInput,
  formatDateDisplay,
};
