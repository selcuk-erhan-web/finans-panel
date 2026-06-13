const exportService = require("../services/exportService");

function registerExport(app) {
  app.get("/income/export", async (req, res, next) => {
    try {
      if (req.query.format === "xlsx") {
        const buf = await exportService.exportTransactionsExcel("income", req.query);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="gelirler.xlsx"');
        return res.send(Buffer.from(buf));
      }
      const csv = exportService.exportTransactionsCsv("income", req.query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="gelirler.csv"');
      res.send(csv);
    } catch (e) {
      next(e);
    }
  });

  app.get("/expense/export", async (req, res, next) => {
    try {
      if (req.query.format === "xlsx") {
        const buf = await exportService.exportTransactionsExcel("expense", req.query);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="giderler.xlsx"');
        return res.send(Buffer.from(buf));
      }
      const csv = exportService.exportTransactionsCsv("expense", req.query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="giderler.csv"');
      res.send(csv);
    } catch (e) {
      next(e);
    }
  });

  app.get("/export/fleet/pdf", (req, res, next) => {
    try {
      exportService.exportFleetPdf(res, req.query);
    } catch (e) {
      next(e);
    }
  });

  app.get("/export/maintenance/xlsx", async (req, res, next) => {
    try {
      const buf = await exportService.exportMaintenanceExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="bakim.xlsx"');
      res.send(Buffer.from(buf));
    } catch (e) {
      next(e);
    }
  });

  app.get("/export/fuel/xlsx", async (req, res, next) => {
    try {
      const buf = await exportService.exportFuelExcel(req.query);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="yakit.xlsx"');
      res.send(Buffer.from(buf));
    } catch (e) {
      next(e);
    }
  });
}

module.exports = registerExport;
