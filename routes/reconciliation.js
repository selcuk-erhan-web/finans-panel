const reconciliationService = require("../services/reconciliationService");
const { reconciliationPageHtml } = require("../lib/components/reconciliation");
const { renderLayout } = require("../lib/ui");

function registerReconciliation(app) {
  app.get("/reconciliation", (req, res) => {
    try {
      const rows = reconciliationService.buildReconciliationRows();
      const summary = reconciliationService.getReconciliationSummary(rows);
      const content = reconciliationPageHtml({ summary, rows });

      renderLayout(res, "Hakediş Kontrol", content, "/reconciliation", req, {
        pageTitle: "Hakediş Doğrulama Merkezi",
        breadcrumb: "Gelir / Hakediş Kontrol",
      });
    } catch (err) {
      console.error("reconciliation:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Hakediş doğrulama yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerReconciliation;
