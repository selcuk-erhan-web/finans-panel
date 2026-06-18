const profitabilityService = require("../services/profitabilityService");
const {
  money,
  getTotals,
  getAllVehicleSummaries,
  getExpenseByCategory,
  getTypeTotals,
  getStatusCounts,
  getTopExpenseCategory,
  getHighestExpenseVehicle,
} = require("../lib/finance");
const { generateFinanceInsight } = require("../lib/insights");
const { chartOpts } = require("../lib/charts");
const {
  metricCard,
  metricGrid,
  chartBoot,
  premiumInsight,
  statusAnalysisGrid,
  categoryCardGrid,
  vehicleRankCards,
  glassPanel,
  renderLayout,
  escapeHtml,
} = require("../lib/ui");

function registerReports(app) {
  app.get("/reports", (req, res) => {
    try {
      const summaries = getAllVehicleSummaries().sort((a, b) => b.net - a.net);
      const profitRows = profitabilityService.getVehicleProfitability();
      const topProfit = profitabilityService.getTopProfitableVehicles(1, profitRows)[0];
      const worstProfit = profitRows
        .filter((r) => !r.isUnassigned && (r.income > 0 || r.totalExpense > 0))
        .sort((a, b) => a.netProfit - b.netProfit)[0];
      const costlyRow = profitRows
        .filter((r) => !r.isUnassigned)
        .sort((a, b) => b.totalExpense - a.totalExpense)[0];
      const costly = costlyRow
        ? { plate: costlyRow.plate, expense: costlyRow.totalExpense }
        : getHighestExpenseVehicle(summaries);
      const profitRankSummaries = profitabilityService.getTopProfitableVehicles(12, profitRows).map((r) => ({
        id: r.vehicleId,
        plate: r.plate,
        income: r.income,
        expense: r.totalExpense,
        net: r.netProfit,
      }));
      const best = topProfit
        ? { plate: topProfit.plate, net: topProfit.netProfit, id: topProfit.vehicleId }
        : { plate: "—", net: null, id: null };
      const worst = worstProfit
        ? { plate: worstProfit.plate, net: worstProfit.netProfit, id: worstProfit.vehicleId }
        : { plate: "—", net: null, id: null };
      const totals = getTotals();
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
        <div class="dash page-enter">
          ${premiumInsight(insight)}
          ${statusAnalysisGrid(statusCounts)}
          ${metricGrid(
            [
              metricCard({
                label: "En kârlı araç",
                value: escapeHtml(best.plate),
                hint: best.net !== null ? `Net: ${money(best.net)}` : "—",
                tone: "profit",
                icon: "★",
              }),
              metricCard({
                label: "En masraflı araç",
                value: escapeHtml(costly.plate),
                hint: costly.expense ? `Gider: ${money(costly.expense)}` : "—",
                tone: "expense",
                icon: "↓",
              }),
              metricCard({
                label: "En çok gider kalemi",
                value: escapeHtml(topCat.name),
                hint: money(topCat.amount),
                tone: "fleet",
                icon: "◆",
              }),
              metricCard({
                label: "En düşük net",
                value: escapeHtml(worst.plate),
                hint: worst.net !== null ? `Net: ${money(worst.net)}` : "—",
                tone: worst.net >= 0 ? "profit" : "loss",
                icon: "!",
              }),
            ],
            "4"
          )}
          <div class="dash-split fade-in" style="--delay:80ms">
            ${glassPanel({
              title: "Gider kategori dağılımı",
              desc: "Pie chart · filo geneli",
              body: `<div class="chart-wrap chart-wrap--modern"><canvas id="expensePie"></canvas></div>`,
            })}
            <section class="panel fade-in" style="--delay:100ms">
              <header class="panel__head">
                <div>
                  <h2 class="panel__title">Kategori kartları</h2>
                  <p class="panel__desc">Progress bar ile gider payı</p>
                </div>
              </header>
              <div class="panel__body">${categoryCardGrid(expenseByCat)}</div>
            </section>
          </div>
          <div class="dash-split fade-in" style="--delay:120ms">
            ${glassPanel({
              title: "Servis vs Turizm",
              body: `<div class="chart-wrap chart-wrap--modern"><canvas id="fleetCompare"></canvas></div>`,
            })}
            <section class="panel">
              <header class="panel__head">
                <div>
                  <h2 class="panel__title">Filo tip özeti</h2>
                </div>
              </header>
              <div class="panel__body">
                <div class="info-grid">
                  <div class="info-item"><span>Servis net</span><strong class="${servis.net >= 0 ? "text-pos" : "text-neg"}">${money(servis.net)}</strong></div>
                  <div class="info-item"><span>Turizm net</span><strong class="${turizm.net >= 0 ? "text-pos" : "text-neg"}">${money(turizm.net)}</strong></div>
                </div>
              </div>
            </section>
          </div>
          <section class="fade-in" style="--delay:160ms">
            <header class="section-head">
              <div>
                <h2 class="section-head__title">Araç kârlılık sıralaması</h2>
                <p class="section-head__desc">Kârlılık motoru · net kâra göre sıralama</p>
              </div>
              <a href="/vehicles" class="btn btn--ghost btn--sm">Araç Merkezi →</a>
            </header>
            ${vehicleRankCards(profitRankSummaries.length ? profitRankSummaries : summaries, 12)}
          </section>
        </div>
        ${chartBoot([
          catLabels.length
            ? `new Chart(document.getElementById("expensePie"),{type:"doughnut",data:{labels:${JSON.stringify(catLabels)},datasets:[{data:${JSON.stringify(catValues)},backgroundColor:["#6366f1","#f43f5e","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899"],borderWidth:0,hoverOffset:8}]},options:${chartOpts({ cutout: "62%", plugins: { legend: { position: "bottom" } } })}});`
            : "",
          `new Chart(document.getElementById("fleetCompare"),{type:"bar",data:{labels:["Gelir","Gider","Net"],datasets:[{label:"Servis",data:[${servis.income},${servis.expense},${servis.net}],backgroundColor:"#6366f1",borderRadius:10},{label:"Turizm",data:[${turizm.income},${turizm.expense},${turizm.net}],backgroundColor:"#f59e0b",borderRadius:10}]},options:${chartOpts()}});`,
        ])}`;

      renderLayout(res, "Analizler", content, "/reports", req, {
        pageTitle: "Analizler",
        breadcrumb: "Raporlar / Görsel Analiz",
      });
    } catch (err) {
      console.error("reports:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Analizler yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerReports;
