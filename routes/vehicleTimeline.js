const vehicleTimelineService = require("../services/vehicleTimelineService");
const { vehicleTimelinePageHtml } = require("../lib/components/vehicleTimeline");
const { renderLayout } = require("../lib/ui");

function parseOptions(req) {
  const options = {};
  if (req.query.date) options.date = new Date(String(req.query.date));
  if (req.query.source) options.source = String(req.query.source);
  if (req.query.severity) options.severity = String(req.query.severity);
  if (req.query.date_from) options.date_from = String(req.query.date_from);
  if (req.query.date_to) options.date_to = String(req.query.date_to);
  if (req.query.limit) options.limit = Number(req.query.limit);
  return options;
}

function registerVehicleTimeline(app) {
  app.get("/api/vehicle-timeline", (req, res) => {
    try {
      const payload = vehicleTimelineService.buildFleetTimelineSummary(parseOptions(req));
      res.json(payload);
    } catch (err) {
      console.error("GET /api/vehicle-timeline:", err);
      res.status(500).json({ error: err.message || "Araç operasyon geçmişi alınamadı." });
    }
  });

  app.get("/api/vehicle-timeline/:vehicleId", (req, res) => {
    try {
      const timeline = vehicleTimelineService.buildVehicleTimeline(
        req.params.vehicleId,
        parseOptions(req)
      );
      if (!timeline) {
        return res.status(404).json({ ok: false, error: "Araç bulunamadı." });
      }
      res.json(timeline);
    } catch (err) {
      console.error("GET /api/vehicle-timeline/:vehicleId:", err);
      res.status(500).json({ error: err.message || "Araç operasyon geçmişi alınamadı." });
    }
  });

  app.get("/vehicle-timeline", (req, res) => {
    try {
      const options = parseOptions(req);
      const vehicleId = req.query.vehicle_id ? String(req.query.vehicle_id) : null;
      const fleet = vehicleTimelineService.buildFleetTimelineSummary(options);
      const timeline = vehicleId
        ? vehicleTimelineService.buildVehicleTimeline(vehicleId, options)
        : null;
      const vehicles = dbVehicleList();

      const content = vehicleTimelinePageHtml({
        fleet,
        timeline,
        vehicles,
        filters: {
          vehicle_id: vehicleId,
          source: options.source || "",
          severity: options.severity || "",
          date_from: options.date_from || "",
          date_to: options.date_to || "",
          limit: options.limit || vehicleTimelineService.DEFAULT_LIMIT,
        },
        path: req.path,
      });

      renderLayout(res, "Araç Operasyon Geçmişi", content, "/vehicle-timeline", req, {
        pageTitle: "Araç Operasyon Geçmişi",
        breadcrumb: "Filo / Araç Operasyon Geçmişi",
      });
    } catch (err) {
      console.error("vehicle-timeline:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Araç operasyon geçmişi sayfası yüklenemedi."));
    }
  });
}

function dbVehicleList() {
  const db = require("../lib/db");
  return db.prepare("SELECT id, plate FROM vehicles ORDER BY plate ASC").all();
}

module.exports = registerVehicleTimeline;
