const roadmapService = require("../services/roadmapService");
const { roadmapPageHtml } = require("../lib/components/roadmap");
const { renderLayout } = require("../lib/ui");

function registerRoadmap(app) {
  app.get("/api/roadmap/v1.1", (_req, res) => {
    try {
      const roadmap = roadmapService.getV11Roadmap();
      res.json(roadmap);
    } catch (err) {
      console.error("GET /api/roadmap/v1.1:", err);
      res.json(roadmapService.FALLBACK_ROADMAP);
    }
  });

  app.get("/roadmap/v1.1", (_req, res) => {
    try {
      const roadmap = roadmapService.getV11Roadmap();
      const content = roadmapPageHtml(roadmap);

      renderLayout(res, "FleetOS v1.1 Roadmap", content, "/roadmap/v1.1", _req, {
        pageTitle: "FleetOS v1.1 Roadmap",
        breadcrumb: "Sistem / v1.1 Roadmap",
      });
    } catch (err) {
      console.error("roadmap/v1.1:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "v1.1 roadmap sayfası yüklenemedi."));
    }
  });
}

module.exports = registerRoadmap;
