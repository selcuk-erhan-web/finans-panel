const express = require("express");
const path = require("path");
const LAYOUT_VERSION = require("./lib/layout-version");

const registerAuth = require("./routes/auth");
const registerDashboard = require("./routes/dashboard");
const { registerVehicles } = require("./routes/vehicles");
const registerTransactions = require("./routes/transactions");
const registerIncome = require("./routes/income");
const registerMaintenance = require("./routes/maintenance");
const registerMaintenanceSchedule = require("./routes/maintenanceSchedule");
const registerMaintenanceAlerts = require("./routes/maintenanceAlerts");
const registerMaintenanceAnalytics = require("./routes/maintenanceAnalytics");
const registerTireAnalytics = require("./routes/tireAnalytics");
const registerTireSeasonalSchedule = require("./routes/tireSeasonalSchedule");
const registerTires = require("./routes/tires");
const registerTireHistory = require("./routes/tireHistory");
const registerTireAlerts = require("./routes/tireAlerts");
const registerFuel = require("./routes/fuel");
const registerReports = require("./routes/reports");
const registerProfitability = require("./routes/profitability");
const registerSettings = require("./routes/settings");
const registerExport = require("./routes/export");
const registerHgs = require("./routes/hgs");
const registerAlerts = require("./routes/alerts");
const registerDocuments = require("./routes/documents");
const registerNotifications = require("./routes/notifications");
const registerComplianceAnalytics = require("./routes/complianceAnalytics");
const registerAuditLogs = require("./routes/auditLogs");
const registerAuditDashboard = require("./routes/auditDashboard");
const registerAuditAnalytics = require("./routes/auditAnalytics");
const registerRelease = require("./routes/release");
const registerReconciliation = require("./routes/reconciliation");
const registerSubcontractors = require("./routes/subcontractors");
const registerEmployees = require("./routes/employees");
const registerPayroll = require("./routes/payroll");
const registerCashflow = require("./routes/cashflow");
const { requireAuth } = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get(["/css/app.css", "/js/app.js"], (_req, res) => {
  res.status(410).type("text/plain").send("Kaldırıldı. Yeni arayüz: /css/main.css");
});

registerAuth(app);
app.use(requireAuth);

registerDashboard(app);
registerVehicles(app);
registerTransactions(app);
registerIncome(app);
registerMaintenanceAnalytics(app);
registerTireAnalytics(app);
registerTireSeasonalSchedule(app);
registerTires(app);
registerTireHistory(app);
registerTireAlerts(app);
registerMaintenanceSchedule(app);
registerMaintenanceAlerts(app);
registerMaintenance(app);
registerFuel(app);
registerHgs(app);
registerAlerts(app);
registerDocuments(app);
registerNotifications(app);
registerComplianceAnalytics(app);
registerAuditLogs(app);
registerAuditDashboard(app);
registerAuditAnalytics(app);
registerRelease(app);
registerReconciliation(app);
registerSubcontractors(app);
registerEmployees(app);
registerPayroll(app);
registerCashflow(app);
registerReports(app);
registerProfitability(app);
registerSettings(app, port);
registerExport(app);

app.use((err, _req, res, _next) => {
  console.error("Sunucu hatası:", err);
  if (res.headersSent) return;
  try {
    const { errorPage } = require("./lib/ui");
    res.status(500).send(errorPage("Hata", "İşlem sırasında beklenmeyen bir sorun oluştu."));
  } catch {
    res.status(500).send("Bir hata oluştu.");
  }
});

app.listen(port, () => {
  console.log(`MISTUR FleetOS (${LAYOUT_VERSION}): http://localhost:${port}`);
  console.log("Giriş: /login · admin / 1234 (ilk kurulum)");
  try {
    const complianceNotificationService = require("./services/complianceNotificationService");
    complianceNotificationService.generateComplianceNotifications();
  } catch (err) {
    console.error("compliance notification sync:", err.message);
  }
  try {
    const maintenanceAlertService = require("./services/maintenanceAlertService");
    maintenanceAlertService.generateMaintenanceAlerts();
  } catch (err) {
    console.error("maintenance alert sync:", err.message);
  }
  try {
    const tireAlertService = require("./services/tireAlertService");
    tireAlertService.generateTireAlerts();
  } catch (err) {
    console.error("tire alert sync:", err.message);
  }
});
