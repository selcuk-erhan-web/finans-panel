const executiveVehicleDashboardService = require("../services/executiveVehicleDashboardService");
const { executiveVehicleDashboardPageHtml } = require("../lib/components/executiveVehicleDashboard");
const { renderLayout } = require("../lib/ui");

function parseOptions(req) {
  const options = {};
  if (req.query.date) options.date = new Date(String(req.query.date));
  return options;
}

function registerExecutiveVehicleDashboard(app) {
  app.get("/api/executive-vehicle-dashboard", (req, res) => {
    try {
      const payload = executiveVehicleDashboardService.buildExecutiveVehicleDashboard(parseOptions(req));
      res.json(payload);
    } catch (err) {
      console.error("GET /api/executive-vehicle-dashboard:", err);
      res.status(500).json({ error: err.message || "Yönetici araç zekâsı alınamadı." });
    }
  });

  app.get("/executive-vehicle-dashboard", (req, res) => {
    try {
      const payload = executiveVehicleDashboardService.buildExecutiveVehicleDashboard(parseOptions(req));
      const content = executiveVehicleDashboardPageHtml(payload, req.path);

      renderLayout(res, "Yönetici Araç Zekâsı", content, "/executive-vehicle-dashboard", req, {
        pageTitle: "Yönetici Araç Zekâsı",
        breadcrumb: "Filo / Yönetici Araç Zekâsı",
      });
    } catch (err) {
      console.error("executive-vehicle-dashboard:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Yönetici araç zekâsı sayfası yüklenemedi."));
    }
  });
}

module.exports = registerExecutiveVehicleDashboard;
