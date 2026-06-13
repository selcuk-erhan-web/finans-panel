const db = require("../lib/db");
const {
  normalizePlate,
  formatPlateDisplay,
  platesEqual,
  isValidTurkishPlate,
} = require("../utils/plate");

function preparePlateInput(rawPlate) {
  const trimmed = String(rawPlate || "").trim();
  const normalized = normalizePlate(trimmed);
  const display = formatPlateDisplay(trimmed) || trimmed;
  return { raw: trimmed, normalized, display };
}

function findDuplicateVehicle(normalized, excludeId = null) {
  if (!normalized) return null;
  const rows = db.prepare("SELECT id, plate, plate_normalized FROM vehicles").all();
  return (
    rows.find((v) => {
      if (excludeId != null && Number(v.id) === Number(excludeId)) return false;
      const vn = v.plate_normalized || normalizePlate(v.plate);
      return vn === normalized || platesEqual(v.plate, normalized);
    }) || null
  );
}

function assertUniquePlate(normalized, excludeId = null) {
  const dup = findDuplicateVehicle(normalized, excludeId);
  if (dup) {
    const shown = formatPlateDisplay(dup.plate) || dup.plate;
    const err = new Error(`Bu plaka zaten kayıtlı: ${shown}`);
    err.code = "DUPLICATE_PLATE";
    err.existingId = dup.id;
    throw err;
  }
}

function syncAllVehiclePlateNormalized() {
  const { normalizePlate: norm } = require("../utils/plate");
  const rows = db.prepare("SELECT id, plate, plate_normalized FROM vehicles").all();
  const update = db.prepare(
    "UPDATE vehicles SET plate_normalized = ? WHERE id = ? AND (plate_normalized IS NULL OR plate_normalized = '' OR plate_normalized != ?)"
  );
  let updated = 0;
  rows.forEach((r) => {
    const n = norm(r.plate);
    if (!n) return;
    if (r.plate_normalized !== n) {
      update.run(n, r.id, n);
      updated++;
    }
  });
  return updated;
}

function validatePlateForSave(rawPlate, excludeId = null) {
  const prepared = preparePlateInput(rawPlate);
  if (!prepared.normalized) {
    const err = new Error("Geçerli bir plaka girin.");
    err.code = "INVALID_PLATE";
    throw err;
  }
  if (!isValidTurkishPlate(prepared.normalized)) {
    prepared.warning = "Plaka formatı standart dışı görünüyor; kayıt yine de alınacak.";
  }
  assertUniquePlate(prepared.normalized, excludeId);
  return prepared;
}

module.exports = {
  preparePlateInput,
  findDuplicateVehicle,
  assertUniquePlate,
  validatePlateForSave,
  syncAllVehiclePlateNormalized,
};
