/** Plaka normalizasyonu — 016S4605, 16 S 4605, 16S4605 eşleşir */

function normalizePlate(plate) {
  return String(plate || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Rakam bloklarındaki baştaki sıfırları kaldırarak ikinci anahtar */
function normalizePlateFlexible(plate) {
  let s = normalizePlate(plate);
  if (!s) return "";
  const m = s.match(/^(\d*)([A-Z]+)(\d*)$/);
  if (m) {
    const num1 = m[1].replace(/^0+/, "") || "0";
    const letters = m[2];
    const num2 = m[3].replace(/^0+/, "") || m[3];
    return `${num1}${letters}${num2}`;
  }
  return s.replace(/^0+/, "");
}

function platesMatch(a, b) {
  const na = normalizePlate(a);
  const nb = normalizePlate(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return normalizePlateFlexible(a) === normalizePlateFlexible(b);
}

function buildVehiclePlateMap(vehicles) {
  const map = new Map();
  vehicles.forEach((v) => {
    const keys = new Set([normalizePlate(v.plate), normalizePlateFlexible(v.plate)]);
    keys.forEach((k) => {
      if (k && !map.has(k)) map.set(k, v);
    });
  });
  return map;
}

function findVehicleByPlate(plateText, vehicleMap) {
  const keys = [normalizePlate(plateText), normalizePlateFlexible(plateText)];
  for (const k of keys) {
    if (k && vehicleMap.has(k)) return vehicleMap.get(k);
  }
  for (const v of vehicleMap.values()) {
    if (platesMatch(plateText, v.plate)) return v;
  }
  return null;
}

module.exports = {
  normalizePlate,
  normalizePlateFlexible,
  platesMatch,
  buildVehiclePlateMap,
  findVehicleByPlate,
};
