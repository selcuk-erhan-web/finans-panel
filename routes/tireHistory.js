const express = require("express");
const tireHistoryService = require("../services/tireHistoryService");
const tireService = require("../services/tireService");
const { tireHistoryPageHtml } = require("../lib/components/tireHistory");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { renderLayout, errorPage } = require("../lib/ui");

function buildFilters(query) {
  return {
    vehicle_id: query.vehicle_id || "",
    change_type: query.change_type || "",
    season: query.season || "",
    date_from: query.date_from || "",
    date_to: query.date_to || "",
  };
}

function renderTireHistoryPage(req, res, extra = {}) {
  const vehicles = getVehicles();
  const filters = buildFilters(req.query);
  const rows = tireHistoryService.listTireChangeRecords(filters);
  const summary = tireHistoryService.getTireHistorySummary(filters);
  const tires = tireService.listTireRecords(
    filters.vehicle_id ? { vehicle_id: filters.vehicle_id } : {}
  );
  const selectedVehicle = filters.vehicle_id
    ? vehicles.find((v) => String(v.id) === String(filters.vehicle_id))
    : null;

  const content = tireHistoryPageHtml({
    summary,
    rows,
    vehicles,
    tires,
    filters,
    editRecord: extra.editRecord || null,
    selectedVehiclePlate: selectedVehicle?.plate || "",
  });

  renderLayout(res, "Lastik Değişim Geçmişi", content, "/tire-history", req, {
    pageTitle: "Lastik Değişim Geçmişi",
    breadcrumb: extra.breadcrumb || "Filo / Lastik Değişim Geçmişi",
  });
}

function registerTireHistory(app) {
  app.get("/api/vehicles/:vehicleId/tire-history", (req, res) => {
    try {
      const history = tireHistoryService.getVehicleTireHistory(req.params.vehicleId);
      res.json({ ok: true, ...history });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Lastik geçmişi alınamadı." });
    }
  });

  app.get("/api/tire-history", (req, res) => {
    try {
      const filters = {
        ...buildFilters(req.query),
        tire_id: req.query.tire_id || "",
      };
      const records = tireHistoryService.listTireChangeRecords(filters);
      const summary = tireHistoryService.getTireHistorySummary(filters);
      res.json({ ok: true, summary, records });
    } catch (err) {
      console.error("GET /api/tire-history:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik geçmişi alınamadı." });
    }
  });

  app.get("/api/tire-history/:id", (req, res) => {
    try {
      const record = tireHistoryService.getTireChangeRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ ok: false, error: "Kayıt bulunamadı." });
      }
      res.json({ ok: true, record });
    } catch (err) {
      console.error("GET /api/tire-history/:id:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik geçmişi kaydı alınamadı." });
    }
  });

  app.post("/api/tire-history", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = tireHistoryService.createTireChangeRecord(req.body || {});
      res.status(201).json({ ok: true, record });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || "Lastik geçmişi oluşturulamadı." });
    }
  });

  app.put("/api/tire-history/:id", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = tireHistoryService.updateTireChangeRecord(req.params.id, req.body || {});
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Lastik geçmişi güncellenemedi." });
    }
  });

  app.delete("/api/tire-history/:id", (req, res) => {
    try {
      const record = tireHistoryService.deleteTireChangeRecord(req.params.id);
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Lastik geçmişi silinemedi." });
    }
  });

  app.get("/tire-history", (req, res) => {
    try {
      renderTireHistoryPage(req, res);
    } catch (err) {
      console.error("tire-history:", err);
      res.status(500).send(errorPage("Hata", "Lastik Değişim Geçmişi yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/tire-history/add", (req, res) => {
    try {
      tireHistoryService.createTireChangeRecord(req.body);
      const q = new URLSearchParams();
      if (req.body.vehicle_id) q.set("vehicle_id", req.body.vehicle_id);
      const back = q.toString() ? `/tire-history?${q.toString()}` : "/tire-history";
      redirectWithFlash(res, back, "tire_history_added");
    } catch (e) {
      redirectWithFlash(res, `/tire-history?err=1&msg=${encodeURIComponent(e.message)}`, "tire_history_add_failed");
    }
  });

  app.get("/tire-history/delete/:id", (req, res) => {
    try {
      const record = tireHistoryService.getTireChangeRecord(req.params.id);
      tireHistoryService.deleteTireChangeRecord(req.params.id);
      const back = record?.vehicle_id ? `/tire-history?vehicle_id=${record.vehicle_id}` : "/tire-history";
      redirectWithFlash(res, back, "tire_history_deleted");
    } catch (e) {
      redirectWithFlash(res, "/tire-history", "tire_history_delete_failed");
    }
  });

  app.get("/tire-history/edit/:id", (req, res) => {
    try {
      const editRecord = tireHistoryService.getTireChangeRecord(req.params.id);
      if (!editRecord) return res.status(404).send(errorPage("Kayıt yok", "Lastik geçmişi kaydı bulunamadı."));
      renderTireHistoryPage(req, res, { editRecord, breadcrumb: "Filo / Lastik Değişim Geçmişi / Düzenle" });
    } catch (err) {
      console.error("tire-history/edit:", err);
      res.status(500).send(errorPage("Hata", "Lastik geçmişi düzenlenirken bir sorun oluştu."));
    }
  });

  app.post("/tire-history/edit/:id", (req, res) => {
    try {
      tireHistoryService.updateTireChangeRecord(req.params.id, req.body);
      redirectWithFlash(res, "/tire-history", "tire_history_updated");
    } catch (e) {
      redirectWithFlash(
        res,
        `/tire-history/edit/${req.params.id}?err=1&msg=${encodeURIComponent(e.message)}`,
        "tire_history_update_failed"
      );
    }
  });
}

module.exports = registerTireHistory;
