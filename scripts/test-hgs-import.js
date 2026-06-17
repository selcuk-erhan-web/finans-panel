/**
 * FLEETOS-HGS-01 — İş Bankası HGS PDF import tests (isolated temp DB)
 * node scripts/test-hgs-import.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fleetos-hgs-test-"));
const testDbPath = path.join(tmpDir, "test.db");
process.env.FLEETOS_DB_PATH = testDbPath;

Object.keys(require.cache).forEach((key) => {
  if (key.includes("/lib/db.js") || key.includes("/services/hgsImportService")) {
    delete require.cache[key];
  }
});

const db = require("../lib/db");
const hgsImportService = require("../services/hgsImportService");

const SAMPLE_PDF_TEXT = `
İş Bankası HGS Ekstre
HGS No: 1018142298
Plaka Numarası: 16SYV16
Araç Sınıfı: 2
Dönem: 01.05.2026 - 31.05.2026
HGS Bakiyesi: 1.473,00
HGS Bakiye Tarihi: 03.06.2026 01:48:33
Dönem İçi Yükleme Adedi: 2
Dönem İçi Geçiş Adedi: 4
Dönem İçi Yüklemeler Toplamı: 8.690,00
Dönem İçi Geçişler Toplamı: 7.380,00

GOI Geçiş BURSA-İZMİR Bursa Batı
31.05.2026 16:22:07
İzmir
31.05.2026 19:29:23
1.845,00
Yükleme
25.05.2026
5.000,00
GOI Geçiş BURSA-İZMİR İzmir
22.05.2026 18:25:05
Bursa Batı
22.05.2026 21:18:51
1.845,00
Yükleme
11.05.2026
3.690,00
GOI Geçiş BURSA-İZMİR Bursa Batı
15.05.2026 10:11:02
İzmir
15.05.2026 13:04:44
1.845,00
GOI Geçiş BURSA-İZMİR İzmir
08.05.2026 09:18:11
Bursa Batı
08.05.2026 12:02:33
1.845,00
`;

function buildRealIsbankBody() {
  let body = "";
  for (let i = 0; i < 34; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const hour = String(10 + (i % 10)).padStart(2, "0");
    body += `GOI Geçiş GEBZE-İZMİR GEMLİK
${day}.05.2026 ${hour}:43:11
OVAAKÇA
${day}.05.2026 ${hour}:54:36
250,00
`;
  }
  body += `Yükleme
25.05.2026
7.000,00
Yükleme
15.05.2026
3.500,00
Yükleme
20.05.2026
3.000,00
`;
  return body;
}

const REAL_ISBANK_TEXT = `
İş Bankası HGS Ekstre
HGS No: 1017593823
Plaka Numarası: 16S4605
Araç Sınıfı: 2
Dönem: 01.05.2026 - 31.05.2026
Dönem İçi Yükleme Adedi: 3
Dönem İçi Geçiş Adedi: 34
Dönem İçi Yüklemeler Toplamı: 13.500,00
Dönem İçi Geçişler Toplamı: 8.500,00

${buildRealIsbankBody()}`;

const UNMATCHED_TEXT = SAMPLE_PDF_TEXT.replace("16SYV16", "99ZZZ99");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    fs.rmdirSync(tmpDir);
  } catch (e) {}
}

async function main() {
  console.log("1) Parser (multiline İş Bankası format)…");
  const parsed = hgsImportService.parsePdfText(SAMPLE_PDF_TEXT, "isbank-hgs-may-2026.pdf");

  assert(parsed.header.plate_normalized === "16SYV16", "plate mismatch");
  assert(parsed.header.hgs_no === "1018142298", "hgs_no mismatch");
  assert(parsed.header.passage_count === 4, "passage_count mismatch");
  assert(parsed.header.loading_count === 2, "loading_count mismatch");
  assert(parsed.header.passage_total === 7380, "passage_total mismatch");
  assert(parsed.header.loading_total === 8690, "loading_total mismatch");
  assert(parsed.transactions.length === 6, "transaction count mismatch");

  const firstPassage = parsed.transactions.find((t) => t.transaction_type === "passage");
  assert(firstPassage.highway === "BURSA-İZMİR", "highway mismatch");
  assert(firstPassage.entry_point === "Bursa Batı", "entry point mismatch");
  assert(firstPassage.exit_point === "İzmir", "exit point mismatch");
  assert(firstPassage.amount === 1845, "passage amount mismatch");
  assert(firstPassage.transaction_date === "2026-05-31", "passage date mismatch");

  const firstLoading = parsed.transactions.find((t) => t.transaction_type === "loading");
  assert(firstLoading.transaction_date === "2026-05-25", "loading date mismatch");
  assert(firstLoading.amount === 5000, "loading amount mismatch");

  assert(hgsImportService.parseHgsAmount("42,50") === 43, "money 42,50");
  assert(hgsImportService.parseHgsAmount("1.250,75") === 1251, "money 1.250,75");

  console.log("1b) Real İş Bankası body (34 geçiş + 3 yükleme)…");
  const realParsed = hgsImportService.parsePdfText(REAL_ISBANK_TEXT, "real-isbank.pdf");
  const passages = realParsed.transactions.filter((t) => t.transaction_type === "passage");
  const loadings = realParsed.transactions.filter((t) => t.transaction_type === "loading");
  const passageSum = passages.reduce((s, t) => s + t.amount, 0);
  const loadingSum = loadings.reduce((s, t) => s + t.amount, 0);

  assert(realParsed.header.plate_normalized === "16S4605", "real plate mismatch");
  assert(passages.length === 34, `real passage count ${passages.length}`);
  assert(loadings.length === 3, `real loading count ${loadings.length}`);
  assert(realParsed.transactions.length === 37, `real total rows ${realParsed.transactions.length}`);
  assert(passageSum === 8500, `passage sum ${passageSum}`);
  assert(loadingSum === 13500, `loading sum ${loadingSum}`);

  console.log("1c) Fragmented PDF lines (GOI/Geçiş + date/time split)…");
  const FRAGMENTED_TEXT = `
HGS No: 1017593823
Plaka Numarası: 16S4605
Dönem İçi Geçiş Adedi: 1
Dönem İçi Yükleme Adedi: 1
Dönem İçi Geçişler Toplamı: 250,00
Dönem İçi Yüklemeler Toplamı: 7.000,00
GOI
Geçiş
GEBZE-İZMİR
GEMLİK
25.05.2026
17:43:11
OVAAKÇA
25.05.2026
17:54:36
250,00
Yükleme
25.05.2026
7.000,00
`;
  const fragmented = hgsImportService.parsePdfText(FRAGMENTED_TEXT, "fragmented.pdf");
  assert(fragmented.transactions.length === 2, `fragmented count ${fragmented.transactions.length}`);

  console.log("2) Vehicle seed…");
  db.prepare("INSERT INTO vehicles (plate, type) VALUES (?, 'Servis')").run("16 SYV 16");
  db.prepare("INSERT INTO vehicles (plate, type) VALUES (?, 'Servis')").run("16 S 4605");

  console.log("3) Import with vehicle match…");
  const import1 = hgsImportService.importFromParsedText(SAMPLE_PDF_TEXT, "test-hgs.pdf");
  assert(import1.ok, "import failed");
  assert(import1.totalRows === 6, `totalRows ${import1.totalRows}`);
  assert(import1.insertedCount === 6, `insertedCount ${import1.insertedCount}`);
  assert(import1.expenseCount === 6, `expenseCount ${import1.expenseCount}`);
  assert(import1.vehicleMatched, "vehicle should match");
  assert(import1.unmatchedPlates.length === 0, "no unmatched");

  const hgsRows = db.prepare("SELECT COUNT(*) AS c FROM hgs_transactions").get().c;
  assert(hgsRows === 6, `hgs_transactions rows ${hgsRows}`);

  const expenseRows = db
    .prepare("SELECT * FROM transactions WHERE type='expense' AND category_slug='hgs-ogs'")
    .all();
  assert(expenseRows.length === 6, `expense rows ${expenseRows.length}`);
  assert(expenseRows.every((r) => r.vehicle_id), "all expenses linked to vehicle");

  console.log("4) Duplicate PDF hash…");
  const import2 = hgsImportService.importFromParsedText(SAMPLE_PDF_TEXT, "test-hgs.pdf");
  assert(import2.duplicate, "duplicate PDF not blocked");

  console.log("5) Duplicate expense lines (new PDF hash)…");
  const hash2 = hgsImportService.hashBuffer(Buffer.from(SAMPLE_PDF_TEXT + " "));
  const parsed2 = hgsImportService.parsePdfText(SAMPLE_PDF_TEXT, "copy.pdf");
  const import3 = hgsImportService.importFromParsed(parsed2, "copy.pdf", hash2);
  assert(import3.skippedCount >= 6, `skipped ${import3.skippedCount}`);
  assert(import3.expenseCount === 0, "no new expenses on dedup");

  console.log("6) Unmatched plate report…");
  const hash3 = hgsImportService.hashBuffer(Buffer.from(UNMATCHED_TEXT));
  const parsed3 = hgsImportService.parsePdfText(UNMATCHED_TEXT, "unmatched.pdf");
  const import4 = hgsImportService.importFromParsed(parsed3, "unmatched.pdf", hash3);
  assert(import4.unmatchedPlates.includes("99ZZZ99"), "unmatched plate missing");
  assert(import4.expenseCount === 0, "no expense without vehicle");
  const unmatchedHgsRows = db
    .prepare("SELECT COUNT(*) AS c FROM hgs_transactions WHERE report_id = ?")
    .get(import4.reportId).c;
  assert(unmatchedHgsRows === 6, `unmatched hgs_transactions ${unmatchedHgsRows}`);

  console.log("7) Plate match 16 S 4605 ↔ 16S4605…");
  const plateText = REAL_ISBANK_TEXT.replace(
    "Dönem İçi Geçiş Adedi: 34",
    "Dönem İçi Geçiş Adedi: 1"
  ).replace(buildRealIsbankBody(), `GOI Geçiş GEBZE-İZMİR GEMLİK
01.05.2026 17:43:11
OVAAKÇA
01.05.2026 17:54:36
250,00
Yükleme
25.05.2026
7.000,00
`);
  const hashPlate = hgsImportService.hashBuffer(Buffer.from(plateText + "-plate-test"));
  const parsedPlate = hgsImportService.parsePdfText(plateText, "plate-match.pdf");
  const importPlate = hgsImportService.importFromParsed(parsedPlate, "plate-match.pdf", hashPlate);
  assert(importPlate.vehicleMatched, "16S4605 should match 16 S 4605");
  assert(importPlate.unmatchedPlates.length === 0, "plate should be matched");
  assert(importPlate.insertedCount === 2, `plate import rows ${importPlate.insertedCount}`);
  assert(importPlate.expenseCount === 2, `plate expense rows ${importPlate.expenseCount}`);

  console.log("\n✓ FLEETOS-HGS-01 tests passed (temp DB:", testDbPath, ")");
  cleanup();
}

main().catch((e) => {
  console.error("✗", e.message);
  cleanup();
  process.exit(1);
});
