const db = require("../lib/db");

function listReports(limit = 25) {
  return db
    .prepare(
      `SELECT r.*, v.plate AS vehicle_plate
       FROM hgs_reports r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .all(limit)
    .map((r) => ({
      ...r,
      matched: !!r.vehicle_id,
      period_label:
        r.period_start && r.period_end ? `${r.period_start} — ${r.period_end}` : "—",
    }));
}

function listHgsExpenses(limit = 50) {
  return db
    .prepare(
      `SELECT t.*, v.plate
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.type = 'expense' AND t.category_slug = 'hgs-ogs'
       ORDER BY t.date DESC, t.id DESC
       LIMIT ?`
    )
    .all(limit);
}

function getDashboardHgsSummary() {
  const totalReports = db.prepare("SELECT COUNT(*) AS c FROM hgs_reports").get().c;
  const latest = db
    .prepare(
      `SELECT r.*, v.plate AS vehicle_plate
       FROM hgs_reports r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       ORDER BY r.created_at DESC
       LIMIT 1`
    )
    .get();

  return {
    hasImport: totalReports > 0,
    totalReports,
    latest: latest
      ? {
          ...latest,
          matched: !!latest.vehicle_id,
          period_label:
            latest.period_start && latest.period_end
              ? `${latest.period_start} — ${latest.period_end}`
              : "—",
        }
      : null,
  };
}

module.exports = {
  listReports,
  listHgsExpenses,
  getDashboardHgsSummary,
};
