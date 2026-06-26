const { getTypeTotals } = require("../lib/finance");
const { chartOpts } = require("../lib/charts");
const dashboardService = require("../services/dashboardService");
const {
  renderPage,
  chartBoot,
  commandHeader,
  executiveFinancialPanel,
  executiveProfitSummary,
  vehicleProfitRankPanel,
  operationsCenter,
  dashboardFinanceTrendPanel,
  buildUpcomingWorkCenterContext,
  upcomingWorkCenterHtml,
  financialMovementsPanel,
} = require("../lib/components");
const { dashboardAlertsPanel } = require("../lib/components/alerts");
const { complianceDashboardWidgetHtml } = require("../lib/components/complianceDashboard");
const { maintenanceDashboardWidgetHtml } = require("../lib/components/maintenanceDashboard");
const { tireDashboardWidgetHtml } = require("../lib/components/tireDashboard");
const { auditDashboardWidgetHtml } = require("../lib/components/auditDashboard");
const { vehicleHealthDashboardWidgetHtml } = require("../lib/components/vehicleHealth");
const { vehicleProfitRiskDashboardWidgetHtml } = require("../lib/components/vehicleProfitRisk");
const { executiveVehicleDashboardWidgetHtml } = require("../lib/components/executiveVehicleDashboard");
const {
  buildDashboardCommandBarContext,
  buildFleetHealthCenterContext,
  buildExecutiveRiskRadarContext,
  buildExecutiveInsightsContext,
  executiveCommandCenter,
  executiveRiskRadarHtml,
  fleetHealthCenterHtml,
  executiveInsightsHtml,
} = require("../lib/components/executiveIntelligence");

const CHART = {
  incomeFill: "rgba(16, 185, 129, 0.2)",
  expenseFill: "rgba(244, 63, 94, 0.2)",
};

function registerDashboard(app) {
  app.get("/", (req, res) => {
    const bundle = dashboardService.getDashboardBundle();
    const { fleetStatus, vehicleCount, monthly, alerts, profit, corporateAlerts, cashflow } = bundle;
    const servis = getTypeTotals(bundle.summaries, "Servis");
    const turizm = getTypeTotals(bundle.summaries, "Turizm");
    const incomeTotals = alerts.incomeByCategory || {};
    const servisIncome = incomeTotals.service ?? servis.income;
    const turizmIncome = incomeTotals.tourism ?? turizm.income;

    const netProfit = profit?.summary?.totalNet ?? 0;
    const totalExpense = profit?.summary?.totalExpense ?? 0;
    const avgProfitPerVehicle = profit?.summary?.avgProfitPerVehicle ?? 0;
    const netTone = netProfit > 0 ? "profit" : netProfit < 0 ? "loss" : "neutral";
    const commandBarContext = buildDashboardCommandBarContext({
      fleetStatus,
      vehicleCount,
      profit,
      corporateAlerts,
      alerts,
    });
    const upcomingWorkContext = buildUpcomingWorkCenterContext({
      fleetStatus,
      vehicleCount,
      profit,
      corporateAlerts,
      alerts,
    });
    const fleetHealthContext = buildFleetHealthCenterContext({
      fleetStatus,
      vehicleCount,
      profit,
      corporateAlerts,
      alerts,
    });
    const riskRadarContext = buildExecutiveRiskRadarContext({
      fleetStatus,
      vehicleCount,
      profit,
      corporateAlerts,
      alerts,
    });
    const insightsContext = buildExecutiveInsightsContext({
      fleetStatus,
      vehicleCount,
      profit,
    });

    const content = `
      <div class="dash page-enter command-center cockpit">
        ${commandHeader({
          vehicleCount,
          fleetStatus,
          fuelRecordCount: alerts.fuel30?.count || 0,
          maintenanceCount: alerts.upcomingCount || 0,
        })}
        ${executiveCommandCenter(commandBarContext)}
        ${executiveFinancialPanel({
          netProfit,
          netTone,
          servisIncome,
          turizmIncome,
          totalExpense,
          avgProfitPerVehicle,
          cashflow,
        })}
        <div class="dashboard-executive-row">
          ${upcomingWorkCenterHtml(upcomingWorkContext)}
          ${dashboardFinanceTrendPanel()}
        </div>
        ${executiveInsightsHtml(insightsContext)}
        <div class="dashboard-legacy-widgets" aria-hidden="true" hidden>
          ${executiveRiskRadarHtml(riskRadarContext)}
          ${fleetHealthCenterHtml(fleetHealthContext)}
          ${financialMovementsPanel(bundle.recentTransactions)}
          ${dashboardAlertsPanel(corporateAlerts)}
          ${complianceDashboardWidgetHtml()}
          ${maintenanceDashboardWidgetHtml()}
          ${tireDashboardWidgetHtml()}
          ${auditDashboardWidgetHtml()}
          <div class="cmd-vi-widget-stack">
            ${vehicleHealthDashboardWidgetHtml()}
            ${vehicleProfitRiskDashboardWidgetHtml()}
            ${executiveVehicleDashboardWidgetHtml()}
          </div>
          ${executiveProfitSummary({ profit })}
          ${vehicleProfitRankPanel({ profit })}
          ${operationsCenter({ alerts, profitExpense: profit?.expenseBreakdown })}
        </div>
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
      subtitle: "Filo Operasyon Merkezi · Yönetici Özeti",
      content,
      path: "/",
      req,
    });
  });
}

module.exports = registerDashboard;
