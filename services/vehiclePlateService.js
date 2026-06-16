const db = require("../lib/db");
const {
  normalizePlate,
  formatPlateDisplay,
  platesEqual,
  isValidTurkishPlate,
} = require("../utils/plate");

function ensurePlateNormalizedColumn() {
  try {
    db.prepare("ALTER TABLE vehicles ADD COLUMN plate_normalized TEXT").run();
  } catch (e) {}
  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_normalized
       ON vehicles(plate_normalized)
       WHERE plate_normalized IS NOT NULL AND plate_normalized != ''`
    ).run();
  } catch (e) {}
}

function backfillPlateNormalized(vehicleId = null) {
  ensurePlateNormalizedColumn();
  const rows = vehicleId
    ? db.prepare("SELECT id, plate, plate_normalized FROM vehicles WHERE id = ?").all(vehicleId)
    : db.prepare("SELECT id, plate, plate_normalized FROM vehicles").all();
  const update = db.prepare("UPDATE vehicles SET plate_normalized = ? WHERE id = ?");
  rows.forEach((r) => {
    const n = normalizePlate(r.plate);
    if (n && r.plate_normalized !== n) update.run(n, r.id);
  });
}

function preparePlateInput(rawPlate) {
  const trimmed = String(rawPlate || "").trim();
  const normalized = normalizePlate(trimmed);
  const display = formatPlateDisplay(trimmed) || trimmed;
  return { raw: trimmed, normalized, display };
}

function findDuplicateVehicle(normalized, excludeId = null) {
  if (!normalized) return null;
  ensurePlateNormalizedColumn();
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

function isDuplicateDbError(err) {
  const msg = String(err?.message || "");
  return err?.code === "DUPLICATE_PLATE" || msg.includes("UNIQUE constraint failed");
}

function createVehicleRecord(data, _retry = 0) {
  ensurePlateNormalizedColumn();
  const { plate, brand = "", model = "", year = "", km = 0, type = "Servis" } = data;
  const prepared = validatePlateForSave(plate);
  const currentKm = Math.max(0, Number(km) || 0);
  const vehicleType = type === "Turizm" ? "Turizm" : "Servis";

  try {
    const info = db
      .prepare(
        `INSERT INTO vehicles (plate, plate_normalized, brand, model, year, km, current_km, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        prepared.display,
        prepared.normalized,
        brand || "",
        model || "",
        year || "",
        currentKm,
        currentKm,
        vehicleType
      );
    return { id: info.lastInsertRowid, ...prepared, type: vehicleType };
  } catch (err) {
    if (isDuplicateDbError(err)) {
      const dup = findDuplicateVehicle(prepared.normalized);
      const shown = dup ? formatPlateDisplay(dup.plate) || dup.plate : prepared.display;
      const e = new Error(`Bu plaka zaten kayıtlı: ${shown}`);
      e.code = "DUPLICATE_PLATE";
      throw e;
    }
    if (String(err.message || "").includes("no such column: plate_normalized") && _retry < 1) {
      ensurePlateNormalizedColumn();
      backfillPlateNormalized();
      return createVehicleRecord(data, _retry + 1);
    }
    throw err;
  }
}

function updateVehicleRecord(id, { plate, brand = "", model = "", year = "", km = 0, type = "Servis" }) {
  ensurePlateNormalizedColumn();
  const prepared = validatePlateForSave(plate, id);
  const currentKm = Math.max(0, Number(km) || 0);
  const vehicleType = type === "Turizm" ? "Turizm" : "Servis";

  try {
    db.prepare(
      `UPDATE vehicles SET plate=?, plate_normalized=?, brand=?, model=?, year=?, km=?, current_km=?, type=? WHERE id=?`
    ).run(
      prepared.display,
      prepared.normalized,
      brand || "",
      model || "",
      year || "",
      currentKm,
      currentKm,
      vehicleType,
      id
    );
    return prepared;
  } catch (err) {
    if (isDuplicateDbError(err)) {
      const dup = findDuplicateVehicle(prepared.normalized, id);
      const shown = dup ? formatPlateDisplay(dup.plate) || dup.plate : prepared.display;
      const e = new Error(`Bu plaka zaten kayıtlı: ${shown}`);
      e.code = "DUPLICATE_PLATE";
      throw e;
    }
    throw err;
  }
}

function syncAllVehiclePlateNormalized() {
  return backfillPlateNormalized();
}

module.exports = {
  preparePlateInput,
  findDuplicateVehicle,
  assertUniquePlate,
  validatePlateForSave,
  ensurePlateNormalizedColumn,
  createVehicleRecord,
  updateVehicleRecord,
  syncAllVehiclePlateNormalized,
};
