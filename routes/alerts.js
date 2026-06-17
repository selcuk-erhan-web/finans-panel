const alertService = require("../services/alertService");
const { alertsPageHtml } = require("../lib/components/alerts");
const { renderLayout } = require("../lib/ui");

function registerAlerts(app) {
  app.get("/alerts", (req, res) => {
    try {
      const alerts = alertService.getCorporateAlerts();
      const summary = alertService.getAlertSummary(alerts);
      const content = alertsPageHtml(summary);

      renderLayout(res, "Kurumsal Uyarılar", content, "/alerts", req, {
        pageTitle: "Kurumsal Uyarılar",
        breadcrumb: "Operasyon / Uyarılar",
      });
    } catch (err) {
      console.error("alerts:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Uyarılar yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerAlerts;
