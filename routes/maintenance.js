const express = require("express");
const maintenanceService = require("../services/maintenanceService");
const maintenanceSchedulerService = require("../services/maintenanceSchedulerService");
const { maintenanceCenterPageHtml } = require("../lib/components/maintenanceCenter");
const { redirectWithFlash } = require("../lib/flash");
const { resolveAuditActor } = require("../lib/auditActor");
const { getVehicles } = require("./vehicles");
const { renderLayout, errorPage } = require("../lib/ui");

function renderMaintenancePage(req, res, extra = {}) {
  const vehicles = getVehicles();
  const filters = { vehicle_id: req.query.vehicle_id || "" };
  const rows = maintenanceService.listMaintenanceRecords(filters);
  const summary = maintenanceService.getSummary(filters);
  const scheduleReport = maintenanceSchedulerService.buildMaintenanceScheduleReport(new Date(), filters);
  const selectedVehicle = filters.vehicle_id
    ? vehicles.find((v) => String(v.id) === String(filters.vehicle_id))
    : null;

  const content = maintenanceCenterPageHtml({
    summary,
    rows,
    vehicles,
    filters,
    editRecord: extra.editRecord || null,
    selectedVehiclePlate: selectedVehicle?.plate || "",
    scheduleReport,
    path: req.path,
  });

  renderLayout(res, "Bakım Merkezi", content, "/maintenance", req, {
    pageTitle: "Bakım Merkezi",
    breadcrumb: extra.breadcrumb || "Filo / Bakım Merkezi",
  });
}

function registerMaintenance(app) {
  app.get("/api/vehicles/:vehicleId/maintenance-history", (req, res) => {
    try {
      const history = maintenanceService.getVehicleMaintenanceHistory(req.params.vehicleId);
      res.json({ ok: true, ...history });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Bakım geçmişi alınamadı." });
    }
  });

  app.get("/api/maintenance", (req, res) => {
    try {
      const filters = {
        vehicle_id: req.query.vehicle_id || "",
        maintenance_type: req.query.maintenance_type || req.query.type || "",
      };
      const records = maintenanceService.listMaintenanceRecords(filters);
      const summary = maintenanceService.getSummary(filters);
      res.json({ ok: true, summary, records });
    } catch (err) {
      console.error("GET /api/maintenance:", err);
      res.status(500).json({ ok: false, error: err.message || "Bakım kayıtları alınamadı." });
    }
  });

  app.get("/api/maintenance/:id", (req, res) => {
    try {
      const record = maintenanceService.getMaintenanceRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ ok: false, error: "Kayıt bulunamadı." });
      }
      res.json({ ok: true, record });
    } catch (err) {
      console.error("GET /api/maintenance/:id:", err);
      res.status(500).json({ ok: false, error: err.message || "Bakım kaydı alınamadı." });
    }
  });

  app.post("/api/maintenance", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = maintenanceService.createMaintenanceRecord(req.body || {}, resolveAuditActor(req));
      res.status(201).json({ ok: true, record });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || "Bakım kaydı oluşturulamadı." });
    }
  });

  app.put("/api/maintenance/:id", express.json({ limit: "256kb" }), (req, res) => {
    try {
      const record = maintenanceService.updateMaintenanceRecord(req.params.id, req.body || {}, resolveAuditActor(req));
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Bakım kaydı güncellenemedi." });
    }
  });

  app.delete("/api/maintenance/:id", (req, res) => {
    try {
      const record = maintenanceService.deleteMaintenanceRecord(req.params.id, resolveAuditActor(req));
      res.json({ ok: true, record });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Bakım kaydı silinemedi." });
    }
  });

  app.get("/maintenance", (req, res) => {
    try {
      renderMaintenancePage(req, res);
    } catch (err) {
      console.error("maintenance:", err);
      res.status(500).send(errorPage("Hata", "Bakım Merkezi yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/maintenance/add", (req, res) => {
    try {
      maintenanceService.createMaintenanceRecord(req.body, resolveAuditActor(req));
      const back = req.body.vehicle_id ? `/maintenance?vehicle_id=${req.body.vehicle_id}` : "/maintenance";
      redirectWithFlash(res, back, "maintenance_added");
    } catch (e) {
      redirectWithFlash(res, `/maintenance?err=1&msg=${encodeURIComponent(e.message)}`, "maintenance_add_failed");
    }
  });

  app.get("/maintenance/delete/:id", (req, res) => {
    try {
      const record = maintenanceService.getMaintenanceRecord(req.params.id);
      maintenanceService.deleteMaintenanceRecord(req.params.id, resolveAuditActor(req));
      const back = record?.vehicle_id ? `/maintenance?vehicle_id=${record.vehicle_id}` : "/maintenance";
      redirectWithFlash(res, back, "maintenance_deleted");
    } catch (e) {
      redirectWithFlash(res, "/maintenance", "maintenance_delete_failed");
    }
  });

  app.get("/maintenance/edit/:id", (req, res) => {
    try {
      const editRecord = maintenanceService.getMaintenanceRecord(req.params.id);
      if (!editRecord) return res.status(404).send(errorPage("Kayıt yok", "Bakım kaydı bulunamadı."));
      renderMaintenancePage(req, res, { editRecord, breadcrumb: "Filo / Bakım Merkezi / Düzenle" });
    } catch (err) {
      console.error("maintenance/edit:", err);
      res.status(500).send(errorPage("Hata", "Bakım kaydı düzenlenirken bir sorun oluştu."));
    }
  });

  app.post("/maintenance/edit/:id", (req, res) => {
    try {
      maintenanceService.updateMaintenanceRecord(req.params.id, req.body, resolveAuditActor(req));
      redirectWithFlash(res, "/maintenance", "maintenance_updated");
    } catch (e) {
      redirectWithFlash(
        res,
        `/maintenance/edit/${req.params.id}?err=1&msg=${encodeURIComponent(e.message)}`,
        "maintenance_update_failed"
      );
    }
  });
}

module.exports = registerMaintenance;
