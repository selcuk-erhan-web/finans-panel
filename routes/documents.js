const documentService = require("../services/documentService");
const { documentsPageHtml } = require("../lib/components/documents");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { renderLayout } = require("../lib/ui");

function registerDocuments(app) {
  app.get("/documents", (req, res) => {
    try {
      const vehicles = getVehicles();
      const filters = { vehicle_id: req.query.vehicle_id || "" };
      const rows = documentService.listAll(filters);
      const upcoming = documentService.listUpcoming();
      const kpi = documentService.getKpiSummary();

      const content = documentsPageHtml({ kpi, upcoming, rows, vehicles, filters });

      renderLayout(res, "Evrak Takibi", content, "/documents", req, {
        pageTitle: "Evrak Takibi",
        breadcrumb: "Operasyon / Evrak Takibi",
      });
    } catch (err) {
      console.error("documents:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Evrak listesi yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/documents/add", (req, res) => {
    try {
      documentService.create(req.body);
      redirectWithFlash(res, "/documents", "success", "Evrak kaydı eklendi.");
    } catch (err) {
      redirectWithFlash(res, "/documents", "error", err.message || "Evrak eklenemedi.");
    }
  });

  app.get("/documents/edit/:id", (req, res) => {
    try {
      const doc = documentService.getById(req.params.id);
      if (!doc) {
        redirectWithFlash(res, "/documents", "error", "Evrak kaydı bulunamadı.");
        return;
      }
      const vehicles = getVehicles();
      const rows = documentService.listAll({});
      const upcoming = documentService.listUpcoming();
      const kpi = documentService.getKpiSummary();
      const content = documentsPageHtml({
        kpi,
        upcoming,
        rows,
        vehicles,
        filters: {},
        editDoc: doc,
      });
      renderLayout(res, "Evrak Düzenle", content, "/documents", req, {
        pageTitle: "Evrak Düzenle",
        breadcrumb: "Operasyon / Evrak Takibi",
      });
    } catch (err) {
      console.error("documents edit:", err);
      redirectWithFlash(res, "/documents", "error", "Evrak yüklenemedi.");
    }
  });

  app.post("/documents/edit/:id", (req, res) => {
    try {
      const updated = documentService.update(req.params.id, req.body);
      if (!updated) {
        redirectWithFlash(res, "/documents", "error", "Evrak kaydı bulunamadı.");
        return;
      }
      redirectWithFlash(res, "/documents", "success", "Evrak kaydı güncellendi.");
    } catch (err) {
      redirectWithFlash(res, `/documents/edit/${req.params.id}`, "error", err.message || "Güncellenemedi.");
    }
  });

  app.get("/documents/delete/:id", (req, res) => {
    try {
      const ok = documentService.remove(req.params.id);
      redirectWithFlash(
        res,
        "/documents",
        ok ? "success" : "error",
        ok ? "Evrak kaydı silindi." : "Evrak kaydı bulunamadı."
      );
    } catch (err) {
      redirectWithFlash(res, "/documents", "error", "Silme işlemi başarısız.");
    }
  });
}

module.exports = registerDocuments;
