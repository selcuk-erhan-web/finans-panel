const db = require("../lib/db");
const { normalizePlate } = require("../utils/plate");
const { resolveNameFromSlug } = require("../lib/expenseCategoryMap");
const { buildExpenseDedupKey, buildExpenseNote } = require("./hgsImportService");

const HGS_EXPENSE_SLUG = "hgs-ogs";

function findVehicleForPlate(plateNormalized, vehicles) {
  const target = normalizePlate(plateNormalized);
  if (!target) return null;
  for (const vehicle of vehicles || []) {
    const keys = [vehicle.plate_normalized, vehicle.plate]
      .map((p) => normalizePlate(p))
      .filter(Boolean);
    if (keys.includes(target)) return vehicle;
  }
  return null;
}

function hgsTxRowToPayload(row) {
  return {
    transaction_type: row.transaction_type,
    transaction_date: row.transaction_date,
    amount: row.amount,
    entry_point: row.entry_point,
    exit_point: row.exit_point,
    highway: row.highway,
  };
}

function expenseExists(dedupKey) {
  if (!dedupKey) return null;
  return db.prepare("SELECT id FROM transactions WHERE expense_dedup_key = ?").get(dedupKey) || null;
}

function insertHgsExpense({ vehicleId, amount, note, date, hgsTransactionId, dedupKey }) {
  const categoryName = resolveNameFromSlug(HGS_EXPENSE_SLUG);
  const expenseDate = date
    ? `${date} 12:00:00`
    : `${new Date().toISOString().slice(0, 10)} 12:00:00`;
  return db
    .prepare(
      `INSERT INTO transactions (
        vehicle_id, type, category, category_slug, amount, note, date,
        hgs_transaction_id, expense_dedup_key
      ) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicleId,
      categoryName,
      HGS_EXPENSE_SLUG,
      amount,
      note,
      expenseDate,
      hgsTransactionId,
      dedupKey
    );
}

function countUnmatchedReports() {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM hgs_reports
       WHERE vehicle_id IS NULL
         AND plate_normalized IS NOT NULL
         AND plate_normalized != ''`
    )
    .get().c;
}

function listUnmatchedReports() {
  return db
    .prepare(
      `SELECT id, plate_normalized, source_file_name, created_at
       FROM hgs_reports
       WHERE vehicle_id IS NULL
         AND plate_normalized IS NOT NULL
         AND plate_normalized != ''
       ORDER BY id`
    )
    .all();
}

/**
 * Link previously unmatched HGS reports/transactions to fleet vehicles by normalized plate.
 * Creates missing hgs-ogs expense rows using the same dedup keys as PDF import.
 */
function repairUnmatchedHgs({ dryRun = true } = {}) {
  const vehicles = db.prepare("SELECT * FROM vehicles ORDER BY id").all();
  const reports = db
    .prepare(
      `SELECT * FROM hgs_reports
       WHERE vehicle_id IS NULL
         AND plate_normalized IS NOT NULL
         AND plate_normalized != ''
       ORDER BY id`
    )
    .all();

  const result = {
    dryRun: !!dryRun,
    unmatchedReportsBefore: reports.length,
    unmatchedReportsAfter: reports.length,
    matchedReports: 0,
    stillUnmatched: 0,
    transactionsUpdated: 0,
    expensesCreated: 0,
    expensesLinked: 0,
    skippedDuplicates: 0,
    details: [],
    errors: [],
  };

  const run = () => {
    for (const report of reports) {
      const vehicle = findVehicleForPlate(report.plate_normalized, vehicles);
      if (!vehicle) {
        result.stillUnmatched += 1;
        result.details.push({
          reportId: report.id,
          plate: report.plate_normalized,
          status: "still_unmatched",
          reason: "no_fleet_vehicle",
        });
        continue;
      }

      let reportExpensesCreated = 0;
      let reportTxUpdated = 0;
      let reportSkipped = 0;

      if (!dryRun) {
        db.prepare("UPDATE hgs_reports SET vehicle_id = ? WHERE id = ?").run(vehicle.id, report.id);
      }
      result.matchedReports += 1;

      const txs = db
        .prepare("SELECT * FROM hgs_transactions WHERE report_id = ? ORDER BY id")
        .all(report.id);

      for (const tx of txs) {
        const payload = hgsTxRowToPayload(tx);
        const dedupKey = buildExpenseDedupKey(report.plate_normalized, payload);

        if (!dryRun) {
          db.prepare("UPDATE hgs_transactions SET vehicle_id = ? WHERE id = ?").run(vehicle.id, tx.id);
        }
        reportTxUpdated += 1;

        if (tx.expense_id) {
          reportSkipped += 1;
          continue;
        }

        const existing = expenseExists(dedupKey);
        if (existing) {
          if (!dryRun) {
            db.prepare("UPDATE hgs_transactions SET expense_id = ? WHERE id = ?").run(existing.id, tx.id);
          }
          result.expensesLinked += 1;
          reportSkipped += 1;
          continue;
        }

        if (!(Number(tx.amount) > 0 && tx.transaction_date)) {
          continue;
        }

        if (!dryRun) {
          try {
            const note = buildExpenseNote(payload, report.plate_normalized);
            const expenseInfo = insertHgsExpense({
              vehicleId: vehicle.id,
              amount: tx.amount,
              note,
              date: tx.transaction_date,
              hgsTransactionId: tx.id,
              dedupKey,
            });
            db.prepare("UPDATE hgs_transactions SET expense_id = ? WHERE id = ?").run(
              expenseInfo.lastInsertRowid,
              tx.id
            );
            reportExpensesCreated += 1;
          } catch (e) {
            if (String(e.message || "").includes("UNIQUE")) {
              reportSkipped += 1;
            } else {
              result.errors.push(`report ${report.id} tx ${tx.id}: ${e.message}`);
            }
          }
        } else {
          reportExpensesCreated += 1;
        }
      }

      result.transactionsUpdated += reportTxUpdated;
      result.expensesCreated += reportExpensesCreated;
      result.skippedDuplicates += reportSkipped;
      result.details.push({
        reportId: report.id,
        plate: report.plate_normalized,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        status: "matched",
        transactionsUpdated: reportTxUpdated,
        expensesCreated: reportExpensesCreated,
        skippedDuplicates: reportSkipped,
      });
    }

    result.unmatchedReportsAfter = dryRun
      ? Math.max(0, result.stillUnmatched)
      : countUnmatchedReports();
  };

  if (dryRun) {
    run();
  } else {
    db.transaction(run)();
  }

  return result;
}

module.exports = {
  findVehicleForPlate,
  repairUnmatchedHgs,
  countUnmatchedReports,
  listUnmatchedReports,
};
