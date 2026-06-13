const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const db = require("../lib/db");
const { filterTransactions } = require("../lib/finance");
const { resolveQueryDates } = require("../lib/dates");
const { transactionsToCsv } = require("../lib/export");
const maintenanceService = require("./maintenanceService");
const fuelService = require("./fuelService");

function getIncomeRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'income' ORDER BY t.date DESC`
    )
    .all();
}

function getExpenseRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'expense' ORDER BY t.date DESC`
    )
    .all();
}

async function transactionsExcel(rows, sheetName) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Araç", key: "plate", width: 14 },
    { header: "Kategori", key: "category", width: 16 },
    { header: "Tutar (TL)", key: "amount", width: 12 },
    { header: "Açıklama", key: "note", width: 28 },
    { header: "Tarih", key: "date", width: 20 },
  ];
  rows.forEach((r) => {
    ws.addRow({
      id: r.id,
      plate: r.plate || "-",
      category: r.category || "-",
      amount: r.amount,
      note: r.note || "",
      date: String(r.date || "").slice(0, 19),
    });
  });
  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

function filteredTransactions(type, query) {
  const rows = type === "income" ? getIncomeRows() : getExpenseRows();
  return filterTransactions(rows, resolveQueryDates(query));
}

async function exportTransactionsExcel(type, query) {
  const rows = filteredTransactions(type, query);
  return transactionsExcel(rows, type === "income" ? "Gelirler" : "Giderler");
}

function exportTransactionsCsv(type, query) {
  const rows = filteredTransactions(type, query);
  return transactionsToCsv(rows, type);
}

async function exportFleetPdf(res, query = {}) {
  const summaries = require("../lib/finance").getAllVehicleSummaries();
  const totals = require("../lib/finance").getTotals();

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="mistur-filo-rapor.pdf"'
  );
  doc.pipe(res);

  doc.fontSize(20).text("MISTUR FleetOS — Filo Raporu", { align: "center" });
  doc.moveDown();
  doc.fontSize(11).text(`Tarih: ${new Date().toLocaleString("tr-TR")}`);
  doc.text(`Toplam Gelir: ${totals.income.toLocaleString("tr-TR")} TL`);
  doc.text(`Toplam Gider: ${totals.expense.toLocaleString("tr-TR")} TL`);
  doc.text(`Net: ${totals.balance.toLocaleString("tr-TR")} TL`);
  doc.moveDown();
  doc.fontSize(14).text("Araç Özeti");
  doc.moveDown(0.5);

  summaries.forEach((v) => {
    doc
      .fontSize(10)
      .text(
        `${v.plate} | Gelir: ${v.income} TL | Gider: ${v.expense} TL | Net: ${v.net} TL`
      );
  });

  doc.end();
}

async function exportMaintenanceExcel() {
  const rows = maintenanceService.listAll();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Bakım");
  ws.columns = [
    { header: "Plaka", key: "plate", width: 14 },
    { header: "Tip", key: "type_label", width: 16 },
    { header: "Açıklama", key: "description", width: 22 },
    { header: "Tutar", key: "amount", width: 12 },
    { header: "Servis Tarihi", key: "service_date", width: 14 },
    { header: "Sonraki Bakım", key: "next_service_date", width: 14 },
    { header: "Durum", key: "status", width: 12 },
  ];
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

async function exportFuelExcel(query) {
  const rows = fuelService.listAll(resolveQueryDates(query));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Yakıt");
  ws.columns = [
    { header: "Plaka", key: "plate", width: 14 },
    { header: "Litre", key: "liter", width: 10 },
    { header: "Birim Fiyat", key: "price_per_liter", width: 12 },
    { header: "Toplam", key: "total_amount", width: 12 },
    { header: "KM", key: "km", width: 10 },
    { header: "Tarih", key: "fuel_date", width: 14 },
  ];
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

module.exports = {
  exportTransactionsExcel,
  exportTransactionsCsv,
  exportFleetPdf,
  exportMaintenanceExcel,
  exportFuelExcel,
};
