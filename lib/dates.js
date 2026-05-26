function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getThisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { date_from: formatDate(from), date_to: formatDate(now) };
}

function getLastMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { date_from: formatDate(from), date_to: formatDate(to) };
}

function getLast30DaysRange() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return { date_from: formatDate(from), date_to: formatDate(now) };
}

const PERIOD_PRESETS = {
  this_month: getThisMonthRange,
  last_month: getLastMonthRange,
  last_30: getLast30DaysRange,
};

function resolveQueryDates(query) {
  const resolved = { ...query };
  if (query.period && PERIOD_PRESETS[query.period]) {
    const range = PERIOD_PRESETS[query.period]();
    resolved.date_from = range.date_from;
    resolved.date_to = range.date_to;
  }
  return resolved;
}

module.exports = {
  formatDate,
  getThisMonthRange,
  getLastMonthRange,
  getLast30DaysRange,
  resolveQueryDates,
  PERIOD_KEYS: Object.keys(PERIOD_PRESETS),
};
