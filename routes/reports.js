const {
  money,
  getTotals,
  getAllVehicleSummaries,
  getExpenseByCategory,
  getTypeTotals,
  getBestWorst,
  getStatusCounts,
  getTopExpenseCategory,
} = require("../lib/finance");
const { generateFinanceInsight } = require("../lib/insights");
const {
  pageHeader,
  kpiCard,
  kpiGrid,
  vehicleSummaryRow,
  dataTable,
  chartScripts,
  insightBox,
  statusAnalysisGrid,
  renderLayout,
  escapeHtml,
} = require("../lib/ui");

function registerReports(app) {
  app.get("/reports", (req, res) => {
    const summaries = getAllVehicleSummaries().sort((a, b) => b.net - a.net);
    const totals = getTotals();
    const { best, worst } = getBestWorst(summaries);
    const servis = getTypeTotals(summaries, "Servis");
    const turizm = getTypeTotals(summaries, "Turizm");
    const expenseByCat = getExpenseByCategory();
    const catLabels = Object.keys(expenseByCat);
    const catValues = catLabels.map((k) => expenseByCat[k]);
    const topCat = getTopExpenseCategory(expenseByCat);
    const statusCounts = getStatusCounts(summaries);

    const insight = generateFinanceInsight({
      totals,
      summaries,
      servis,
      turizm,
      expenseByCat,
    });

    const content = `
      ${pageHeader("Analizler", "Kârlılık, gider dağılımı ve filo karşılaştırması")}
      ${insightBox(insight)}
      ${statusAnalysisGrid(statusCounts)}
      ${kpiGrid([
        kpiCard("En Kârlı Araç", escapeHtml(best.plate), "green", best.net !== null ? money(best.net) : "-"),
        kpiCard("En Masraflı Araç", escapeHtml(worst.plate), "red", worst.net !== null ? money(worst.net) : "-"),
        kpiCard("En Çok Gider Kalemi", escapeHtml(topCat.name), "amber", money(topCat.amount)),
        kpiCard("Servis Net", money(servis.net), servis.net >= 0 ? "green" : "red", `${servis.count} araç`),
        kpiCard("Turizm Net", money(turizm.net), turizm.net >= 0 ? "green" : "red", `${turizm.count} araç`),
      ])}
      <div class="grid2">
        <div class="card"><h2>Gider Kategori Dağılımı</h2><div class="chart-box"><canvas id="expensePie"></canvas></div></div>
        <div class="card"><h2>Servis vs Turizm</h2><div class="chart-box"><canvas id="fleetCompare"></canvas></div></div>
      </div>
      <div class="grid2">
        <div class="card">
          <h2>Servis Filosu</h2>
          <table>
            <tr><th>Gelir</th><td class="green">${money(servis.income)}</td></tr>
            <tr><th>Gider</th><td class="red">${money(servis.expense)}</td></tr>
            <tr><th>Net</th><td class="${servis.net >= 0 ? "green" : "red"}">${money(servis.net)}</td></tr>
          </table>
        </div>
        <div class="card">
          <h2>Turizm Filosu</h2>
          <table>
            <tr><th>Gelir</th><td class="green">${money(turizm.income)}</td></tr>
            <tr><th>Gider</th><td class="red">${money(turizm.expense)}</td></tr>
            <tr><th>Net</th><td class="${turizm.net >= 0 ? "green" : "red"}">${money(turizm.net)}</td></tr>
          </table>
        </div>
      </div>
      <div class="card">
        <h2>Araç Kârlılık Sıralaması</h2>
        ${dataTable(
          ["Plaka", "Araç Tipi", "Toplam Gelir", "Toplam Gider", "Net Kâr", "Durum", ""],
          summaries.map(vehicleSummaryRow),
          { icon: "📊", title: "Veri yok", desc: "Analiz için araç ve işlem ekleyin." }
        )}
      </div>
      ${chartScripts([
        catLabels.length
          ? `new Chart(document.getElementById("expensePie"),{type:"doughnut",data:{labels:${JSON.stringify(catLabels)},datasets:[{data:${JSON.stringify(catValues)}}]},options:{responsive:true,maintainAspectRatio:false}});`
          : "",
        `new Chart(document.getElementById("fleetCompare"),{type:"bar",data:{labels:["Gelir","Gider","Net"],datasets:[{label:"Servis",data:[${servis.income},${servis.expense},${servis.net}],backgroundColor:"#6366f1",borderRadius:6},{label:"Turizm",data:[${turizm.income},${turizm.expense},${turizm.net}],backgroundColor:"#f59e0b",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});`,
      ])}`;

    renderLayout(res, "Analizler", content, "/reports", req);
  });
}

module.exports = registerReports;
