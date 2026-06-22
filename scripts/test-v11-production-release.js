/**
 * FLEETOS PRD-2 — v1.1 Production Release tests
 * node scripts/test-v11-production-release.js
 */
const fs = require("fs");
const path = require("path");
const { NAV_TREE } = require("../lib/navConfig");
const LAYOUT_VERSION = require("../lib/layout-version");
const v11ProductionReadinessService = require("../services/v11ProductionReadinessService");
const { v11ProductionReleasePageHtml } = require("../lib/components/v11ProductionRelease");

const ROOT = path.join(__dirname, "..");
const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, error: err.message || String(err) });
  console.error(`✗ ${name}: ${err.message || err}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

function main() {
  console.log("FLEETOS PRD-2 v1.1 Production Release tests\n");

  test("production metadata exists", () => {
    const metaPath = path.join(ROOT, "data/release/v11-production.json");
    assert(fs.existsSync(metaPath), "missing v11-production.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    assert(meta.version === "1.1.0", meta.version);
    assert(meta.status === "production", meta.status);
    assert(meta.production_ready === true, "production_ready");
    assert(meta.release_candidate === "1.1.0-rc2", meta.release_candidate);
    assert(meta.support_level === "stable", meta.support_level);
  });

  test("certification exists", () => {
    const certPath = path.join(ROOT, "data/release/v11-production-certification.json");
    assert(fs.existsSync(certPath), "missing certification");
    const cert = JSON.parse(fs.readFileSync(certPath, "utf8"));
    assert(cert.version === "1.1.0", cert.version);
    assert(cert.certified === true, "certified");
    assert(cert.tests_passed === true, "tests_passed");
    assert(cert.release_candidate_complete === true, "rc complete");
    assert(cert.vehicle_intelligence_complete === true, "vi complete");
    assert(cert.production_ready === true, "production_ready");
  });

  test("inventory exists", () => {
    const invPath = path.join(ROOT, "data/release/v11-production-inventory.json");
    assert(fs.existsSync(invPath), "missing inventory");
    const inv = JSON.parse(fs.readFileSync(invPath, "utf8"));
    assert(inv.version === "1.1.0", inv.version);
    assert(inv.frozen === true, "frozen");
    assert(inv.counts.modules === 11, "modules");
    assert(inv.counts.pages === 25, "pages");
    assert(inv.counts.apis === 19, "apis");
    assert(inv.counts.dashboard_widgets === 7, "widgets");
    assert(inv.counts.vehicle_intelligence_pages === 5, "vi pages");
    assert(inv.counts.vehicle_intelligence_apis === 9, "vi apis");
    assert(inv.counts.certification_phases === 8, "phases");
  });

  test("known issues load", () => {
    const issuesPath = path.join(ROOT, "data/release/v11-known-issues.json");
    assert(fs.existsSync(issuesPath), "missing known issues");
    const issues = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
    assert(Array.isArray(issues) && issues.length === 8, "issues count");
    assert(issues.every((row) => row.id && row.title), "issue shape");
  });

  test("readiness service loads", () => {
    assert(typeof v11ProductionReadinessService.buildV11ProductionReadiness === "function", "builder");
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    assert(payload.production, "production");
    assert(payload.certification, "certification");
    assert(payload.inventory, "inventory");
    assert(payload.readiness, "readiness");
  });

  test("readiness object valid", () => {
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    const readiness = payload.readiness;
    assert(typeof readiness.production_ready === "boolean", "production_ready type");
    assert(typeof readiness.certified === "boolean", "certified type");
    assert(typeof readiness.tests_passed === "boolean", "tests_passed type");
    assert(readiness.production_ready === true, "ready");
    assert(readiness.certified === true, "certified");
    assert(readiness.tests_passed === true, "tests");
    assert(readiness.support_level === "stable", "support");
    assert(Array.isArray(readiness.blockers), "blockers");
    assert(readiness.blockers.length === 0, "no blockers");
  });

  test("API returns JSON", () => {
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    const json = JSON.parse(JSON.stringify(payload));
    assert(json.production.version === "1.1.0", "version");
    assert(json.certification.certified === true, "certified");
    assert(json.inventory.counts.pages === 25, "pages");
    assert(json.known_issues.length === 8, "issues");
  });

  test("page renders", () => {
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    const html = v11ProductionReleasePageHtml(payload);
    assert(html.includes("FleetOS v1.1 Production Release"), "title");
    assert(html.includes("Vehicle Intelligence Sertifikasyonu"), "certification");
    assert(html.includes("Production Envanteri"), "inventory");
    assert(html.includes("Bilinen Sorunlar"), "issues");
    assert(html.includes("Production Release Notes"), "notes");
    assert(html.includes("Readiness Özeti"), "readiness");
    assert(!html.includes("undefined"), "undefined leak");
  });

  test("nav item exists", () => {
    const system = NAV_TREE.find((node) => node.id === "system");
    assert(system, "system group");
    assert(
      system.items.some(([href, label]) => href === "/production/v1.1" && label === "v1.1 Production Release"),
      "nav item"
    );
    const releaseIdx = system.items.findIndex(([href]) => href === "/release/v1.1");
    const prodIdx = system.items.findIndex(([href]) => href === "/production/v1.1");
    const settingsIdx = system.items.findIndex(([href]) => href === "/settings");
    assert(releaseIdx >= 0 && prodIdx > releaseIdx, "after release candidate");
    assert(prodIdx >= 0 && settingsIdx > prodIdx, "before settings");
  });

  test("production ready true", () => {
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    assert(payload.production.production_ready === true, "metadata");
    assert(payload.certification.production_ready === true, "certification");
    assert(payload.readiness.production_ready === true, "readiness");
  });

  test("certified true", () => {
    const payload = v11ProductionReadinessService.buildV11ProductionReadiness();
    assert(payload.certification.certified === true, "certified flag");
    assert(payload.readiness.certified === true, "readiness certified");
    const phases = payload.inventory.certification_phases || [];
    assert(phases.length === 8, "phase count");
    assert(phases.every((p) => p.complete), "all phases complete");
  });

  test("layout version updated", () => {
    assert(LAYOUT_VERSION === "fleetos-prd2-v11-production-01", LAYOUT_VERSION);
  });

  console.log("\n--- PASS/FAIL SUMMARY ---");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`PASS: ${passed}/${results.length}`);
  if (failed.length) {
    console.log(`FAIL: ${failed.length}`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log("ALL TESTS PASSED");
}

main();
