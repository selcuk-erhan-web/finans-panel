const express = require("express");
const maintenanceAlertService = require("../services/maintenanceAlertService");
const { maintenanceAlertsPageHtml } = require("../lib/components/maintenanceAlerts");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout, errorPage } = require("../lib/ui");

function registerMaintenanceAlerts(app) {
  app.get("/api/maintenance/alerts/unread-count", (_req, res) => {
    try {
      maintenanceAlertService.generateMaintenanceAlerts();
      res.json({ count: maintenanceAlertService.getUnreadMaintenanceAlertCount() });
    } catch (err) {
      console.error("GET /api/maintenance/alerts/unread-count:", err);
      res.status(500).json({ error: err.message || "Bakım uyarı sayısı alınamadı." });
    }
  });

  app.get("/api/maintenance/alerts", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const payload = maintenanceAlertService.buildMaintenanceAlertPayload({ filter }, ref);
      res.json(payload);
    } catch (err) {
      console.error("GET /api/maintenance/alerts:", err);
      res.status(500).json({ error: err.message || "Bakım uyarıları alınamadı." });
    }
  });

  app.post("/api/maintenance/alerts/generate", (_req, res) => {
    try {
      const result = maintenanceAlertService.generateMaintenanceAlerts();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("POST /api/maintenance/alerts/generate:", err);
      res.status(500).json({ ok: false, error: err.message || "Bakım uyarıları oluşturulamadı." });
    }
  });

  app.post("/api/maintenance/alerts/:id/read", (req, res) => {
    try {
      const updated = maintenanceAlertService.markMaintenanceAlertRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Bakım uyarısı bulunamadı." });
      }

      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.json({
          ok: true,
          alert: updated,
          unread_count: maintenanceAlertService.getUnreadMaintenanceAlertCount(),
        });
      }

      return redirectWithFlash(res, "/maintenance-alerts", "success", "Bakım uyarısı okundu olarak işaretlendi.");
    } catch (err) {
      console.error("POST /api/maintenance/alerts/:id/read:", err);
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(500).json({ error: err.message || "Bakım uyarısı güncellenemedi." });
      }
      return redirectWithFlash(res, "/maintenance-alerts", "error", err.message || "Bakım uyarısı güncellenemedi.");
    }
  });

  app.get("/maintenance-alerts", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const payload = maintenanceAlertService.buildMaintenanceAlertPayload({ filter });
      const content = maintenanceAlertsPageHtml({
        alerts: payload.alerts,
        unreadCount: payload.unread_count,
        filter,
        path: req.path,
      });

      renderLayout(res, "Bakım Uyarıları", content, "/maintenance-alerts", req, {
        pageTitle: "Bakım Uyarıları",
        breadcrumb: "Filo / Bakım Uyarıları",
      });
    } catch (err) {
      console.error("maintenance-alerts:", err);
      res.status(500).send(errorPage("Hata", "Bakım uyarıları yüklenemedi."));
    }
  });
}

module.exports = registerMaintenanceAlerts;
