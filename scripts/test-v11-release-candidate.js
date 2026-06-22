/**
 * FLEETOS RC-2 — v1.1 Release Candidate tests
 * node scripts/test-v11-release-candidate.js
 */
const fs = require("fs");
const path = require("path");
const { NAV_TREE } = require("../lib/navConfig");
const LAYOUT_VERSION = require("../lib/layout-version");
const v11ReleaseCandidateService = require("../services/v11ReleaseCandidateService");
const { v11ReleaseCandidatePageHtml } = require("../lib/components/v11ReleaseCandidate");

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
  console.log("FLEETOS RC-2 v1.1 Release Candidate tests\n");

  test("release metadata exists", () => {
    const metaPath = path.join(ROOT, "data/release/v11-rc2-release.json");
    assert(fs.existsSync(metaPath), "missing v11-rc2-release.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    assert(meta.version === "1.1.0-rc2", meta.version);
    assert(meta.status === "release_candidate", meta.status);
    assert(meta.base_version === "1.0.1", meta.base_version);
    assert(meta.release_ready === true, "release_ready");
    assert(meta.vehicle_intelligence_complete === true, "vi complete");
    assert(meta.stabilization_complete === true, "stb2 complete");
  });

  test("release notes exist", () => {
    const notesPath = path.join(ROOT, "data/release/v11-rc2-release-notes.md");
    assert(fs.existsSync(notesPath), "missing release notes");
    const text = fs.readFileSync(notesPath, "utf8");
    assert(text.includes("VI-1"), "vi-1");
    assert(text.includes("VI-5"), "vi-5");
    assert(text.includes("STB-2"), "stb2");
  });

  test("inventory exists", () => {
    const inventoryPath = path.join(ROOT, "data/release/v11-inventory.json");
    assert(fs.existsSync(inventoryPath), "missing inventory");
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    assert(Array.isArray(inventory.modules) && inventory.modules.length >= 11, "modules");
    assert(Array.isArray(inventory.vehicle_intelligence_pages) && inventory.vehicle_intelligence_pages.length === 5, "vi pages");
    assert(Array.isArray(inventory.vehicle_intelligence_apis) && inventory.vehicle_intelligence_apis.length === 9, "vi apis");
    assert(inventory.counts.dashboard_widgets === 7, "widgets");
  });

  test("known issues load", () => {
    const issuesPath = path.join(ROOT, "data/release/v11-known-issues.json");
    assert(fs.existsSync(issuesPath), "missing known issues");
    const issues = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
    assert(Array.isArray(issues) && issues.length === 8, "issues count");
    assert(issues.every((row) => row.id && row.title && row.description), "issue shape");
  });

  test("service loads", () => {
    assert(typeof v11ReleaseCandidateService.buildV11ReleaseCandidate === "function", "build");
    const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
    assert(payload.release, "release");
    assert(payload.inventory, "inventory");
    assert(payload.summary, "summary");
    assert(payload.readiness, "readiness");
  });

  test("readiness object valid", () => {
    const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
    const readiness = payload.readiness;
    assert(typeof readiness.release_ready === "boolean", "release_ready type");
    assert(typeof readiness.tests_passed === "boolean", "tests_passed type");
    assert(readiness.stabilization_complete === true, "stb2");
    assert(readiness.vehicle_intelligence_complete === true, "vi");
    assert(Array.isArray(readiness.blockers), "blockers");
    assert(readiness.blockers.length === 0, "no blockers");
    assert(readiness.release_ready === true, "ready");
  });

  test("API returns JSON", () => {
    const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
    const json = JSON.parse(JSON.stringify(payload));
    assert(json.release.version === "1.1.0-rc2", "version");
    assert(json.known_issues.length === 8, "issues");
    assert(json.inventory.vehicle_intelligence_phases.length === 7, "phases");
  });

  test("page renders", () => {
    const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
    const html = v11ReleaseCandidatePageHtml(payload);
    assert(html.includes("FleetOS v1.1 Release Candidate"), "title");
    assert(html.includes("Vehicle Intelligence Özeti"), "vi summary");
    assert(html.includes("Envanter Özeti"), "inventory");
    assert(html.includes("Bilinen Sorunlar"), "issues");
    assert(html.includes("Release Notes Özeti"), "notes");
    assert(html.includes("Readiness Özeti"), "readiness");
    assert(!html.includes("undefined"), "undefined leak");
  });

  test("nav item exists", () => {
    const system = NAV_TREE.find((node) => node.id === "system");
    assert(system, "system group");
    assert(
      system.items.some(([href, label]) => href === "/release/v1.1" && label === "v1.1 Release Candidate"),
      "nav item"
    );
    const roadmapIdx = system.items.findIndex(([href]) => href === "/roadmap/v1.1");
    const releaseIdx = system.items.findIndex(([href]) => href === "/release/v1.1");
    const settingsIdx = system.items.findIndex(([href]) => href === "/settings");
    assert(roadmapIdx >= 0 && releaseIdx > roadmapIdx, "after roadmap");
    assert(releaseIdx >= 0 && settingsIdx > releaseIdx, "before settings");
  });

  test("release ready flag valid", () => {
    const payload = v11ReleaseCandidateService.buildV11ReleaseCandidate();
    assert(payload.release.release_ready === true, "metadata ready");
    assert(payload.readiness.release_ready === true, "computed ready");
    assert(payload.summary.release_ready === true, "summary ready");
    assert(payload.release.known_issues_count === 8, "issue count sync");
  });

  test("layout version updated", () => {
    assert(LAYOUT_VERSION === "fleetos-rc2-v11-release-01", LAYOUT_VERSION);
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
