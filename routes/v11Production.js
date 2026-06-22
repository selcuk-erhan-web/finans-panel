const v11ProductionReadinessService = require("../services/v11ProductionReadinessService");
const { v11ProductionReleasePageHtml } = require("../lib/components/v11ProductionRelease");
const { renderLayout } = require("../lib/ui");

function registerV11Production(app) {
  app.get("/api/production/v1.1", (_req, res) => {
    try {
      const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
      res.json(payload);
    } catch (err) {
      console.error("GET /api/production/v1.1:", err);
      res.json({
        production: v11ProductionReadinessService.FALLBACK_PRODUCTION,
        certification: { certified: false, production_ready: false },
        inventory: {},
        known_issues: [],
        readiness: {
          production_ready: false,
          certified: false,
          tests_passed: false,
          blockers: ["service_error"],
          support_level: "unknown",
        },
      });
    }
  });

  app.get("/production/v1.1", (_req, res) => {
    try {
      const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
      const content = v11ProductionReleasePageHtml(payload);

      renderLayout(res, "FleetOS v1.1 Production Release", content, "/production/v1.1", _req, {
        pageTitle: "FleetOS v1.1 Production Release",
        breadcrumb: "Sistem / v1.1 Production Release",
      });
    } catch (err) {
      console.error("production/v1.1:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "v1.1 production release sayfası yüklenemedi."));
    }
  });
}

module.exports = registerV11Production;
