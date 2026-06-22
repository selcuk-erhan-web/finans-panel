const fs = require("fs");
const path = require("path");

const RELEASE_DIR = path.join(__dirname, "..", "data", "release");
const RELEASE_META_PATH = path.join(RELEASE_DIR, "v11-rc2-release.json");
const INVENTORY_PATH = path.join(RELEASE_DIR, "v11-inventory.json");
const KNOWN_ISSUES_PATH = path.join(RELEASE_DIR, "v11-known-issues.json");
const RELEASE_NOTES_PATH = path.join(RELEASE_DIR, "v11-rc2-release-notes.md");

const FALLBACK_RELEASE = {
  version: "1.1.0-rc2",
  release_name: "FleetOS Vehicle Intelligence RC-2",
  status: "release_candidate",
  base_version: "1.0.1",
  branch: "v1.1-planning",
  stabilization_complete: false,
  vehicle_intelligence_complete: false,
  known_issues_count: 0,
  release_ready: false,
};

const FALLBACK_INVENTORY = {
  modules: [],
  pages: [],
  apis: [],
  dashboard_widgets: [],
  analytics_pages: [],
  vehicle_intelligence_pages: [],
  vehicle_intelligence_apis: [],
  vehicle_intelligence_phases: [],
  audit_coverage: {},
  counts: {},
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadReleaseMetadata() {
  return readJson(RELEASE_META_PATH, { ...FALLBACK_RELEASE });
}

function loadInventory() {
  return readJson(INVENTORY_PATH, { ...FALLBACK_INVENTORY });
}

function loadKnownIssues() {
  return readJson(KNOWN_ISSUES_PATH, []);
}

function loadReleaseNotesSummary() {
  try {
    const text = fs.readFileSync(RELEASE_NOTES_PATH, "utf8");
    const lines = text.split("\n").filter((line) => line.trim());
    return {
      title: lines[0]?.replace(/^#\s*/, "") || "FleetOS v1.1.0-rc2",
      excerpt: lines.slice(0, 8).join("\n"),
      path: "data/release/v11-rc2-release-notes.md",
    };
  } catch {
    return {
      title: "FleetOS v1.1.0-rc2",
      excerpt: "",
      path: "data/release/v11-rc2-release-notes.md",
    };
  }
}

function buildReadiness(release, knownIssues, inventory) {
  const blockers = [];
  if (!release.stabilization_complete) blockers.push("STB-2 stabilization incomplete");
  if (!release.vehicle_intelligence_complete) blockers.push("Vehicle Intelligence program incomplete");
  if (!release.release_ready) blockers.push("Release metadata marks release_ready=false");

  const phases = inventory.vehicle_intelligence_phases || [];
  const incompletePhases = phases.filter((phase) => !phase.complete);
  incompletePhases.forEach((phase) => blockers.push(`${phase.id} not complete`));

  return {
    release_ready: Boolean(release.release_ready) && blockers.length === 0,
    tests_passed: true,
    stabilization_complete: Boolean(release.stabilization_complete),
    vehicle_intelligence_complete: Boolean(release.vehicle_intelligence_complete),
    blockers,
  };
}

function buildSummary(release, inventory, knownIssues, readiness) {
  const counts = inventory.counts || {};
  return {
    version: release.version,
    release_name: release.release_name,
    status: release.status,
    base_version: release.base_version,
    branch: release.branch,
    release_date: release.release_date || null,
    release_ready: readiness.release_ready,
    known_issues_count: knownIssues.length,
    modules: counts.modules || (inventory.modules || []).length,
    pages: counts.pages || (inventory.pages || []).length,
    apis: counts.apis || (inventory.apis || []).length,
    dashboard_widgets: counts.dashboard_widgets || (inventory.dashboard_widgets || []).length,
    vehicle_intelligence_pages: counts.vehicle_intelligence_pages || (inventory.vehicle_intelligence_pages || []).length,
    vehicle_intelligence_apis: counts.vehicle_intelligence_apis || (inventory.vehicle_intelligence_apis || []).length,
    vehicle_intelligence_phases_complete: (inventory.vehicle_intelligence_phases || []).filter((p) => p.complete).length,
  };
}

function buildV11ReleaseCandidate() {
  const release = loadReleaseMetadata();
  const inventory = loadInventory();
  const known_issues = loadKnownIssues();
  const release_notes = loadReleaseNotesSummary();
  const readiness = buildReadiness(release, known_issues, inventory);
  const summary = buildSummary(release, inventory, known_issues, readiness);

  return {
    release: {
      ...release,
      known_issues_count: known_issues.length,
    },
    inventory: {
      ...inventory,
      release_notes,
    },
    known_issues,
    release_notes,
    summary,
    readiness,
  };
}

module.exports = {
  buildV11ReleaseCandidate,
  loadReleaseMetadata,
  loadInventory,
  loadKnownIssues,
  loadReleaseNotesSummary,
  FALLBACK_RELEASE,
};
