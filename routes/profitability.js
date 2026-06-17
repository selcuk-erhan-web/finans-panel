const profitabilityService = require("../services/profitabilityService");
const profitService = require("../services/profitService");
const { profitabilityPage } = require("../lib/components/profitability");
const { renderLayout } = require("../lib/ui");

function registerProfitability(app) {
  app.get("/profitability", (req, res) => {
    try {
      const vehicleFilter = String(req.query.type || "").trim();
      const filterOpt =
        vehicleFilter === "Servis" || vehicleFilter === "Turizm"
          ? { vehicleType: vehicleFilter }
          : {};

      const rows = profitabilityService.getVehicleProfitability(filterOpt);
      const summary = profitabilityService.getFleetProfitSummary(rows);
      const rankedRows = profitService
        .getRankedVehicles(null, filterOpt)
        .map(profitService.toLegacyRow);
      const hasData = profitabilityService.hasSufficientData(rows);

      const content = profitabilityPage({
        summary,
        rows,
        rankedRows,
        hasData,
        vehicleFilter,
      });

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
