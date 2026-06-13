const profitabilityService = require("../services/profitabilityService");
const { profitabilityPage } = require("../lib/components/profitability");
const { renderLayout } = require("../lib/ui");

function registerProfitability(app) {
  app.get("/profitability", (req, res) => {
    try {
      const rows = profitabilityService.getVehicleProfitability();
      const summary = profitabilityService.getFleetProfitSummary(rows);
      const topVehicles = profitabilityService.getTopProfitableVehicles(5, rows);
      const hasData = profitabilityService.hasSufficientData(rows);

      const content = profitabilityPage({ summary, rows, topVehicles, hasData });

      renderLayout(res, "Araç Karlılık Merkezi", content, "/reports", req, {
        pageTitle: "Araç Karlılık Merkezi",
        breadcrumb: "Analizler / Araç Karlılık Merkezi",
      });
    } catch (err) {
      console.error("profitability:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Kârlılık analizi yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerProfitability;
