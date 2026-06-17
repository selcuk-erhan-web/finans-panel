const express = require("express");
const path = require("path");
const LAYOUT_VERSION = require("./lib/layout-version");

const registerAuth = require("./routes/auth");
const registerDashboard = require("./routes/dashboard");
const { registerVehicles } = require("./routes/vehicles");
const registerTransactions = require("./routes/transactions");
const registerIncome = require("./routes/income");
const registerMaintenance = require("./routes/maintenance");
const registerFuel = require("./routes/fuel");
const registerReports = require("./routes/reports");
const registerProfitability = require("./routes/profitability");
const registerSettings = require("./routes/settings");
const registerExport = require("./routes/export");
const registerHgs = require("./routes/hgs");
const registerAlerts = require("./routes/alerts");
const registerDocuments = require("./routes/documents");
const registerReconciliation = require("./routes/reconciliation");
const registerSubcontractors = require("./routes/subcontractors");
const registerEmployees = require("./routes/employees");
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
registerMaintenance(app);
registerFuel(app);
registerHgs(app);
registerAlerts(app);
registerDocuments(app);
registerReconciliation(app);
registerSubcontractors(app);
registerEmployees(app);
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
});
