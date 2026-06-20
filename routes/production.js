const productionReadinessService = require("../services/productionReadinessService");
const { productionReleasePageHtml } = require("../lib/components/productionRelease");
const { renderLayout } = require("../lib/ui");

function registerProduction(app) {
  app.get("/api/production/readiness", (_req, res) => {
    try {
      const readiness = productionReadinessService.buildProductionReadiness();
      res.json({
        version: readiness.version,
        status: readiness.status,
        production_ready: readiness.production_ready,
        support_level: readiness.support_level,
        known_issues_count: readiness.known_issues_count,
        inventory_summary: readiness.inventory_summary,
      });
    } catch (err) {
      console.error("GET /api/production/readiness:", err);
      res.json({
        version: "1.0.0",
        status: "production",
        production_ready: false,
        support_level: "unknown",
        known_issues_count: 0,
        inventory_summary: {},
      });
    }
  });

  app.get("/production", (_req, res) => {
    try {
      const data = productionReadinessService.buildProductionPageData();
      const content = productionReleasePageHtml(data);

      renderLayout(res, "FleetOS v1.0.0", content, "/production", _req, {
        pageTitle: "FleetOS v1.0.0",
        breadcrumb: "Sistem / Production Release",
      });
    } catch (err) {
      console.error("production:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Production release sayfası yüklenemedi."));
    }
  });
}

module.exports = registerProduction;
