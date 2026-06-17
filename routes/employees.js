const employeeService = require("../services/employeeService");
const { employeesPageHtml } = require("../lib/components/employees");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { renderLayout } = require("../lib/ui");

function registerEmployees(app) {
  app.get("/employees", (req, res) => {
    try {
      const employees = employeeService.listEmployees();
      const costs = employeeService.listMonthlyCosts(40);
      const kpi = employeeService.getKpiSummary();
      const vehicles = getVehicles();

      const content = employeesPageHtml({ kpi, employees, costs, vehicles });

      renderLayout(res, "Personel", content, "/employees", req, {
        pageTitle: "Personel Maliyet Merkezi",
        breadcrumb: "Operasyon / Personel",
      });
    } catch (err) {
      console.error("employees:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "Personel ekranı yüklenirken bir sorun oluştu."));
    }
  });

  app.post("/employees/add", (req, res) => {
    try {
      employeeService.createEmployee(req.body);
      redirectWithFlash(res, "/employees", "success", "Personel kaydı eklendi.");
    } catch (err) {
      redirectWithFlash(res, "/employees", "error", err.message || "Personel eklenemedi.");
    }
  });

  app.post("/employees/cost/add", (req, res) => {
    try {
      employeeService.createMonthlyCost(req.body);
      redirectWithFlash(res, "/employees", "success", "Aylık personel maliyeti kaydedildi.");
    } catch (err) {
      redirectWithFlash(res, "/employees", "error", err.message || "Maliyet kaydedilemedi.");
    }
  });

  app.get("/employees/cost/delete/:id", (req, res) => {
    try {
      employeeService.removeMonthlyCost(req.params.id);
      redirectWithFlash(res, "/employees", "success", "Maliyet kaydı silindi.");
    } catch (err) {
      redirectWithFlash(res, "/employees", "error", "Silme işlemi başarısız.");
    }
  });
}

module.exports = registerEmployees;
