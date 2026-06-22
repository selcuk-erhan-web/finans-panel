const fs = require("fs");
const path = require("path");

const RELEASE_DIR = path.join(__dirname, "..", "data", "release");
const PRODUCTION_META_PATH = path.join(RELEASE_DIR, "v11-production.json");
const INVENTORY_PATH = path.join(RELEASE_DIR, "v11-production-inventory.json");
const CERTIFICATION_PATH = path.join(RELEASE_DIR, "v11-production-certification.json");
const KNOWN_ISSUES_PATH = path.join(RELEASE_DIR, "v11-known-issues.json");
const PRODUCTION_NOTES_PATH = path.join(RELEASE_DIR, "v11-production-release-notes.md");

const FALLBACK_PRODUCTION = {
  version: "1.1.0",
  release_name: "FleetOS Vehicle Intelligence",
  status: "production",
  production_ready: false,
  support_level: "unknown",
  known_issues_count: 0,
};

const FALLBACK_CERTIFICATION = {
  version: "1.1.0",
  certified: false,
  production_ready: false,
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadProductionMetadata() {
  return readJson(PRODUCTION_META_PATH, { ...FALLBACK_PRODUCTION });
}

function loadInventory() {
  return readJson(INVENTORY_PATH, { counts: {}, modules: [], pages: [], apis: [] });
}

function loadCertification() {
  return readJson(CERTIFICATION_PATH, { ...FALLBACK_CERTIFICATION });
}

function loadKnownIssues() {
  return readJson(KNOWN_ISSUES_PATH, []);
}

function loadProductionNotesSummary() {
  try {
    const text = fs.readFileSync(PRODUCTION_NOTES_PATH, "utf8");
    const lines = text.split("\n").filter((line) => line.trim());
    return {
      title: lines[0]?.replace(/^#\s*/, "") || "FleetOS v1.1.0",
      excerpt: lines.slice(0, 8).join("\n"),
      path: "data/release/v11-production-release-notes.md",
    };
  } catch {
    return {
      title: "FleetOS v1.1.0",
      excerpt: "",
      path: "data/release/v11-production-release-notes.md",
    };
  }
}

function buildReadiness(production, certification, inventory, knownIssues) {
  const blockers = [];

  if (!production.production_ready) blockers.push("Production metadata marks production_ready=false");
  if (!certification.certified) blockers.push("Production not certified");
  if (!certification.tests_passed) blockers.push("Tests not passed");
  if (!certification.stabilization_complete) blockers.push("STB-2 incomplete");
  if (!certification.release_candidate_complete) blockers.push("RC-2 incomplete");
  if (!certification.vehicle_intelligence_complete) blockers.push("Vehicle Intelligence incomplete");

  const phases = inventory.certification_phases || [];
  phases.filter((p) => !p.complete).forEach((p) => blockers.push(`${p.id} not complete`));

  const productionReady =
    Boolean(production.production_ready) &&
    Boolean(certification.production_ready) &&
    Boolean(certification.certified) &&
    blockers.length === 0;

  return {
    production_ready: productionReady,
    certified: Boolean(certification.certified),
    tests_passed: Boolean(certification.tests_passed),
    blockers,
    support_level: production.support_level || "stable",
  };
}

function buildV11ProductionReadiness() {
  const production = loadProductionMetadata();
  const certification = loadCertification();
  const inventory = loadInventory();
  const known_issues = loadKnownIssues();
  const release_notes = loadProductionNotesSummary();
  const readiness = buildReadiness(production, certification, inventory, known_issues);

  return {
    production: {
      ...production,
      known_issues_count: known_issues.length,
    },
    certification,
    inventory: {
      ...inventory,
      release_notes,
    },
    known_issues,
    release_notes,
    readiness,
  };
}

module.exports = {
  buildV11ProductionReadiness,
  loadProductionMetadata,
  loadInventory,
  loadCertification,
  loadKnownIssues,
  loadProductionNotesSummary,
  FALLBACK_PRODUCTION,
};
