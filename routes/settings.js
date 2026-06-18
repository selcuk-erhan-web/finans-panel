const { INCOME_CATEGORIES, EXPENSE_CATEGORIES, VEHICLE_TARGET } = require("../lib/constants");
const authService = require("../services/authService");
const dataPrepService = require("../services/dataPrepService");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout } = require("../lib/ui");
const { settingsPageHtml } = require("../lib/components/settingsPage");

const VALID_TABS = new Set(["system", "security", "data", "export"]);

function registerSettings(app, port) {
  app.get("/settings", (req, res) => {
    const tab = VALID_TABS.has(req.query.tab) ? req.query.tab : "system";
    const stats = dataPrepService.getStats();
    const users = authService.listUsers();

    const content = settingsPageHtml({
      activeTab: tab,
      stats,
      users,
      port,
      username: req.user?.username,
      dataPrepService,
      INCOME_CATEGORIES,
      EXPENSE_CATEGORIES,
      VEHICLE_TARGET,
    });

    renderLayout(res, "Ayarlar", content, "/settings", req, {
      pageTitle: "Ayarlar",
      breadcrumb: "Sistem / Ayarlar",
    });
  });

  app.post("/settings/purge-demo", (req, res) => {
    try {
      const includeVehicles = req.body.include_vehicles === "1";
      const result = dataPrepService.purgeDemoData({
        confirmPhrase: req.body.confirm_phrase,
        includeVehicles,
        vehicleConfirmPhrase: req.body.vehicle_confirm_phrase,
      });
      console.log("Demo temizlik yedeği:", result.backupPath);
      redirectWithFlash(res, "/settings?tab=data", "demo_purged");
    } catch (e) {
      redirectWithFlash(res, "/settings?tab=data&err=1&msg=" + encodeURIComponent(e.message), "demo_purge_failed");
    }
  });

  app.post("/settings/password", (req, res) => {
    const { password, password2 } = req.body;
    if (password !== password2 || !password) {
      return redirectWithFlash(res, "/settings?tab=security&err=1&msg=" + encodeURIComponent("Şifreler eşleşmiyor"));
    }
    if (req.user?.uid) authService.changePassword(req.user.uid, password);
    redirectWithFlash(res, "/settings?tab=security", "password_updated");
  });
}

module.exports = registerSettings;
