/**
 * Manual cleanup for test-polluted duplicate 16S4605 vehicles in data.db.
 * Dry-run by default — pass --apply to execute after backup.
 *
 * node scripts/cleanup-duplicate-test-vehicles.js
 * node scripts/cleanup-duplicate-test-vehicles.js --apply
 */
const path = require("path");

const TARGET_NORMALIZED = "16S4605";

const VEHICLE_FK_TABLES = [
  { table: "transactions", column: "vehicle_id" },
  { table: "fuel_records", column: "vehicle_id" },
  { table: "maintenance_records", column: "vehicle_id" },
  { table: "vehicle_documents", column: "vehicle_id" },
  { table: "employees", column: "vehicle_id" },
  { table: "employee_monthly_costs", column: "vehicle_id" },
  { table: "subcontractor_payments", column: "related_vehicle_id" },
  { table: "payroll_allocations", column: "vehicle_id" },
  { table: "hgs_transactions", column: "vehicle_id" },
  { table: "hgs_reports", column: "vehicle_id" },
];

function isTestPollutionVehicle(vehicle) {
  const plate = String(vehicle.plate || "").trim();
  return (
    plate === "16S4605" &&
    String(vehicle.brand || "") === "Mercedes" &&
    String(vehicle.model || "") === "Sprinter"
  );
}

function tableExists(db, table) {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  return !!row;
}

function countLinkedRows(db, table, column, vehicleId) {
  if (!tableExists(db, table)) return 0;
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) return 0;
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${column} = ?`).get(vehicleId).c;
}

function summarizeVehicles(db, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT id, plate, plate_normalized, brand, model, year, type, date
       FROM vehicles WHERE id IN (${placeholders}) ORDER BY id`
    )
    .all(...ids);
}

function main() {
  const apply = process.argv.includes("--apply");
  const productionDb = path.resolve(__dirname, "..", "data.db");
  process.env.FLEETOS_DB_PATH = productionDb;

  const { normalizePlate } = require("../utils/plate");
  const db = require("../lib/db");

  if (path.resolve(db.DB_PATH) !== productionDb) {
    console.error("Unexpected database path:", db.DB_PATH);
    process.exit(1);
  }

  const allVehicles = db.prepare("SELECT * FROM vehicles ORDER BY id").all();
  const targetGroup = allVehicles.filter((v) => {
    const norm = v.plate_normalized || normalizePlate(v.plate);
    return norm === TARGET_NORMALIZED;
  });

  console.log("=== FleetOS duplicate test vehicle cleanup ===");
  console.log("Database:", db.DB_PATH);
  console.log("Mode:", apply ? "APPLY (will modify data)" : "DRY-RUN (no changes)");
  console.log("Target normalized plate:", TARGET_NORMALIZED);
  console.log("Vehicles matching normalized plate:", targetGroup.length);

  if (targetGroup.length <= 1) {
    console.log("\nNo duplicate group found — nothing to do.");
    return;
  }

  const canonical = targetGroup.reduce((a, b) => (Number(a.id) < Number(b.id) ? a : b));
  const duplicateCandidates = targetGroup.filter((v) => Number(v.id) !== Number(canonical.id));
  const testDuplicates = duplicateCandidates.filter(isTestPollutionVehicle);
  const skipped = duplicateCandidates.filter((v) => !isTestPollutionVehicle(v));

  console.log("\n--- Canonical vehicle (keep) ---");
  console.log(JSON.stringify(summarizeVehicles(db, [canonical.id])[0], null, 2));

  if (skipped.length) {
    console.log("\n--- Skipped (not test fingerprint) ---");
    skipped.forEach((v) => console.log(`  id=${v.id} plate=${v.plate} ${v.brand} ${v.model}`));
  }

  if (!testDuplicates.length) {
    console.log("\nNo test-pollution duplicates to remove (only non-test rows in duplicate group).");
    return;
  }

  const plan = [];
  for (const dup of testDuplicates) {
    const moves = [];
    for (const { table, column } of VEHICLE_FK_TABLES) {
      const count = countLinkedRows(db, table, column, dup.id);
      if (count > 0) {
        moves.push({ table, column, count });
      }
    }
    plan.push({ vehicle: dup, moves });
  }

  console.log("\n--- Planned actions ---");
  for (const item of plan) {
    const v = item.vehicle;
    console.log(`\nDelete vehicle id=${v.id} plate=${v.plate}`);
    if (!item.moves.length) {
      console.log("  (no linked rows)");
    } else {
      item.moves.forEach((m) => {
        console.log(`  MOVE ${m.count} row(s): ${m.table}.${m.column} → vehicle_id ${canonical.id}`);
      });
    }
  }

  const beforeSummary = {
    vehicleCount: allVehicles.length,
    targetGroupIds: targetGroup.map((v) => v.id),
    transactionCount: countLinkedRows(db, "transactions", "vehicle_id", canonical.id),
  };
  for (const dup of testDuplicates) {
    beforeSummary.transactionCount += countLinkedRows(db, "transactions", "vehicle_id", dup.id);
  }

  console.log("\n--- Before summary ---");
  console.log(`  Total vehicles: ${beforeSummary.vehicleCount}`);
  console.log(`  ${TARGET_NORMALIZED} group ids: [${beforeSummary.targetGroupIds.join(", ")}]`);
  console.log(`  Transactions on group vehicles: ${beforeSummary.transactionCount}`);

  if (!apply) {
    console.log("\nDry-run complete. Re-run with --apply to backup and execute cleanup.");
    return;
  }

  const { backupDatabase } = require("../utils/backup");
  const backupPath = backupDatabase();
  console.log("\nBackup created:", backupPath);

  const deleteIds = testDuplicates.map((v) => v.id);
  const applyMoves = db.transaction(() => {
    for (const item of plan) {
      const dupId = item.vehicle.id;
      for (const { table, column } of item.moves) {
        db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(canonical.id, dupId);
      }
      db.prepare("DELETE FROM vehicles WHERE id = ?").run(dupId);
    }
    const norm = normalizePlate(canonical.plate);
    if (norm) {
      db.prepare("UPDATE vehicles SET plate_normalized = ? WHERE id = ?").run(norm, canonical.id);
    }
  });

  applyMoves();

  const afterVehicles = db.prepare("SELECT id, plate, plate_normalized FROM vehicles ORDER BY id").all();
  const afterGroup = afterVehicles.filter((v) => (v.plate_normalized || normalizePlate(v.plate)) === TARGET_NORMALIZED);

  console.log("\n--- After summary ---");
  console.log(`  Total vehicles: ${afterVehicles.length}`);
  console.log(`  ${TARGET_NORMALIZED} group ids: [${afterGroup.map((v) => v.id).join(", ")}]`);
  console.log(`  Canonical plate_normalized: ${afterGroup[0]?.plate_normalized || "(unset)"}`);
  console.log(`  Removed vehicle ids: [${deleteIds.join(", ")}]`);
  console.log("\nCleanup applied successfully.");
}

main();
