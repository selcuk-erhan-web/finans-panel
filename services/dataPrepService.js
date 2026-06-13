const db = require("../lib/db");
const { backupDatabase } = require("../utils/backup");
const auditService = require("./auditService");

const CONFIRM_DEMO = "DEMO VERİLERİ TEMİZLE";
const CONFIRM_VEHICLES = "ARAÇLARI DA TEMİZLE";

function getStats() {
  const vehicles = db.prepare("SELECT COUNT(*) AS c FROM vehicles").get().c;
  const transactions = db.prepare("SELECT COUNT(*) AS c FROM transactions").get().c;
  const income = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE type = 'income'").get().c;
  const expense = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE type = 'expense'").get().c;
  const sharedExpense = db
    .prepare("SELECT COUNT(*) AS c FROM transactions WHERE type = 'expense' AND vehicle_id IS NULL")
    .get().c;
  const fuel = db.prepare("SELECT COUNT(*) AS c FROM fuel_records").get().c;
  const maintenance = db.prepare("SELECT COUNT(*) AS c FROM maintenance_records").get().c;
  const unmatchedPlates = db
    .prepare(
      `SELECT COUNT(DISTINCT plate_text) AS c FROM fuel_records
       WHERE vehicle_id IS NULL AND plate_text IS NOT NULL AND trim(plate_text) != ''`
    )
    .get().c;
  const importBatches = db.prepare("SELECT COUNT(*) AS c FROM fuel_import_batches").get().c;

  return {
    vehicles,
    transactions,
    income,
    expense,
    sharedExpense,
    fuel,
    maintenance,
    unmatchedPlates,
    importBatches,
  };
}

function purgeDemoData({ confirmPhrase, includeVehicles = false, vehicleConfirmPhrase = "" }) {
  if (String(confirmPhrase || "").trim() !== CONFIRM_DEMO) {
    throw new Error(`Onay metni tam olarak "${CONFIRM_DEMO}" yazılmalı.`);
  }
  if (includeVehicles && String(vehicleConfirmPhrase || "").trim() !== CONFIRM_VEHICLES) {
    throw new Error(`Araçları silmek için "${CONFIRM_VEHICLES}" yazılmalı.`);
  }

  const before = getStats();
  let backupPath;
  try {
    backupPath = backupDatabase();
  } catch (e) {
    throw new Error(`Yedekleme başarısız — temizlik iptal edildi: ${e.message}`);
  }

  const purge = db.transaction(() => {
    const txDeleted = db.prepare("DELETE FROM transactions").run().changes;
    const fuelDeleted = db.prepare("DELETE FROM fuel_records").run().changes;
    const batchDeleted = db.prepare("DELETE FROM fuel_import_batches").run().changes;
    const maintDeleted = db.prepare("DELETE FROM maintenance_records").run().changes;
    let vehiclesDeleted = 0;
    if (includeVehicles) {
      vehiclesDeleted = db.prepare("DELETE FROM vehicles").run().changes;
    }
    return { txDeleted, fuelDeleted, batchDeleted, maintDeleted, vehiclesDeleted };
  });

  const deleted = purge();

  auditService.log(
    "demo_purge",
    "system",
    null,
    before,
    { ...deleted, backup: backupPath, includeVehicles },
    includeVehicles ? "Demo veriler + araçlar temizlendi" : "Demo veriler temizlendi"
  );

  return { backupPath, before, deleted, after: getStats() };
}

module.exports = {
  CONFIRM_DEMO,
  CONFIRM_VEHICLES,
  getStats,
  purgeDemoData,
};
