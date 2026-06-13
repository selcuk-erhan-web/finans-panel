const { getExpenseByCategory, getTypeTotals } = require("../lib/finance");
const { generateFinanceInsight } = require("../lib/insights");
const { chartOpts } = require("../lib/charts");
const dashboardService = require("../services/dashboardService");
const {
  renderPage,
  chartBoot,
  commandHeader,
  executiveFinancialPanel,
  commandInsightCompact,
  operationsCenter,
  financeTrendsPanel,
  financialMovementsPanel,
  splitInsightText,
} = require("../lib/components");

const CHART = {
  incomeFill: "rgba(16, 185, 129, 0.2)",
  expenseFill: "rgba(244, 63, 94, 0.2)",
};

function registerDashboard(app) {
  app.get("/", (req, res) => {
    const bundle = dashboardService.getDashboardBundle();
    const { totals, fleetStatus, vehicleCount, monthly, summaries, alerts } = bundle;
    const servis = getTypeTotals(summaries, "Servis");
    const turizm = getTypeTotals(summaries, "Turizm");
    const expenseByCat = getExpenseByCategory();
    const insightRaw = generateFinanceInsight({
      totals,
      summaries,
      servis,
      turizm,
      expenseByCat,
    });
    const insightParts = splitInsightText(insightRaw);
    const netTone = totals.balance >= 0 ? "profit" : "loss";

    const fuelExpenseTotal = expenseByCat["Yakıt"] || alerts.fuel30?.totalCost || 0;
    const fuelPct =
      totals.expense > 0
        ? Math.round((fuelExpenseTotal / totals.expense) * 100)
        : 0;

    const content = `
      <div class="dash page-enter command-center cockpit">
        ${commandHeader({
          vehicleCount,
          fleetStatus,
          fuelRecordCount: alerts.fuel30?.count || 0,
          maintenanceCount: alerts.upcomingCount || 0,
        })}
        ${executiveFinancialPanel({
          totals,
          netTone,
          servisIncome: servis.income,
          turizmIncome: turizm.income,
        })}
        <div class="cmd-mid">
          ${financeTrendsPanel()}
          <div class="cmd-ops-stack">
            ${commandInsightCompact(insightParts)}
            ${operationsCenter({ alerts, fuelPct, fuelExpenseTotal })}
          </div>
        </div>
        ${financialMovementsPanel(bundle.recentTransactions)}
      </div>
      ${chartBoot([
        `new Chart(document.getElementById("monthlyChart"),{
          type:"line",
          data:{labels:${JSON.stringify(monthly.labels)},datasets:[
            {label:"Gelir",data:${JSON.stringify(monthly.incomeData)},borderColor:"#10b981",backgroundColor:"${CHART.incomeFill}",fill:true,tension:0.45,borderWidth:3,pointRadius:0,pointHoverRadius:6},
            {label:"Gider",data:${JSON.stringify(monthly.expenseData)},borderColor:"#f43f5e",backgroundColor:"${CHART.expenseFill}",fill:true,tension:0.45,borderWidth:3,pointRadius:0,pointHoverRadius:6}
          ]},
          options:${chartOpts({
            scales: {
              y: { grid: { color: "rgba(15, 23, 42, 0.1)", drawTicks: false } },
              x: { grid: { display: true, color: "rgba(15, 23, 42, 0.07)", drawTicks: false } },
            },
          })}
        });`,
      ])}`;

    renderPage(res, {
      title: "Ana Ekran",
      subtitle: "Filo Operasyon Merkezi · Executive Dashboard",
      content,
      path: "/",
      req,
    });
  });
}

module.exports = registerDashboard;
