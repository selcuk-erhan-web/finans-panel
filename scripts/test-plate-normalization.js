/**
 * FLEETOS-PLATE-01 — plaka normalizasyon smoke test
 * node scripts/test-plate-normalization.js
 */
const {
  normalizePlate,
  formatPlateDisplay,
  platesEqual,
  isValidTurkishPlate,
  buildVehiclePlateMap,
  findVehicleByPlate,
} = require("../utils/plate");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const variants = ["16SVY16", "16 SVY 16", "16-SVY-16", "16.SVY.16", "16 svy 16", "16.svy.16"];

console.log("1) normalizePlate → 16SVY16");
variants.forEach((v) => {
  const n = normalizePlate(v);
  assert(n === "16SVY16", `${v} → ${n}`);
  console.log(`   ${v} → ${n}`);
});

console.log("2) platesEqual all pairs");
for (let i = 0; i < variants.length; i++) {
  for (let j = i + 1; j < variants.length; j++) {
    assert(platesEqual(variants[i], variants[j]), `${variants[i]} vs ${variants[j]}`);
  }
}
console.log("   all true ✓");

console.log("3) formatPlateDisplay");
assert(formatPlateDisplay("16SVY16") === "16 SVY 16", "display format");
console.log(`   16SVY16 → ${formatPlateDisplay("16SVY16")}`);

console.log("4) isValidTurkishPlate (lenient)");
assert(isValidTurkishPlate("16 SVY 16"), "valid plate");
assert(!isValidTurkishPlate("ABC"), "invalid short");

console.log("5) vehicle map matching across formats");
const vehicles = [{ id: 1, plate: "16 SVY 16", plate_normalized: "16SVY16", type: "Servis" }];
const map = buildVehiclePlateMap(vehicles);
const sources = ["16-SVY-16", "16.svy.16", "16SVY16"];
sources.forEach((src) => {
  const found = findVehicleByPlate(src, map);
  assert(found && found.id === 1, `${src} should match vehicle 1, got ${found?.id}`);
  console.log(`   ${src} → vehicle #${found.id}`);
});

console.log("\n✓ FLEETOS-PLATE-01 tests passed");
