const auditAnalyticsService = require("../services/auditAnalyticsService");
const { auditAnalyticsPageHtml } = require("../lib/components/auditAnalytics");
const { renderLayout } = require("../lib/ui");

function parseFilters(query = {}) {
  return {
    module: query.module || "",
    action: query.action || "",
    actor_id: query.actor_id || "",
    date_from: query.date_from || "",
    date_to: query.date_to || "",
    date: query.date || "",
  };
}

function registerAuditAnalytics(app) {
  app.get("/api/audit/analytics", (req, res) => {
    try {
      const filters = parseFilters(req.query || {});
      const ref = filters.date ? new Date(String(filters.date)) : new Date();
      const analytics = auditAnalyticsService.buildAuditAnalytics(ref, filters);
      res.json(analytics);
    } catch (err) {
      console.error("GET /api/audit/analytics:", err);
      const ref = req.query?.date ? new Date(String(req.query.date)) : new Date();
      res.json(auditAnalyticsService.emptyAnalytics(ref));
    }
  });

  app.get("/audit-analytics", (req, res) => {
    try {
      const filters = parseFilters(req.query || {});
      const ref = filters.date ? new Date(String(filters.date)) : new Date();
      const analytics = auditAnalyticsService.buildAuditAnalytics(ref, filters);
      const content = auditAnalyticsPageHtml(analytics, filters);

      renderLayout(res, "Denetim Analitiği", content, "/audit-analytics", req, {
        pageTitle: "Denetim Analitiği",
        breadcrumb: "Sistem / Denetim Analitiği",
      });
    } catch (err) {
      console.error("audit-analytics:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Denetim analitiği yüklenemedi."));
    }
  });
}

module.exports = registerAuditAnalytics;
