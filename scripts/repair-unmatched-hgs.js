/**
 * Retroactive HGS plate matching — dry-run by default.
 *
 * node scripts/repair-unmatched-hgs.js
 * node scripts/repair-unmatched-hgs.js --apply
 */
const path = require("path");
const {
  repairUnmatchedHgs,
  listUnmatchedReports,
  countUnmatchedReports,
} = require("../services/hgsRetroMatchService");

function printSummary(label, result) {
  console.log(`\n--- ${label} ---`);
  console.log("Mode:", result.dryRun ? "DRY-RUN" : "APPLY");
  console.log("Unmatched reports (before):", result.unmatchedReportsBefore);
  console.log("Matched reports:", result.matchedReports);
  console.log("Still unmatched:", result.stillUnmatched);
  console.log("Unmatched reports (after):", result.unmatchedReportsAfter);
  console.log("HGS transactions updated:", result.transactionsUpdated);
  console.log("Expense transactions created:", result.expensesCreated);
  console.log("Expenses linked (existing dedup):", result.expensesLinked);
  console.log("Skipped duplicates:", result.skippedDuplicates);
  if (result.errors.length) {
    console.log("Errors:", result.errors);
  }
}

function main() {
  const apply = process.argv.includes("--apply");
  const productionDb = path.resolve(__dirname, "..", "data.db");
  process.env.FLEETOS_DB_PATH = productionDb;

  const db = require("../lib/db");
  if (path.resolve(db.DB_PATH) !== productionDb) {
    console.error("Unexpected database path:", db.DB_PATH);
    process.exit(1);
  }

  console.log("=== FleetOS HGS retroactive matching ===");
  console.log("Database:", db.DB_PATH);

  const beforeList = listUnmatchedReports();
  console.log("\nUnmatched reports now:", countUnmatchedReports());
  if (beforeList.length) {
    beforeList.forEach((r) => {
      console.log(
        `  #${r.id} plate=${r.plate_normalized} file=${r.source_file_name || "—"} at=${r.created_at}`
      );
    });
  } else {
    console.log("  (none)");
  }

  if (!apply) {
    const preview = repairUnmatchedHgs({ dryRun: true });
    printSummary("Planned actions", preview);
    if (preview.details.length) {
      console.log("\nReport details:");
      preview.details.forEach((d) => console.log(" ", JSON.stringify(d)));
    }
    console.log("\nDry-run complete. Re-run with --apply to backup and execute.");
    return;
  }

  const { backupDatabase } = require("../utils/backup");
  const backupPath = backupDatabase();
  console.log("\nBackup created:", backupPath);

  const result = repairUnmatchedHgs({ dryRun: false });
  printSummary("Applied", result);
  if (result.details.length) {
    console.log("\nReport details:");
    result.details.forEach((d) => console.log(" ", JSON.stringify(d)));
  }
  console.log("\nRetroactive HGS matching completed.");
}

main();
