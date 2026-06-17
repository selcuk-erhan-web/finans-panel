/** FleetOS plaka normalizasyon motoru — tüm kaynaklarda tek standart */

const TR_CHAR_MAP = {
  ı: "I",
  i: "I",
  İ: "I",
  I: "I",
  ğ: "G",
  Ğ: "G",
  ü: "U",
  Ü: "U",
  ş: "S",
  Ş: "S",
  ö: "O",
  Ö: "O",
  ç: "C",
  Ç: "C",
};

function toAsciiUpperChar(ch) {
  if (TR_CHAR_MAP[ch] !== undefined) return TR_CHAR_MAP[ch];
  return ch.toUpperCase();
}

/** Strict normalize: A-Z + 0-9, boşluksuz, büyük harf */
function normalizePlate(input) {
  if (input == null || input === undefined) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  let out = "";
  for (const ch of raw) {
    if (/[a-zA-Z0-9]/.test(ch) || TR_CHAR_MAP[ch]) {
      out += toAsciiUpperChar(ch);
    }
  }
  return out.replace(/[^A-Z0-9]/g, "");
}

/** Rakam bloklarındaki baştaki sıfırları kaldırarak esnek anahtar */
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
  return s.replace(/^0+/, "") || s;
}

function platesEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const na = normalizePlate(a);
  const nb = normalizePlate(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return normalizePlateFlexible(a) === normalizePlateFlexible(b);
}

/** @deprecated use platesEqual */
function platesMatch(a, b) {
  return platesEqual(a, b);
}

/** Makul Türkiye plaka kontrolü — operasyonu engellemez */
function isValidTurkishPlate(input) {
  const n = normalizePlate(input);
  if (!n || n.length < 4 || n.length > 11) return false;
  return /^(\d{2})([A-Z]{1,3})(\d{1,5})$/.test(n);
}

/** Okunabilir plaka gösterimi — ayrıştıramazsa normalize hali */
function formatPlateDisplay(input) {
  const n = normalizePlate(input);
  if (!n) return "";

  const std = n.match(/^(\d{2})([A-Z]{1,3})(\d{1,5})$/);
  if (std) {
    return `${std[1]} ${std[2]} ${std[3]}`;
  }

  const loose = n.match(/^(\d{2})([A-Z]+)(\d+)$/);
  if (loose) {
    return `${loose[1]} ${loose[2]} ${loose[3]}`;
  }

  return n;
}

function buildVehiclePlateMap(vehicles) {
  const map = new Map();
  (vehicles || []).forEach((v) => {
    const keys = new Set(
      [v.plate_normalized, v.plate, normalizePlate(v.plate), normalizePlateFlexible(v.plate)]
        .map((k) => (k ? String(k).trim() : ""))
        .filter(Boolean)
    );
    keys.forEach((k) => {
      const strict = normalizePlate(k);
      const flex = normalizePlateFlexible(k);
      [k, strict, flex].filter(Boolean).forEach((key) => {
        if (!map.has(key)) map.set(key, v);
      });
    });
  });
  return map;
}

function findVehicleByPlate(plateText, vehicleMap) {
  if (!plateText || !vehicleMap) return null;
  const keys = [
    normalizePlate(plateText),
    normalizePlateFlexible(plateText),
    String(plateText).trim(),
  ].filter(Boolean);

  for (const k of keys) {
    if (vehicleMap.has(k)) return vehicleMap.get(k);
  }

  for (const v of vehicleMap.values()) {
    if (platesEqual(plateText, v.plate)) return v;
    if (v.plate_normalized && platesEqual(plateText, v.plate_normalized)) return v;
  }
  return null;
}

/** Plaka son 4 hane ile araç bul (hakediş PDF: KIRPART 4472) */
function findVehicleByPlateSuffix(suffix, vehicles) {
  const key = String(suffix || "").replace(/\D/g, "").slice(-4);
  if (!key || key.length < 4) return null;
  const matches = (vehicles || []).filter((v) => {
    const norm = normalizePlate(v.plate_normalized || v.plate);
    return norm.length >= 4 && norm.slice(-4) === key;
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const strict = matches.filter((v) => normalizePlate(v.plate).slice(-4) === key);
    if (strict.length === 1) return strict[0];
  }
  return null;
}

module.exports = {
  normalizePlate,
  normalizePlateFlexible,
  formatPlateDisplay,
  platesEqual,
  platesMatch,
  isValidTurkishPlate,
  buildVehiclePlateMap,
  findVehicleByPlate,
  findVehicleByPlateSuffix,
};
