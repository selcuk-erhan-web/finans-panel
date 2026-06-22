const vehicleIntelligenceService = require("../services/vehicleIntelligenceService");
const {
  vehicleIntelligencePageHtml,
} = require("../lib/components/vehicleIntelligence");
const { renderLayout } = require("../lib/ui");

function parseOptions(req) {
  const options = {};
  if (req.query.date) options.date = new Date(String(req.query.date));
  if (req.query.plate) options.plate = String(req.query.plate);
  return options;
}

function registerVehicleIntelligence(app) {
  app.get("/api/vehicle-intelligence", (req, res) => {
    try {
      const payload = vehicleIntelligenceService.buildFleetVehicleIntelligence(parseOptions(req));
      res.json(payload);
    } catch (err) {
      console.error("GET /api/vehicle-intelligence:", err);
      res.status(500).json({ error: err.message || "Araç zekâsı alınamadı." });
    }
  });

  app.get("/api/vehicle-intelligence/:vehicleId", (req, res) => {
    try {
      const intelligence = vehicleIntelligenceService.buildVehicleIntelligence(
        req.params.vehicleId,
        parseOptions(req)
      );
      if (!intelligence) {
        return res.status(404).json({ ok: false, error: "Araç bulunamadı." });
      }
      res.json(intelligence);
    } catch (err) {
      console.error("GET /api/vehicle-intelligence/:vehicleId:", err);
      res.status(500).json({ error: err.message || "Araç zekâsı alınamadı." });
    }
  });

  app.get("/vehicle-intelligence", (req, res) => {
    try {
      const payload = vehicleIntelligenceService.buildFleetVehicleIntelligence(parseOptions(req));
      const content = vehicleIntelligencePageHtml(payload);

      renderLayout(res, "Araç Zekâsı", content, "/vehicle-intelligence", req, {
        pageTitle: "Araç Zekâsı",
        breadcrumb: "Filo / Araç Zekâsı",
      });
    } catch (err) {
      console.error("vehicle-intelligence:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Araç zekâsı sayfası yüklenemedi."));
    }
  });
}

module.exports = registerVehicleIntelligence;
