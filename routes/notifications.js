const complianceNotificationService = require("../services/complianceNotificationService");
const { notificationsPageHtml } = require("../lib/components/notifications");
const { renderLayout } = require("../lib/ui");
const { redirectWithFlash } = require("../lib/flash");

function registerNotifications(app) {
  app.get("/api/notifications/unread-count", (_req, res) => {
    try {
      complianceNotificationService.generateComplianceNotifications();
      res.json({ count: complianceNotificationService.getUnreadCount() });
    } catch (err) {
      console.error("api/notifications/unread-count:", err);
      res.status(500).json({ error: err.message || "Bildirim sayısı alınamadı." });
    }
  });

  app.get("/api/notifications", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const payload = complianceNotificationService.getApiPayload(filter);
      res.json(payload);
    } catch (err) {
      console.error("api/notifications:", err);
      res.status(500).json({ error: err.message || "Bildirimler alınamadı." });
    }
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    try {
      const updated = complianceNotificationService.markNotificationRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Bildirim bulunamadı." });
      }

      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.json({ ok: true, notification: updated, unread_count: complianceNotificationService.getUnreadCount() });
      }

      return redirectWithFlash(res, "/notifications", "success", "Bildirim okundu olarak işaretlendi.");
    } catch (err) {
      console.error("api/notifications/read:", err);
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(500).json({ error: err.message || "Bildirim güncellenemedi." });
      }
      return redirectWithFlash(res, "/notifications", "error", err.message || "Bildirim güncellenemedi.");
    }
  });

  app.get("/notifications", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const payload = complianceNotificationService.getApiPayload(filter);
      const content = notificationsPageHtml({
        notifications: payload.notifications,
        unreadCount: payload.unread_count,
        filter,
      });

      renderLayout(res, "Uygunluk Bildirimleri", content, "/notifications", req, {
        pageTitle: "Compliance Notifications",
        breadcrumb: "Filo / Uygunluk Bildirimleri",
      });
    } catch (err) {
      console.error("notifications page:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Bildirim merkezi yüklenemedi."));
    }
  });
}

module.exports = registerNotifications;
