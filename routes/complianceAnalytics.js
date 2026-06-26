const complianceAnalyticsService = require("../services/complianceAnalyticsService");
const { complianceAnalyticsPageHtml } = require("../lib/components/complianceAnalytics");
const { renderLayout } = require("../lib/ui");

function registerComplianceAnalytics(app) {
  app.get("/api/compliance/analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = complianceAnalyticsService.buildComplianceAnalytics(ref);
      res.json(analytics);
    } catch (err) {
      console.error("api/compliance/analytics:", err);
      res.status(500).json({ error: err.message || "Uygunluk analitiği alınamadı." });
    }
  });

  app.get("/compliance-analytics", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const analytics = complianceAnalyticsService.buildComplianceAnalytics(ref);
      const content = complianceAnalyticsPageHtml(analytics, req.path);

      renderLayout(res, "Uygunluk Analitiği", content, "/compliance-analytics", req, {
        pageTitle: "Compliance Analytics",
        breadcrumb: "Filo / Uygunluk Analitiği",
      });
    } catch (err) {
      console.error("compliance-analytics page:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Uygunluk analitiği yüklenemedi."));
    }
  });
}

module.exports = registerComplianceAnalytics;
