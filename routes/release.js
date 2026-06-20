const releaseInventoryService = require("../services/releaseInventoryService");
const { releaseCandidatePageHtml } = require("../lib/components/releaseCandidate");
const { renderLayout } = require("../lib/ui");

function registerRelease(app) {
  app.get("/api/release/readiness", (_req, res) => {
    try {
      const readiness = releaseInventoryService.buildReleaseReadiness();
      res.json(readiness);
    } catch (err) {
      console.error("GET /api/release/readiness:", err);
      res.json({
        version: "1.0.0-rc1",
        status: "release_candidate",
        release_ready: false,
        known_issues_count: 0,
        inventory_summary: {},
        latest_commit: null,
      });
    }
  });

  app.get("/release", (_req, res) => {
    try {
      const inventory = releaseInventoryService.buildReleaseInventory();
      const content = releaseCandidatePageHtml(inventory);

      renderLayout(res, "FleetOS RC-1", content, "/release", _req, {
        pageTitle: "FleetOS RC-1",
        breadcrumb: "Sistem / Release Candidate",
      });
    } catch (err) {
      console.error("release:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Release candidate sayfası yüklenemedi."));
    }
  });
}

module.exports = registerRelease;
