const vehicleProfitRiskService = require("../services/vehicleProfitRiskService");
const { vehicleProfitRiskPageHtml } = require("../lib/components/vehicleProfitRisk");
const { renderLayout } = require("../lib/ui");

function parseOptions(req) {
  const options = {};
  if (req.query.date) options.date = new Date(String(req.query.date));
  return options;
}

function registerVehicleProfitRisk(app) {
  app.get("/api/vehicle-profit-risk", (req, res) => {
    try {
      const payload = vehicleProfitRiskService.buildFleetVehicleProfitRisk(parseOptions(req));
      res.json(payload);
    } catch (err) {
      console.error("GET /api/vehicle-profit-risk:", err);
      res.status(500).json({ error: err.message || "Araç kâr/risk analizi alınamadı." });
    }
  });

  app.get("/api/vehicle-profit-risk/:vehicleId", (req, res) => {
    try {
      const report = vehicleProfitRiskService.buildVehicleProfitRisk(
        req.params.vehicleId,
        parseOptions(req)
      );
      if (!report) {
        return res.status(404).json({ ok: false, error: "Araç bulunamadı." });
      }
      res.json(report);
    } catch (err) {
      console.error("GET /api/vehicle-profit-risk/:vehicleId:", err);
      res.status(500).json({ error: err.message || "Araç kâr/risk analizi alınamadı." });
    }
  });

  app.get("/vehicle-profit-risk", (req, res) => {
    try {
      const payload = vehicleProfitRiskService.buildFleetVehicleProfitRisk(parseOptions(req));
      const content = vehicleProfitRiskPageHtml(payload);

      renderLayout(res, "Araç Kâr / Risk Analizi", content, "/vehicle-profit-risk", req, {
        pageTitle: "Araç Kâr / Risk Analizi",
        breadcrumb: "Filo / Araç Kâr / Risk Analizi",
      });
    } catch (err) {
      console.error("vehicle-profit-risk:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Araç kâr/risk analizi sayfası yüklenemedi."));
    }
  });
}

module.exports = registerVehicleProfitRisk;
