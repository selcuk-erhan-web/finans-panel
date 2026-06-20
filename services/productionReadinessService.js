const fs = require("fs");
const path = require("path");
const releaseInventoryService = require("./releaseInventoryService");

const RELEASE_DIR = path.join(__dirname, "..", "data", "release");
const PRODUCTION_META_PATH = path.join(RELEASE_DIR, "v1-production.json");
const INVENTORY_SNAPSHOT_PATH = path.join(RELEASE_DIR, "v1-inventory.json");
const CERTIFICATION_PATH = path.join(RELEASE_DIR, "production-certification.json");
const PRODUCTION_NOTES_PATH = path.join(RELEASE_DIR, "v1-release-notes.md");
const KNOWN_ISSUES_PATH = path.join(RELEASE_DIR, "known-issues.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadProductionMetadata() {
  return readJson(PRODUCTION_META_PATH, {
    version: "1.0.0",
    release_name: "FleetOS Production Release",
    status: "production",
    production_ready: false,
    known_issues_count: 0,
    support_level: "unknown",
  });
}

function loadInventorySnapshot() {
  const snapshot = readJson(INVENTORY_SNAPSHOT_PATH, null);
  if (snapshot) return snapshot;
  const live = releaseInventoryService.buildReleaseInventory();
  return {
    version: "1.0.0",
    modules: live.modules,
    pages: live.pages,
    apis: live.apis,
    dashboard_widgets: live.dashboard_widgets,
    analytics_pages: live.analytics_pages,
    audit_coverage: live.audit_coverage,
    counts: live.counts,
  };
}

function loadCertification() {
  return readJson(CERTIFICATION_PATH, {
    version: "1.0.0",
    certified: false,
    production_ready: false,
  });
}

function loadKnownIssues() {
  return releaseInventoryService.loadKnownIssues();
}

function loadProductionNotesSummary() {
  try {
    const text = fs.readFileSync(PRODUCTION_NOTES_PATH, "utf8");
    const lines = text.split("\n").filter((line) => line.trim());
    return {
      title: lines[0]?.replace(/^#\s*/, "") || "FleetOS v1.0.0",
      excerpt: lines.slice(0, 8).join("\n"),
      path: "data/release/v1-release-notes.md",
    };
  } catch {
    return {
      title: "FleetOS v1.0.0",
      excerpt: "",
      path: "data/release/v1-release-notes.md",
    };
  }
}

function buildInventorySummary(counts = {}) {
  return {
    modules: counts.modules || 0,
    pages: counts.pages || 0,
    apis: counts.apis || 0,
    dashboard_widgets: counts.dashboard_widgets || 0,
    analytics_pages: counts.analytics_pages || 0,
    audit_covered: counts.audit_covered || 0,
    audit_not_covered: counts.audit_not_covered || 0,
  };
}

function buildProductionReadiness() {
  const metadata = loadProductionMetadata();
  const inventory = loadInventorySnapshot();
  const certification = loadCertification();
  const knownIssues = loadKnownIssues();

  return {
    version: metadata.version || "1.0.0",
    production_ready: Boolean(metadata.production_ready && certification.production_ready),
    release_candidate: metadata.release_candidate || "1.0.0-rc1",
    known_issues_count: knownIssues.length || metadata.known_issues_count || 0,
    inventory_summary: buildInventorySummary(inventory.counts),
    release_date: metadata.release_date || null,
    support_level: metadata.support_level || "stable",
    status: metadata.status || "production",
    release_commit: metadata.release_commit || null,
    branch: metadata.branch || "panel-refactor",
    certification,
  };
}

function buildProductionPageData() {
  const metadata = loadProductionMetadata();
  const inventory = loadInventorySnapshot();
  const certification = loadCertification();
  const known_issues = loadKnownIssues();
  const release_notes = loadProductionNotesSummary();
  const rcMetadata = releaseInventoryService.loadReleaseMetadata();

  return {
    metadata,
    inventory,
    certification,
    known_issues,
    release_notes,
    release_candidate: {
      version: rcMetadata.version || "1.0.0-rc1",
      release_name: rcMetadata.release_name || "FleetOS RC-1",
      release_ready: Boolean(rcMetadata.release_ready),
      path: "/release",
    },
    readiness: buildProductionReadiness(),
  };
}

module.exports = {
  buildProductionReadiness,
  buildProductionPageData,
  loadProductionMetadata,
  loadInventorySnapshot,
  loadCertification,
  loadProductionNotesSummary,
};
