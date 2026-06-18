/**
 * FLEETOS-INCOME-03 — hakediş PDF import smoke test
 * node scripts/test-hakedis-import.js
 */
const crypto = require("crypto");
const db = require("../lib/db");
const hakedisImportService = require("../services/hakedisImportService");

const SAMPLE_TEXT = `
MİSTUR PERSONEL
Dönem: May.26
KIRPART
KIRPART 4472 138.240,00
KIRPART 4605 138.240,00
KIRPART 4269 138.240,00
KIRPART 4272 138.240,00
KIRPART 4273 138.240,00
KIRPART 4275 138.240,00
KIRPART OTOBAN 37.499,40
KIRPART KM FARKI 9.060,00
Hakedişler Toplamı 875.999,40
KDV 87.599,94
Ödenecek Tutar 963.599,34
`;

const PLATES = [
  "16 S 4472",
  "16 S 4605",
  "16 S 4269",
  "16 S 4272",
  "16 S 4273",
  "16 S 4275",
];

function ensureTestVehicles() {
  const { normalizePlate, formatPlateDisplay } = require("../utils/plate");
  const insert = db.prepare(
    "INSERT INTO vehicles (plate, plate_normalized, type) VALUES (?, ?, 'Servis')"
  );
  PLATES.forEach((p) => {
    const norm = normalizePlate(p);
    const exists = db.prepare("SELECT id FROM vehicles WHERE plate_normalized = ?").get(norm);
    if (!exists) {
      insert.run(formatPlateDisplay(p) || p, norm);
    }
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  ensureTestVehicles();

  console.log("1) Parser…");
  const parsed = hakedisImportService.parseHakedisText(SAMPLE_TEXT, "MISTUR PERSONEL.pdf");
  assert(parsed.vehicleRows.length === 6, `vehicle rows: ${parsed.vehicleRows.length}`);
  assert(parsed.extraRows.length === 2, `extra rows: ${parsed.extraRows.length}`);
  assert(parsed.vehicleRows[0].amount === 138240, "vehicle amount");
  assert(parsed.totals.hakedisTotal === 875999, "hakedis total");
  assert(parsed.reconciliation.ok === true, "reconciliation");
  console.log("   period:", parsed.period.label, "company:", parsed.company);

  console.log("2) Import…");
  const hash1 = crypto.createHash("sha256").update("hakedis-test-1").digest("hex");
  db.prepare("DELETE FROM hakedis_import_batches WHERE file_hash = ?").run(hash1);
  db.prepare(
    "DELETE FROM transactions WHERE income_dedup_key LIKE 'hakedis:May.26:KIRPART:%'"
  ).run();

  const r1 = hakedisImportService.importFromParsed(parsed, "MISTUR PERSONEL.pdf", hash1);
  assert(r1.imported === 8, `imported ${r1.imported}, expected 8`);
  assert(r1.matchedVehicles === 6, `matched ${r1.matchedVehicles}`);
  console.log("   imported:", r1.imported, "matched:", r1.matchedVehicles);

  console.log("3) Duplicate PDF hash…");
  const r2 = hakedisImportService.importFromParsed(parsed, "MISTUR PERSONEL.pdf", hash1);
  assert(r2.duplicate === true, "should be duplicate PDF");
  console.log("   duplicate blocked ✓");

  console.log("4) Dedup on same period lines…");
  const hash2 = crypto.createHash("sha256").update("hakedis-test-2").digest("hex");
  const r3 = hakedisImportService.importFromParsed(parsed, "copy.pdf", hash2);
  assert(r3.skippedDuplicate === 8, `skipped ${r3.skippedDuplicate}`);
  console.log("   skipped:", r3.skippedDuplicate);

  console.log("\n✓ FLEETOS-INCOME-03 tests passed");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
