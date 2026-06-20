const auditDashboardService = require("../services/auditDashboardService");

function registerAuditDashboard(app) {
  app.get("/api/audit/dashboard", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const dashboard = auditDashboardService.buildExecutiveAuditDashboard(ref);
      res.json(dashboard);
    } catch (err) {
      console.error("GET /api/audit/dashboard:", err);
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      res.json(auditDashboardService.emptyDashboard(ref));
    }
  });
}

module.exports = registerAuditDashboard;
