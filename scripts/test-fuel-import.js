/**
 * FLEETOS-FUEL-02 — dual Excel import smoke test
 * node scripts/test-fuel-import.js
 */
const XLSX = require("xlsx");
const fuelImportService = require("../services/fuelImportService");

function buildDokumBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Plaka", "Tarih", "Tip", "Miktar", "Birim Fiyat", "Net Tutar", "İstasyon", "UTTS", "İşlem Numarası"],
    ...rows.map((r) => [
      r.plate,
      r.date,
      r.fuelType,
      r.liter,
      r.price,
      r.amount,
      r.station,
      r.utts,
      r.tx,
    ]),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SatisListesi");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function buildControlBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Akaryakıt Alım Raporu"],
    [],
    ["Plaka", "Litre", "Birim Fiyat", "Net Tutar", "Bayi", "Tarih", "Yakıt Tipi"],
    ...rows.map((r) => [r.plate, r.liter, r.price, r.amount, r.station, r.date, r.fuelType]),
    ["Toplam", rows.reduce((s, r) => s + r.liter, 0), "", rows.reduce((s, r) => s + r.amount, 0)],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rapor");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function main() {
  const sample = [
    {
      plate: "34 ABC 123",
      date: "10.06.2026",
      fuelType: "Motorin",
      liter: 50.5,
      price: 42.5,
      amount: 2146,
      station: "Shell Kadıköy",
      utts: "U123",
      tx: "TX-001",
    },
    {
      plate: "06 XYZ 99",
      date: "10.06.2026",
      fuelType: "Motorin",
      liter: 30,
      price: 42.5,
      amount: 1275,
      station: "Opet Ankara",
      utts: "U456",
      tx: "TX-002",
    },
  ];

  const detail = buildDokumBuffer(sample);
  const control = buildControlBuffer(sample);

  console.log("1) Dokum-only import…");
  const r1 = fuelImportService.importFromBuffers({
    detailBuffer: detail,
    detailName: "Dokum-10.06.2026.xlsx",
    syncExpense: false,
  });
  console.log("   imported:", r1.imported, "skipped:", r1.skippedDuplicate, "matched:", r1.matchedPlates);

  console.log("2) Duplicate re-import…");
  const r2 = fuelImportService.importFromBuffers({
    detailBuffer: detail,
    detailName: "Dokum-10.06.2026.xlsx",
    syncExpense: false,
  });
  console.log("   imported:", r2.imported, "skipped:", r2.skippedDuplicate);
  if (r2.imported !== 0 || r2.skippedDuplicate !== sample.length) {
    throw new Error("Dedup failed");
  }

  console.log("3) Dual import + reconciliation…");
  const r3 = fuelImportService.importFromBuffers({
    detailBuffer: detail,
    detailName: "Dokum-10.06.2026-b.xlsx",
    controlBuffer: control,
    controlName: "Yakıt Alım Raporu --10.06.2026.xlsx",
    syncExpense: false,
  });
  console.log("   reconciliation ok:", r3.reconciliation?.ok);
  console.log("   detail L:", r3.reconciliation?.detailLiters, "control L:", r3.reconciliation?.controlLiters);

  console.log("4) Parser exports…");
  const parsed = fuelImportService.parseWorkbook(detail, "Dokum-test.xlsx", { requireDokum: true });
  console.log("   rows:", parsed.rows.length, "format:", parsed.format);

  console.log("\n✓ FUEL-02 smoke tests passed");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
