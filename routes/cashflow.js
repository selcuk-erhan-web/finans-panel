const cashflowService = require("../services/cashflowService");
const { cashflowPageHtml } = require("../lib/components/cashflow");
const { renderLayout } = require("../lib/ui");

function registerCashflow(app) {
  app.get("/cashflow", (req, res) => {
    try {
      const ref = new Date();
      const summary = cashflowService.getCashflowSummary(ref);
      const receivables = cashflowService.getExpectedReceivables(ref);
      const obligations = cashflowService.getUpcomingObligations(ref);
      const timeline = cashflowService.getCashflowTimeline(ref);
      const content = cashflowPageHtml({ summary, receivables, obligations, timeline });

      renderLayout(res, "Nakit Akışı", content, "/cashflow", req, {
        pageTitle: "Nakit Akışı ve Yükümlülük Merkezi",
        breadcrumb: "Finans / Nakit Akışı",
      });
    } catch (err) {
      console.error("cashflow:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Nakit akışı ekranı yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerCashflow;
