const multer = require("multer");
const payrollObligationService = require("../services/payrollObligationService");
const payrollAllocationService = require("../services/payrollAllocationService");
const { payrollPageHtml } = require("../lib/components/payroll");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout } = require("../lib/ui");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pdf$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Sadece .pdf dosyaları yüklenebilir."));
  },
});

function buildPayrollPageData(importResult = null) {
  const rows = payrollObligationService.listAll();
  const kpi = payrollObligationService.getKpiSummary();
  const allocSummary = payrollAllocationService.getGlobalAllocationSummary();
  const allocationDetails = payrollAllocationService.listAll(500);
  return {
    kpi,
    rows,
    importResult,
    allocSummary,
    unallocated: allocSummary.unallocated,
    allocated: allocSummary.allocated,
    allocationDetails,
  };
}

function renderPayrollPage(req, res, options = {}) {
  const content = payrollPageHtml(buildPayrollPageData(options.importResult));
  renderLayout(res, "SGK / Muhtasar", content, "/payroll", req, {
    pageTitle: options.pageTitle || "SGK & Muhtasar Takip Merkezi",
    breadcrumb: options.breadcrumb || "Personel / SGK & Muhtasar",
  });
}

function registerPayroll(app) {
  app.get("/payroll", (req, res) => {
    try {
      let importResult = null;
      if (req.query.import_ok) {
        importResult = { ok: true, message: "PDF başarıyla içe aktarıldı." };
      } else if (req.query.import_dup) {
        importResult = { ok: false, message: "Bu PDF veya kayıt daha önce içe aktarılmış." };
      }
      renderPayrollPage(req, res, { importResult });
    } catch (err) {
      console.error("payroll:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "SGK/Muhtasar ekranı yüklenirken bir sorun oluştu."));
    }
  });

  app.get("/payroll/allocations", (req, res) => {
    try {
      renderPayrollPage(req, res, {
        pageTitle: "Personel Yük Dağıtım Merkezi",
        breadcrumb: "Personel / Dağıtım Merkezi",
      });
    } catch (err) {
      console.error("payroll allocations:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Dağıtım ekranı yüklenirken bir sorun oluştu."));
    }
  });

  app.get("/payroll/allocate/:id", (req, res) => {
    try {
      const result = payrollAllocationService.allocateObligation(req.params.id);
      const warn = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
      redirectWithFlash(
        res,
        "/payroll/allocations",
        "success",
        `Dağıtım tamamlandı.${warn}`
      );
    } catch (err) {
      redirectWithFlash(res, "/payroll/allocations", "error", err.message || "Dağıtım başarısız.");
    }
  });

  app.get("/payroll/revoke/:id", (req, res) => {
    try {
      payrollAllocationService.revokeAllocation(req.params.id);
      redirectWithFlash(res, "/payroll/allocations", "success", "Dağıtım geri alındı.");
    } catch (err) {
      redirectWithFlash(res, "/payroll/allocations", "error", err.message || "Geri alma başarısız.");
    }
  });

  app.post("/payroll/import", (req, res) => {
    upload.single("pdfFile")(req, res, async (uploadErr) => {
      if (uploadErr) {
        redirectWithFlash(res, "/payroll", "error", uploadErr.message || "Dosya yüklenemedi.");
        return;
      }
      if (!req.file?.buffer) {
        redirectWithFlash(res, "/payroll", "error", "PDF dosyası seçilmedi.");
        return;
      }
      try {
        const typeHint = req.body.obligation_type || null;
        const result = await payrollObligationService.importFromBuffer(
          req.file.buffer,
          req.file.originalname,
          typeHint || null
        );
        if (result.duplicate) {
          res.redirect("/payroll?import_dup=1");
          return;
        }
        res.redirect("/payroll?import_ok=1");
      } catch (err) {
        redirectWithFlash(res, "/payroll", "error", err.message || "PDF içe aktarılamadı.");
      }
    });
  });

  app.post("/payroll/add", (req, res) => {
    try {
      const result = payrollObligationService.createManual(req.body);
      if (result.duplicate) {
        redirectWithFlash(res, "/payroll", "error", result.message);
        return;
      }
      redirectWithFlash(res, "/payroll", "success", "Manuel kayıt eklendi.");
    } catch (err) {
      redirectWithFlash(res, "/payroll", "error", err.message || "Kayıt eklenemedi.");
    }
  });

  app.get("/payroll/mark-paid/:id", (req, res) => {
    try {
      const row = payrollObligationService.markPaid(req.params.id);
      redirectWithFlash(
        res,
        "/payroll",
        row ? "success" : "error",
        row ? "Ödeme ödendi olarak işaretlendi." : "Kayıt bulunamadı."
      );
    } catch (err) {
      redirectWithFlash(res, "/payroll", "error", "İşlem başarısız.");
    }
  });

  app.get("/payroll/mark-pending/:id", (req, res) => {
    try {
      const row = payrollObligationService.markPending(req.params.id);
      redirectWithFlash(
        res,
        "/payroll",
        row ? "success" : "error",
        row ? "Kayıt bekliyor durumuna alındı." : "Kayıt bulunamadı."
      );
    } catch (err) {
      redirectWithFlash(res, "/payroll", "error", "İşlem başarısız.");
    }
  });

  app.get("/payroll/delete/:id", (req, res) => {
    try {
      payrollObligationService.remove(req.params.id);
      redirectWithFlash(res, "/payroll", "success", "Kayıt silindi.");
    } catch (err) {
      redirectWithFlash(res, "/payroll", "error", "Silme işlemi başarısız.");
    }
  });
}

module.exports = registerPayroll;
