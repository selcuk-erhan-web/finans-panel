const express = require("express");
const tireService = require("../services/tireService");
const tireSeasonalSchedulerService = require("../services/tireSeasonalSchedulerService");
const { tireCenterPageHtml } = require("../lib/components/tireCenter");
const { redirectWithFlash } = require("../lib/flash");
const { resolveAuditActor } = require("../lib/auditActor");
const { getVehicles } = require("./vehicles");
const { renderLayout, errorPage } = require("../lib/ui");

function renderTirePage(req, res, extra = {}) {
  const vehicles = getVehicles();
  const filters = {
    vehicle_id: req.query.vehicle_id || "",
    season: req.query.season || "",
    status: req.query.status || "",
  };
  const rows = tireService.listTireRecords(filters);
  const summary = tireService.getTireSummary(filters);
  const seasonalReport = tireSeasonalSchedulerService.buildTireSeasonalSchedule(new Date(), {
    vehicle_id: filters.vehicle_id || undefined,
  });
  const selectedVehicle = filters.vehicle_id
    ? vehicles.find((v) => String(v.id) === String(filters.vehicle_id))
    : null;

  const content = tireCenterPageHtml({
    summary,
    rows,
    vehicles,
    filters,
    editRecord: extra.editRecord || null,
    selectedVehiclePlate: selectedVehicle?.plate || "",
    seasonalReport,
    path: req.path,
  });

  renderLayout(res, "Lastik Merkezi", content, "/tires", req, {
    pageTitle: "Lastik Merkezi",
    breadcrumb: extra.breadcrumb || "Filo / Lastik Merkezi",
  });
}

function registerTires(app) {
  app.get("/api/tires", (req, res) => {
    try {
      const filters = {
        vehicle_id: req.query.vehicle_id || "",
        season: req.query.season || "",
        status: req.query.status || "",
        brand: req.query.brand || "",
      };
      const records = tireService.listTireRecords(filters);
      const summary = tireService.getTireSummary(filters);
      res.json({ ok: true, summary, records });
    } catch (err) {
      console.error("GET /api/tires:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik kayıtları alınamadı." });
    }
  });

  app.get("/api/tires/:id", (req, res) => {
    try {
      const record = tireService.getTireRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ ok: false, error: "Kayıt bulunamadı." });
      }
      res.json({ ok: true, record });
    } catch (err) {
      console.error("GET /api/tires/:id:", err);
      res.status(500).json({ ok: false, error: err.message || "Lastik kaydı alınamadı." });
    }
  });

  app.post("/api/tires", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = tireService.createTireRecord(req.body || {}, resolveAuditActor(req));
      res.status(201).json({ ok: true, record });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || "Lastik kaydı oluşturulamadı." });
    }
  });

  app.put("/api/tires/:id", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = tireService.updateTireRecord(req.params.id, req.body || {}, resolveAuditActor(req));
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Lastik kaydı güncellenemedi." });
    }
  });

  app.delete("/api/tires/:id", (req, res) => {
    try {
      const record = tireService.deleteTireRecord(req.params.id, resolveAuditActor(req));
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Lastik kaydı silinemedi." });
    }
  });

  app.get("/tires", (req, res) => {
    try {
      renderTirePage(req, res);
    } catch (err) {
      console.error("tires:", err);
      res.status(500).send(errorPage("Hata", "Lastik Merkezi yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/tires/add", (req, res) => {
    try {
      tireService.createTireRecord(req.body, resolveAuditActor(req));
      const q = new URLSearchParams();
      if (req.body.vehicle_id) q.set("vehicle_id", req.body.vehicle_id);
      const back = q.toString() ? `/tires?${q.toString()}` : "/tires";
      redirectWithFlash(res, back, "tire_added");
    } catch (e) {
      redirectWithFlash(res, `/tires?err=1&msg=${encodeURIComponent(e.message)}`, "tire_add_failed");
    }
  });

  app.get("/tires/delete/:id", (req, res) => {
    try {
      const record = tireService.getTireRecord(req.params.id);
      tireService.deleteTireRecord(req.params.id, resolveAuditActor(req));
      const back = record?.vehicle_id ? `/tires?vehicle_id=${record.vehicle_id}` : "/tires";
      redirectWithFlash(res, back, "tire_deleted");
    } catch (e) {
      redirectWithFlash(res, "/tires", "tire_delete_failed");
    }
  });

  app.get("/tires/edit/:id", (req, res) => {
    try {
      const editRecord = tireService.getTireRecord(req.params.id);
      if (!editRecord) return res.status(404).send(errorPage("Kayıt yok", "Lastik kaydı bulunamadı."));
      renderTirePage(req, res, { editRecord, breadcrumb: "Filo / Lastik Merkezi / Düzenle" });
    } catch (err) {
      console.error("tires/edit:", err);
      res.status(500).send(errorPage("Hata", "Lastik kaydı düzenlenirken bir sorun oluştu."));
    }
  });

  app.post("/tires/edit/:id", (req, res) => {
    try {
      tireService.updateTireRecord(req.params.id, req.body, resolveAuditActor(req));
      redirectWithFlash(res, "/tires", "tire_updated");
    } catch (e) {
      redirectWithFlash(
        res,
        `/tires/edit/${req.params.id}?err=1&msg=${encodeURIComponent(e.message)}`,
        "tire_update_failed"
      );
    }
  });
}

module.exports = registerTires;
