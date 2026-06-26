const express = require("express");
const tireAlertService = require("../services/tireAlertService");
const { tireAlertsPageHtml } = require("../lib/components/tireAlerts");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout, errorPage } = require("../lib/ui");

function registerTireAlerts(app) {
  app.get("/api/tire-alerts/unread-count", (_req, res) => {
    try {
      tireAlertService.generateTireAlerts();
      res.json({ count: tireAlertService.getUnreadTireAlertCount() });
    } catch (err) {
      console.error("GET /api/tire-alerts/unread-count:", err);
      res.status(500).json({ error: err.message || "Lastik uyarı sayısı alınamadı." });
    }
  });

  app.get("/api/tire-alerts", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const payload = tireAlertService.buildTireAlertPayload({ filter }, ref);
      res.json(payload);
    } catch (err) {
      console.error("GET /api/tire-alerts:", err);
      res.status(500).json({ error: err.message || "Lastik uyarıları alınamadı." });
    }
  });

  app.post("/api/tire-alerts/generate", (_req, res) => {
    try {
      const result = tireAlertService.generateTireAlerts();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("POST /api/tire-alerts/generate:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik uyarıları oluşturulamadı." });
    }
  });

  app.post("/api/tire-alerts/:id/read", (req, res) => {
    try {
      const updated = tireAlertService.markTireAlertRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Lastik uyarısı bulunamadı." });
      }

      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.json({
          ok: true,
          alert: updated,
          unread_count: tireAlertService.getUnreadTireAlertCount(),
        });
      }

      return redirectWithFlash(res, "/tire-alerts", "success", "Lastik uyarısı okundu olarak işaretlendi.");
    } catch (err) {
      console.error("POST /api/tire-alerts/:id/read:", err);
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(500).json({ error: err.message || "Lastik uyarısı güncellenemedi." });
      }
      return redirectWithFlash(res, "/tire-alerts", "error", err.message || "Lastik uyarısı güncellenemedi.");
    }
  });

  app.get("/tire-alerts", (req, res) => {
    try {
      const filter = String(req.query.filter || "all").trim().toLowerCase();
      const payload = tireAlertService.buildTireAlertPayload({ filter });
      const content = tireAlertsPageHtml({
        alerts: payload.alerts,
        unreadCount: payload.unread_count,
        filter,
        path: req.path,
      });

      renderLayout(res, "Lastik Uyarıları", content, "/tire-alerts", req, {
        pageTitle: "Lastik Uyarıları",
        breadcrumb: "Filo / Lastik Uyarıları",
      });
    } catch (err) {
      console.error("tire-alerts:", err);
      res.status(500).send(errorPage("Hata", "Lastik uyarıları yüklenemedi."));
    }
  });
}

module.exports = registerTireAlerts;
