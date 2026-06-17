const subcontractorService = require("../services/subcontractorService");
const { subcontractorsPageHtml } = require("../lib/components/subcontractors");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { renderLayout } = require("../lib/ui");

function registerSubcontractors(app) {
  app.get("/subcontractors", (req, res) => {
    try {
      const subcontractors = subcontractorService.listSubcontractors();
      const assignments = subcontractorService.listAssignments({ activeOnly: true });
      const payments = subcontractorService.listPayments(30);
      const kpi = subcontractorService.getKpiSummary();
      const vehicles = getVehicles();

      const content = subcontractorsPageHtml({
        kpi,
        subcontractors,
        assignments,
        payments,
        vehicles,
      });

      renderLayout(res, "Taşeronlar", content, "/subcontractors", req, {
        pageTitle: "Taşeron Yönetimi",
        breadcrumb: "Operasyon / Taşeronlar",
      });
    } catch (err) {
      console.error("subcontractors:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Taşeron ekranı yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/subcontractors/add", (req, res) => {
    try {
      subcontractorService.createSubcontractor(req.body);
      redirectWithFlash(res, "/subcontractors", "success", "Taşeron kaydı eklendi.");
    } catch (err) {
      redirectWithFlash(res, "/subcontractors", "error", err.message || "Taşeron eklenemedi.");
    }
  });

  app.post("/subcontractors/assignment/add", (req, res) => {
    try {
      subcontractorService.createAssignment(req.body);
      redirectWithFlash(res, "/subcontractors", "success", "Görev/hat tanımı eklendi.");
    } catch (err) {
      redirectWithFlash(res, "/subcontractors", "error", err.message || "Görev eklenemedi.");
    }
  });

  app.post("/subcontractors/payment/add", (req, res) => {
    try {
      subcontractorService.createPayment(req.body);
      redirectWithFlash(res, "/subcontractors", "success", "Taşeron ödemesi kaydedildi.");
    } catch (err) {
      redirectWithFlash(res, "/subcontractors", "error", err.message || "Ödeme kaydedilemedi.");
    }
  });

  app.get("/subcontractors/payment/delete/:id", (req, res) => {
    try {
      subcontractorService.removePayment(req.params.id);
      redirectWithFlash(res, "/subcontractors", "success", "Ödeme kaydı silindi.");
    } catch (err) {
      redirectWithFlash(res, "/subcontractors", "error", "Silme işlemi başarısız.");
    }
  });
}

module.exports = registerSubcontractors;
