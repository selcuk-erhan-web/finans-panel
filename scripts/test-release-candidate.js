/**
 * FLEETOS RC-1 — Release Candidate tests
 * node scripts/test-release-candidate.js
 */
const fs = require("fs");
const path = require("path");
const releaseInventoryService = require("../services/releaseInventoryService");
const { releaseCandidatePageHtml } = require("../lib/components/releaseCandidate");

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
  console.log("FLEETOS RC-1 Release Candidate tests\n");

  test("release metadata exists", () => {
    const metaPath = path.join(ROOT, "data/release/rc1-release.json");
    assert(fs.existsSync(metaPath), "missing rc1-release.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    assert(meta.version === "1.0.0-rc1", meta.version);
    assert(meta.status === "release_candidate", meta.status);
    assert(meta.release_ready === true, "release_ready");
  });

  test("release notes exist", () => {
    const notesPath = path.join(ROOT, "data/release/rc1-release-notes.md");
    assert(fs.existsSync(notesPath), "missing release notes");
    const text = fs.readFileSync(notesPath, "utf8");
    assert(text.includes("FleetOS RC-1"), "title");
    assert(text.includes("Known Limitations"), "limitations section");
  });

  test("known issues exist", () => {
    const issuesPath = path.join(ROOT, "data/release/known-issues.json");
    assert(fs.existsSync(issuesPath), "missing known issues");
    const issues = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
    assert(Array.isArray(issues) && issues.length > 0, "issues array");
    assert(issues.every((row) => row.id && row.title), "issue shape");
  });

  test("inventory service loads", () => {
    assert(typeof releaseInventoryService.buildReleaseInventory === "function", "inventory");
    const inventory = releaseInventoryService.buildReleaseInventory();
    assert(Array.isArray(inventory.modules) && inventory.modules.length === 4, "modules");
    assert(Array.isArray(inventory.pages) && inventory.pages.length > 0, "pages");
    assert(Array.isArray(inventory.apis) && inventory.apis.length > 0, "apis");
    assert(inventory.counts.modules === 4, "module count");
  });

  test("readiness API returns JSON", () => {
    const readiness = releaseInventoryService.buildReleaseReadiness();
    JSON.stringify(readiness);
    assert(readiness.version === "1.0.0-rc1", readiness.version);
    assert(readiness.inventory_summary, "inventory_summary");
    assert(readiness.latest_commit, "latest_commit");
  });

  test("release page renders", () => {
    const html = releaseCandidatePageHtml(releaseInventoryService.buildReleaseInventory());
    assert(html.includes("FleetOS RC-1"), "title");
    assert(html.includes("Modül Envanteri"), "modules");
    assert(html.includes("Dashboard Widget Envanteri"), "widgets");
    assert(html.includes("Bilinen Sorunlar"), "issues");
    assert(html.includes("Release Notes Özeti"), "notes");
  });

  test("release status valid", () => {
    const readiness = releaseInventoryService.buildReleaseReadiness();
    assert(readiness.status === "release_candidate", readiness.status);
    assert(readiness.stabilization_complete === true, "stabilization");
    assert(readiness.branch === "panel-refactor", readiness.branch);
  });

  test("release_ready flag exists", () => {
    const readiness = releaseInventoryService.buildReleaseReadiness();
    assert(typeof readiness.release_ready === "boolean", "type");
    assert(readiness.release_ready === true, "ready");
    assert(readiness.known_issues_count === 8, readiness.known_issues_count);
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
