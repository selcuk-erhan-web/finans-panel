const tireAnalyticsService = require("../services/tireAnalyticsService");
const { tireAnalyticsPageHtml } = require("../lib/components/tireAnalytics");
const { renderLayout } = require("../lib/ui");

function registerTireAnalytics(app) {
  app.get("/api/tires/analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = tireAnalyticsService.buildTireAnalytics(ref);
      res.json(analytics);
    } catch (err) {
      console.error("GET /api/tires/analytics:", err);
      res.status(500).json({ error: err.message || "Lastik analitiği alınamadı." });
    }
  });

  app.get("/tire-analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = tireAnalyticsService.buildTireAnalytics(ref);
      const content = tireAnalyticsPageHtml(analytics, req.path);

      renderLayout(res, "Lastik Analitiği", content, "/tire-analytics", req, {
        pageTitle: "Lastik Analitiği",
        breadcrumb: "Filo / Lastik Analitiği",
      });
    } catch (err) {
      console.error("tire-analytics:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Lastik analitiği yüklenemedi."));
    }
  });
}

module.exports = registerTireAnalytics;
