const { normalizePlate, normalizePlateFlexible, platesEqual } = require("../utils/plate");

/** Presentation-only plate → static insight card image mapping */
const PLATE_IMAGE_MAP = new Map([
  ["16SYV16", "/images/vehicles/vito-clean.png"],
  ["16LR005", "/images/vehicles/bus-clean.png"],
  ["16LA005", "/images/vehicles/sprinter-clean.png"],
]);

function plateInsightImageKey(plate) {
  if (!plate) return "";
  const strict = normalizePlate(plate);
  const flex = normalizePlateFlexible(plate);
  if (PLATE_IMAGE_MAP.has(strict)) return strict;
  if (PLATE_IMAGE_MAP.has(flex)) return flex;

  for (const key of PLATE_IMAGE_MAP.keys()) {
    if (platesEqual(plate, key)) return key;
  }
  return "";
}

function resolveInsightVehicleImageSrc(plate) {
  const key = plateInsightImageKey(plate);
  return key ? PLATE_IMAGE_MAP.get(key) : null;
}

const TYPE_DISPLAY = {
  Servis: "Servis Aracı",
  Turizm: "Turizm Aracı",
};

const PLATE_TYPE_HINT = new Map([
  ["16SYV16", "Mercedes Vito"],
  ["16LR005", "Otobüs"],
  ["16LA005", "Mercedes Sprinter"],
]);

function vehicleDisplayType(vehicle) {
  if (!vehicle) return "Araç";
  const key = plateInsightImageKey(vehicle.plate);
  if (key && PLATE_TYPE_HINT.has(key)) return PLATE_TYPE_HINT.get(key);
  const parts = [vehicle.brand, vehicle.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (vehicle.type && TYPE_DISPLAY[vehicle.type]) return TYPE_DISPLAY[vehicle.type];
  return vehicle.type || "Araç";
}

function vehicleImageForVehicle(vehicle) {
  if (!vehicle) return null;
  return resolveInsightVehicleImageSrc(vehicle.plate);
}

module.exports = {
  PLATE_IMAGE_MAP,
  plateInsightImageKey,
  resolveInsightVehicleImageSrc,
  vehicleDisplayType,
  vehicleImageForVehicle,
};
