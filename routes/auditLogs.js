const auditLogService = require("../services/auditLogService");
const { auditLogsPageHtml } = require("../lib/components/auditLogs");
const { renderLayout } = require("../lib/ui");

function parseFilters(query) {
  return {
    module: query.module || "",
    entity_type: query.entity_type || "",
    entity_id: query.entity_id || "",
    action: query.action || "",
    actor_id: query.actor_id || "",
    date_from: query.date_from || "",
    date_to: query.date_to || "",
    limit: query.limit || "50",
  };
}

function registerAuditLogs(app) {
  app.get("/api/audit-logs/entity-history", (req, res) => {
    try {
      const payload = auditLogService.getEntityAuditHistory({
        module: req.query.module,
        entity_type: req.query.entity_type,
        entity_id: req.query.entity_id,
        limit: req.query.limit,
      });
      res.json(payload);
    } catch (err) {
      const status = /zorunlu/i.test(err.message) ? 400 : 500;
      res.status(status).json({ error: err.message || "Varlık geçmişi alınamadı." });
    }
  });

  app.get("/api/audit-logs", (req, res) => {
    try {
      const filters = parseFilters(req.query || {});
      const summary = auditLogService.buildAuditSummary(filters);
      const records = auditLogService.listAuditLogs(filters);
      res.json({ summary, records });
    } catch (err) {
      console.error("GET /api/audit-logs:", err);
      res.status(500).json({ error: err.message || "İşlem geçmişi alınamadı." });
    }
  });

  app.get("/api/audit-logs/:id", (req, res) => {
    try {
      const record = auditLogService.getAuditLog(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Kayıt bulunamadı." });
      }
      res.json(record);
    } catch (err) {
      console.error("GET /api/audit-logs/:id:", err);
      res.status(500).json({ error: err.message || "İşlem geçmişi kaydı alınamadı." });
    }
  });

  app.get("/audit-logs", (req, res) => {
    try {
      const filters = parseFilters(req.query || {});
      const summary = auditLogService.buildAuditSummary(filters);
      const records = auditLogService.listAuditLogs(filters);
      const content = auditLogsPageHtml({ summary, records, filters });

      renderLayout(res, "İşlem Geçmişi", content, "/audit-logs", req, {
        pageTitle: "İşlem Geçmişi",
        breadcrumb: "Sistem / İşlem Geçmişi",
      });
    } catch (err) {
      console.error("audit-logs:", err);
      const { errorPage } = require("../lib/ui");
      res.status(500).send(errorPage("Hata", "İşlem geçmişi yüklenemedi."));
    }
  });
}

module.exports = registerAuditLogs;
