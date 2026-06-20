const maintenanceAnalyticsService = require("../services/maintenanceAnalyticsService");
const { maintenanceAnalyticsPageHtml } = require("../lib/components/maintenanceAnalytics");
const { renderLayout } = require("../lib/ui");

function registerMaintenanceAnalytics(app) {
  app.get("/api/maintenance/analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = maintenanceAnalyticsService.buildMaintenanceAnalytics(ref);
      res.json(analytics);
    } catch (err) {
      console.error("GET /api/maintenance/analytics:", err);
      res.status(500).json({ error: err.message || "Bakım analitiği alınamadı." });
    }
  });

  app.get("/maintenance-analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = maintenanceAnalyticsService.buildMaintenanceAnalytics(ref);
      const content = maintenanceAnalyticsPageHtml(analytics);

      renderLayout(res, "Bakım Analitiği", content, "/maintenance-analytics", req, {
        pageTitle: "Bakım Analitiği",
        breadcrumb: "Filo / Bakım Analitiği",
      });
    } catch (err) {
      console.error("maintenance-analytics:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Bakım analitiği yüklenemedi."));
    }
  });
}

module.exports = registerMaintenanceAnalytics;
