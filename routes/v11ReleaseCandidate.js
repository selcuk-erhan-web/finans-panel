const v11ReleaseCandidateService = require("../services/v11ReleaseCandidateService");
const { v11ReleaseCandidatePageHtml } = require("../lib/components/v11ReleaseCandidate");
const { renderLayout } = require("../lib/ui");

function registerV11ReleaseCandidate(app) {
  app.get("/api/release/v1.1", (_req, res) => {
    try {
      const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
      res.json(payload);
    } catch (err) {
      console.error("GET /api/release/v1.1:", err);
      res.json({
        release: v11ReleaseCandidateService.FALLBACK_RELEASE,
        inventory: {},
        known_issues: [],
        summary: {},
        readiness: {
          release_ready: false,
          tests_passed: false,
          stabilization_complete: false,
          vehicle_intelligence_complete: false,
          blockers: ["service_error"],
        },
      });
    }
  });

  app.get("/release/v1.1", (_req, res) => {
    try {
      const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
      const content = v11ReleaseCandidatePageHtml(payload);

      renderLayout(res, "FleetOS v1.1 Release Candidate", content, "/release/v1.1", _req, {
        pageTitle: "FleetOS v1.1 Release Candidate",
        breadcrumb: "Sistem / v1.1 Release Candidate",
      });
    } catch (err) {
      console.error("release/v1.1:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "v1.1 release candidate sayfası yüklenemedi."));
    }
  });
}

module.exports = registerV11ReleaseCandidate;
