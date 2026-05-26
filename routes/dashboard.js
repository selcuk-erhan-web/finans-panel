const db = require("../lib/db");
const { VEHICLE_TARGET } = require("../lib/constants");
const { getThisMonthRange } = require("../lib/dates");
const {
  money,
  getTotals,
  getAllVehicleSummaries,
  getExpenseByCategory,
  getTypeTotals,
  getBestWorst,
  getAverageVehicleNet,
  getTotalsInRange,
} = require("../lib/finance");
const {
  pageHeader,
  kpiCard,
  kpiGrid,
  vehicleSummaryRow,
  dataTable,
  chartScripts,
  renderLayout,
  escapeHtml,
} = require("../lib/ui");

const CHART_COLORS = {
  income: "#059669",
  expense: "#e11d48",
  net: "#4f46e5",
  servis: "#6366f1",
  turizm: "#f59e0b",
};

function registerDashboard(app) {
  app.get("/", (req, res) => {
    const summaries = getAllVehicleSummaries();
    const totals = getTotals();
    const vehicleCount = db.prepare("SELECT COUNT(*) as c FROM vehicles").get().c;
    const { best, worst } = getBestWorst(summaries);
    const avgNet = getAverageVehicleNet(summaries);
    const monthRange = getThisMonthRange();
    const monthTotals = getTotalsInRange(monthRange.date_from, monthRange.date_to);
    const servis = getTypeTotals(summaries, "Servis");
    const turizm = getTypeTotals(summaries, "Turizm");
    const expenseByCat = getExpenseByCategory();
    const catLabels = Object.keys(expenseByCat);
    const catValues = catLabels.map((k) => expenseByCat[k]);

    const content = `
      ${pageHeader("Ana Sayfa", "Filo finans özeti — yalnızca analiz ekranı")}
      ${kpiGrid([
        kpiCard("Toplam Gelir", money(totals.income), "green"),
        kpiCard("Toplam Gider", money(totals.expense), "red"),
        kpiCard("Net Kâr", money(totals.balance), totals.balance >= 0 ? "green" : "red"),
        kpiCard("Araç Sayısı", String(vehicleCount), "blue", `${vehicleCount} / ${VEHICLE_TARGET}`),
        kpiCard("Ortalama Araç Neti", money(avgNet), avgNet >= 0 ? "green" : "red"),
        kpiCard("En Kârlı Araç", escapeHtml(best.plate), "green", best.net !== null ? money(best.net) : "-"),
        kpiCard("En Masraflı Araç", escapeHtml(worst.plate), "red", worst.net !== null ? money(worst.net) : "-"),
        kpiCard("Bu Ay Gelir", money(monthTotals.income), "green"),
        kpiCard("Bu Ay Gider", money(monthTotals.expense), "red"),
      ])}
      <div class="grid2">
        <div class="card"><h2>Gelir / Gider Dağılımı</h2><div class="chart-box"><canvas id="pieChart"></canvas></div></div>
        <div class="card"><h2>Gelir · Gider · Net</h2><div class="chart-box"><canvas id="barChart"></canvas></div></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Gider Kategori Dağılımı</h2><div class="chart-box"><canvas id="expenseCatChart"></canvas></div></div>
        <div class="card"><h2>Servis vs Turizm</h2><div class="chart-box"><canvas id="fleetChart"></canvas></div></div>
      </div>
      <div class="card">
        <h2>Araç Finans Özeti</h2>
        ${dataTable(
          ["Plaka", "Araç Tipi", "Toplam Gelir", "Toplam Gider", "Net Kâr", "Durum", ""],
          summaries.map(vehicleSummaryRow),
          { icon: "🚗", title: "Araç yok", desc: "Özet için araç ekleyin.", action: '<a class="btn" href="/vehicles">Araç Ekle</a>' }
        )}
      </div>
      ${chartScripts([
        `const C=${JSON.stringify(CHART_COLORS)};`,
        `new Chart(document.getElementById("pieChart"),{type:"doughnut",data:{labels:["Gelir","Gider"],datasets:[{data:[${totals.income},${totals.expense}],backgroundColor:[C.income,C.expense]}]},options:{responsive:true,maintainAspectRatio:false}});`,
        `new Chart(document.getElementById("barChart"),{type:"bar",data:{labels:["Gelir","Gider","Net"],datasets:[{data:[${totals.income},${totals.expense},${totals.balance}],backgroundColor:[C.income,C.expense,C.net],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});`,
        catLabels.length
          ? `new Chart(document.getElementById("expenseCatChart"),{type:"doughnut",data:{labels:${JSON.stringify(catLabels)},datasets:[{data:${JSON.stringify(catValues)}}]},options:{responsive:true,maintainAspectRatio:false}});`
          : "",
        `new Chart(document.getElementById("fleetChart"),{type:"bar",data:{labels:["Gelir","Gider","Net"],datasets:[{label:"Servis",data:[${servis.income},${servis.expense},${servis.net}],backgroundColor:C.servis,borderRadius:6},{label:"Turizm",data:[${turizm.income},${turizm.expense},${turizm.net}],backgroundColor:C.turizm,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});`,
      ])}`;

    renderLayout(res, "Ana Sayfa", content, "/", req);
  });
}

module.exports = registerDashboard;
