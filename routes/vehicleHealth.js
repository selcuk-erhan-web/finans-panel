const vehicleHealthService = require("../services/vehicleHealthService");
const { vehicleHealthPageHtml } = require("../lib/components/vehicleHealth");
const { renderLayout } = require("../lib/ui");

function parseOptions(req) {
  const options = {};
  if (req.query.date) options.date = new Date(String(req.query.date));
  return options;
}

function registerVehicleHealth(app) {
  app.get("/api/vehicle-health", (req, res) => {
    try {
      const payload = vehicleHealthService.buildFleetVehicleHealthReport(parseOptions(req));
      res.json(payload);
    } catch (err) {
      console.error("GET /api/vehicle-health:", err);
      res.status(500).json({ error: err.message || "Araç sağlık skoru alınamadı." });
    }
  });

  app.get("/api/vehicle-health/:vehicleId", (req, res) => {
    try {
      const report = vehicleHealthService.buildVehicleHealthReport(
        req.params.vehicleId,
        parseOptions(req)
      );
      if (!report) {
        return res.status(404).json({ ok: false, error: "Araç bulunamadı." });
      }
      res.json(report);
    } catch (err) {
      console.error("GET /api/vehicle-health/:vehicleId:", err);
      res.status(500).json({ error: err.message || "Araç sağlık skoru alınamadı." });
    }
  });

  app.get("/vehicle-health", (req, res) => {
    try {
      const payload = vehicleHealthService.buildFleetVehicleHealthReport(parseOptions(req));
      const content = vehicleHealthPageHtml(payload, req.path);

      renderLayout(res, "Araç Sağlık Skoru", content, "/vehicle-health", req, {
        pageTitle: "Araç Sağlık Skoru",
        breadcrumb: "Filo / Araç Sağlık Skoru",
      });
    } catch (err) {
      console.error("vehicle-health:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Araç sağlık skoru sayfası yüklenemedi."));
    }
  });
}

module.exports = registerVehicleHealth;
