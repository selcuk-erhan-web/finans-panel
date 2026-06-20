const fs = require("fs");
const path = require("path");

const RELEASE_DIR = path.join(__dirname, "..", "data", "release");
const RELEASE_META_PATH = path.join(RELEASE_DIR, "rc1-release.json");
const KNOWN_ISSUES_PATH = path.join(RELEASE_DIR, "known-issues.json");
const RELEASE_NOTES_PATH = path.join(RELEASE_DIR, "rc1-release-notes.md");

const MODULES = [
  {
    id: "compliance",
    label: "Compliance",
    phases: "CC-1 → CC-6",
    ready: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    phases: "MNT-1 → MNT-5",
    ready: true,
  },
  {
    id: "tire",
    label: "Tire",
    phases: "TYR-1 → TYR-5",
    ready: true,
  },
  {
    id: "audit",
    label: "Audit",
    phases: "AUD-1 → AUD-5",
    ready: true,
  },
];

const PAGES = [
  { path: "/documents", label: "Uygunluk Merkezi", module: "compliance" },
  { path: "/notifications", label: "Uygunluk Bildirimleri", module: "compliance" },
  { path: "/compliance-analytics", label: "Uygunluk Analitiği", module: "compliance" },
  { path: "/maintenance", label: "Bakım Merkezi", module: "maintenance" },
  { path: "/maintenance-schedule", label: "Bakım Planı", module: "maintenance" },
  { path: "/maintenance-alerts", label: "Bakım Uyarıları", module: "maintenance" },
  { path: "/maintenance-analytics", label: "Bakım Analitiği", module: "maintenance" },
  { path: "/tires", label: "Lastik Merkezi", module: "tire" },
  { path: "/tire-history", label: "Lastik Değişim Geçmişi", module: "tire" },
  { path: "/tire-seasonal-schedule", label: "Lastik Sezon Planı", module: "tire" },
  { path: "/tire-alerts", label: "Lastik Uyarıları", module: "tire" },
  { path: "/tire-analytics", label: "Lastik Analitiği", module: "tire" },
  { path: "/audit-logs", label: "İşlem Geçmişi", module: "audit" },
  { path: "/audit-analytics", label: "Denetim Analitiği", module: "audit" },
  { path: "/vehicles", label: "Araç Merkezi", module: "fleet" },
  { path: "/release", label: "Release Candidate", module: "system" },
];

const APIS = [
  { path: "/api/compliance/status", module: "compliance", kind: "status" },
  { path: "/api/compliance/analytics", module: "compliance", kind: "analytics" },
  { path: "/api/notifications", module: "compliance", kind: "notifications" },
  { path: "/api/notifications/unread-count", module: "compliance", kind: "notifications" },
  { path: "/api/maintenance", module: "maintenance", kind: "crud" },
  { path: "/api/maintenance/schedule", module: "maintenance", kind: "schedule" },
  { path: "/api/maintenance/alerts", module: "maintenance", kind: "alerts" },
  { path: "/api/maintenance/analytics", module: "maintenance", kind: "analytics" },
  { path: "/api/tires", module: "tire", kind: "crud" },
  { path: "/api/tires/analytics", module: "tire", kind: "analytics" },
  { path: "/api/tires/seasonal-schedule", module: "tire", kind: "schedule" },
  { path: "/api/tire-history", module: "tire", kind: "history" },
  { path: "/api/tire-alerts", module: "tire", kind: "alerts" },
  { path: "/api/audit-logs", module: "audit", kind: "logs" },
  { path: "/api/audit-logs/entity-history", module: "audit", kind: "history" },
  { path: "/api/audit/dashboard", module: "audit", kind: "dashboard" },
  { path: "/api/audit/analytics", module: "audit", kind: "analytics" },
  { path: "/api/release/readiness", module: "system", kind: "release" },
];

const DASHBOARD_WIDGETS = [
  { id: "complianceDashboardWidget", label: "Compliance Status", module: "compliance" },
  { id: "maintenanceDashboardWidget", label: "Maintenance Overview", module: "maintenance" },
  { id: "tireDashboardWidget", label: "Tire Overview", module: "tire" },
  { id: "auditDashboardWidget", label: "İşlem Aktivitesi", module: "audit" },
];

const ANALYTICS_PAGES = [
  { path: "/compliance-analytics", label: "Uygunluk Analitiği", module: "compliance" },
  { path: "/maintenance-analytics", label: "Bakım Analitiği", module: "maintenance" },
  { path: "/tire-analytics", label: "Lastik Analitiği", module: "tire" },
  { path: "/audit-analytics", label: "Denetim Analitiği", module: "audit" },
];

const AUDIT_COVERAGE = {
  maintenance_crud: "covered",
  tire_crud: "covered",
  tire_history_crud: "covered",
  compliance_documents: "covered",
  compliance_import: "covered",
  vehicle_crud: "not_covered",
  schedule_rules: "not_covered",
  alert_mark_read: "not_covered",
  fuel_hgs: "partial",
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadReleaseMetadata() {
  return readJson(RELEASE_META_PATH, {
    version: "1.0.0-rc1",
    release_name: "FleetOS RC-1",
    status: "release_candidate",
    release_ready: false,
    known_issues_count: 0,
    stabilization_complete: false,
  });
}

function loadKnownIssues() {
  return readJson(KNOWN_ISSUES_PATH, []);
}

function loadReleaseNotesSummary() {
  try {
    const text = fs.readFileSync(RELEASE_NOTES_PATH, "utf8");
    const lines = text.split("\n").filter((line) => line.trim());
    return {
      title: lines[0]?.replace(/^#\s*/, "") || "FleetOS RC-1",
      excerpt: lines.slice(0, 6).join("\n"),
      path: "data/release/rc1-release-notes.md",
    };
  } catch {
    return {
      title: "FleetOS RC-1",
      excerpt: "",
      path: "data/release/rc1-release-notes.md",
    };
  }
}

function buildReleaseInventory() {
  const metadata = loadReleaseMetadata();
  const known_issues = loadKnownIssues();

  return {
    metadata,
    modules: MODULES,
    pages: PAGES,
    apis: APIS,
    dashboard_widgets: DASHBOARD_WIDGETS,
    analytics_pages: ANALYTICS_PAGES,
    audit_coverage: AUDIT_COVERAGE,
    known_issues,
    release_notes: loadReleaseNotesSummary(),
    counts: {
      modules: MODULES.length,
      pages: PAGES.length,
      apis: APIS.length,
      dashboard_widgets: DASHBOARD_WIDGETS.length,
      analytics_pages: ANALYTICS_PAGES.length,
      known_issues: known_issues.length,
      audit_covered: Object.values(AUDIT_COVERAGE).filter((v) => v === "covered").length,
      audit_partial: Object.values(AUDIT_COVERAGE).filter((v) => v === "partial").length,
      audit_not_covered: Object.values(AUDIT_COVERAGE).filter((v) => v === "not_covered").length,
    },
  };
}

function buildReleaseReadiness() {
  const inventory = buildReleaseInventory();
  const metadata = inventory.metadata || loadReleaseMetadata();
  const knownIssues = inventory.known_issues || [];

  return {
    version: metadata.version || "1.0.0-rc1",
    release_name: metadata.release_name || "FleetOS RC-1",
    status: metadata.status || "release_candidate",
    release_ready: Boolean(metadata.release_ready),
    stabilization_complete: Boolean(metadata.stabilization_complete),
    known_issues_count: knownIssues.length,
    inventory_summary: {
      modules: inventory.counts.modules,
      pages: inventory.counts.pages,
      apis: inventory.counts.apis,
      dashboard_widgets: inventory.counts.dashboard_widgets,
      analytics_pages: inventory.counts.analytics_pages,
      audit_covered: inventory.counts.audit_covered,
      audit_not_covered: inventory.counts.audit_not_covered,
    },
    latest_commit: metadata.base_commit || null,
    branch: metadata.branch || "panel-refactor",
    release_date: metadata.release_date || null,
  };
}

module.exports = {
  buildReleaseInventory,
  buildReleaseReadiness,
  loadReleaseMetadata,
  loadKnownIssues,
  loadReleaseNotesSummary,
};
