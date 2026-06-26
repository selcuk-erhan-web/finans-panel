const tireSeasonalSchedulerService = require("../services/tireSeasonalSchedulerService");
const tireAlertService = require("../services/tireAlertService");
const { tireSeasonalSchedulePageHtml } = require("../lib/components/tireSeasonalSchedule");
const { getVehicles } = require("./vehicles");
const { renderLayout, errorPage } = require("../lib/ui");

function renderTireSeasonalSchedulePage(req, res) {
  const vehicles = getVehicles();
  const filters = { vehicle_id: req.query.vehicle_id || "" };
  const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
  const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref, filters);
  const selectedVehicle = filters.vehicle_id
    ? vehicles.find((v) => String(v.id) === String(filters.vehicle_id))
    : null;

  const content = tireSeasonalSchedulePageHtml({
    report,
    vehicles,
    filters,
    selectedVehiclePlate: selectedVehicle?.plate || "",
    path: req.path,
  });

  renderLayout(res, "Lastik Sezon Planı", content, "/tire-seasonal-schedule", req, {
    pageTitle: "Lastik Sezon Planı",
    breadcrumb: "Filo / Lastik Sezon Planı",
  });
}

function registerTireSeasonalSchedule(app) {
  app.get("/api/tires/seasonal-schedule", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const filters = { vehicle_id: req.query.vehicle_id || "" };
      tireAlertService.generateTireAlerts(ref);
      const report = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref, filters);
      res.json({ ok: true, ...report });
    } catch (err) {
      console.error("GET /api/tires/seasonal-schedule:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik sezon planı alınamadı." });
    }
  });

  app.get("/tire-seasonal-schedule", (req, res) => {
    try {
      renderTireSeasonalSchedulePage(req, res);
    } catch (err) {
      console.error("tire-seasonal-schedule:", err);
      res.status(500).send(errorPage("Hata", "Lastik sezon planı yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerTireSeasonalSchedule;
