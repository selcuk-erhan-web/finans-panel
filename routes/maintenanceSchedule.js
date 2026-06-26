const express = require("express");
const maintenanceSchedulerService = require("../services/maintenanceSchedulerService");
const maintenanceAlertService = require("../services/maintenanceAlertService");
const { maintenanceSchedulePageHtml } = require("../lib/components/maintenanceSchedule");
const { getVehicles } = require("./vehicles");
const { renderLayout, errorPage } = require("../lib/ui");

function renderMaintenanceSchedulePage(req, res) {
  const vehicles = getVehicles();
  const filters = { vehicle_id: req.query.vehicle_id || "" };
  const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
  const report = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref, filters);
  const selectedVehicle = filters.vehicle_id
    ? vehicles.find((v) => String(v.id) === String(filters.vehicle_id))
    : null;

  const content = maintenanceSchedulePageHtml({
    summary: report.summary,
    schedules: report.schedules,
    vehicles,
    filters,
    selectedVehiclePlate: selectedVehicle?.plate || "",
    path: req.path,
  });

  renderLayout(res, "Bakım Planı", content, "/maintenance-schedule", req, {
    pageTitle: "Bakım Planı",
    breadcrumb: "Filo / Bakım Planı",
  });
}

function registerMaintenanceSchedule(app) {
  app.get("/api/maintenance/schedule", (req, res) => {
    try {
      const ref = req.query.date ? new Date(String(req.query.date)) : new Date();
      const filters = { vehicle_id: req.query.vehicle_id || "" };
      maintenanceAlertService.generateMaintenanceAlerts(ref);
      const report = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref, filters);
      res.json({ ok: true, ...report });
    } catch (err) {
      console.error("GET /api/maintenance/schedule:", err);
      res.status(500).json({ ok: false, error: err.message || "Bakım planı alınamadı." });
    }
  });

  app.post("/api/maintenance/schedule/rules", express.json({ limit: "64kb" }), (req, res) => {
    try {
      const rule = maintenanceSchedulerService.createScheduleRule(req.body || {});
      res.status(201).json({ ok: true, rule });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || "Plan kuralı oluşturulamadı." });
    }
  });

  app.put("/api/maintenance/schedule/rules/:id", express.json({ limit: "64kb" }), (req, res) => {
    try {
      const rule = maintenanceSchedulerService.updateScheduleRule(req.params.id, req.body || {});
      res.json({ ok: true, rule });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Plan kuralı güncellenemedi." });
    }
  });

  app.delete("/api/maintenance/schedule/rules/:id", (req, res) => {
    try {
      const rule = maintenanceSchedulerService.deleteScheduleRule(req.params.id);
      res.json({ ok: true, rule });
    } catch (err) {
      const status = /bulunamad/i.test(err.message) ? 404 : 400;
      res.status(status).json({ ok: false, error: err.message || "Plan kuralı silinemedi." });
    }
  });

  app.get("/maintenance-schedule", (req, res) => {
    try {
      renderMaintenanceSchedulePage(req, res);
    } catch (err) {
      console.error("maintenance-schedule:", err);
      res.status(500).send(errorPage("Hata", "Bakım planı yüklenirken bir sorun oluştu."));
    }
  });
}

module.exports = registerMaintenanceSchedule;
