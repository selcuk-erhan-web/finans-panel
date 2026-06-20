const multer = require("multer");
const documentService = require("../services/documentService");
const complianceImportService = require("../services/complianceImportService");
const complianceStatusService = require("../services/complianceStatusService");
const complianceNotificationService = require("../services/complianceNotificationService");
const { documentsPageHtml } = require("../lib/components/documents");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { renderLayout } = require("../lib/ui");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pdf$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Sadece .pdf dosyaları yüklenebilir."));
  },
});

function renderDocumentsPage(req, res, extra = {}) {
  const vehicles = getVehicles();
  const filters = { vehicle_id: req.query.vehicle_id || "" };
  const rows = documentService.listAll(filters);
  const upcoming = documentService.listUpcoming();
  const kpi = documentService.getKpiSummary();

  let importPreview = extra.importPreview || null;
  if (!importPreview && req.query.preview_token) {
    importPreview = complianceImportService.getStagedPreview(req.query.preview_token);
    if (importPreview) {
      importPreview.previewToken = req.query.preview_token;
    }
  }

  const content = documentsPageHtml({
    kpi,
    upcoming,
    rows,
    vehicles,
    filters,
    editDoc: extra.editDoc || null,
    importPreview,
    importResult: extra.importResult || null,
  });

  renderLayout(res, extra.pageTitle || "Uygunluk Merkezi", content, "/documents", req, {
    pageTitle: extra.pageTitle || "Uygunluk Merkezi",
    breadcrumb: extra.breadcrumb || "Filo / Uygunluk Merkezi",
  });
}

function registerDocuments(app) {
  app.get("/api/compliance/status", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      complianceNotificationService.generateComplianceNotifications(ref);
      const report = complianceStatusService.buildStatusReport(ref);
      res.json(report);
    } catch (err) {
      console.error("api/compliance/status:", err);
      res.status(500).json({ error: err.message || "Uygunluk durumu alınamadı." });
    }
  });

  app.get("/documents", (req, res) => {
    try {
      renderDocumentsPage(req, res);
    } catch (err) {
      console.error("documents:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Evrak listesi yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/documents/import/preview", (req, res) => {
    upload.single("pdfFile")(req, res, async (uploadErr) => {
      if (uploadErr) {
        return redirectWithFlash(res, "/documents", "error", uploadErr.message || "Dosya yüklenemedi.");
      }
      if (!req.file?.buffer?.length) {
        return redirectWithFlash(res, "/documents", "error", "PDF dosyası alınamadı.");
      }

      try {
        const typeHint = String(req.body.type_hint || "").trim();
        const preview = await complianceImportService.createPreviewFromBuffer(
          req.file.buffer,
          req.file.originalname || "belge.pdf",
          typeHint
        );
        return res.redirect(`/documents?preview_token=${encodeURIComponent(preview.previewToken)}`);
      } catch (err) {
        console.error("compliance import preview:", err);
        const msg =
          err.code === "OCR_REQUIRED"
            ? complianceImportService.OCR_REQUIRED_MSG
            : err.message || "PDF önizlemesi oluşturulamadı.";
        return redirectWithFlash(res, "/documents", "error", msg);
      }
    });
  });

  app.post("/documents/import/confirm", (req, res) => {
    try {
      const token = String(req.body.preview_token || "").trim();
      const result = complianceImportService.confirmImport(token, req.body);
      return redirectWithFlash(
        res,
        "/documents",
        "success",
        result.message || "Uygunluk belgesi kaydedildi."
      );
    } catch (err) {
      console.error("compliance import confirm:", err);
      const token = String(req.body.preview_token || "").trim();
      const back = token
        ? `/documents?preview_token=${encodeURIComponent(token)}`
        : "/documents";
      if (err.code === "DUPLICATE") {
        return redirectWithFlash(res, back, "error", err.message);
      }
      return redirectWithFlash(res, back, "error", err.message || "Kayıt başarısız.");
    }
  });

  app.post("/documents/import/cancel", (req, res) => {
    const token = String(req.body.preview_token || "").trim();
    complianceImportService.discardStaging(token);
    return redirectWithFlash(res, "/documents", "success", "PDF önizlemesi iptal edildi.");
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
      renderDocumentsPage(req, res, {
        editDoc: doc,
        pageTitle: "Uygunluk Düzenle",
        breadcrumb: "Filo / Uygunluk Merkezi",
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
