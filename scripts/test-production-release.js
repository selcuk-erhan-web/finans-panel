/**
 * FLEETOS PRD-1 — Production Release tests
 * node scripts/test-production-release.js
 */
const fs = require("fs");
const path = require("path");
const productionReadinessService = require("../services/productionReadinessService");
const { productionReleasePageHtml } = require("../lib/components/productionRelease");

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
  console.log("FLEETOS PRD-1 Production Release tests\n");

  test("production metadata exists", () => {
    const metaPath = path.join(ROOT, "data/release/v1-production.json");
    assert(fs.existsSync(metaPath), "missing v1-production.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    assert(meta.version === "1.0.0", meta.version);
    assert(meta.status === "production", meta.status);
    assert(meta.production_ready === true, "production_ready");
  });

  test("production notes exist", () => {
    const notesPath = path.join(ROOT, "data/release/v1-release-notes.md");
    assert(fs.existsSync(notesPath), "missing v1-release-notes.md");
    const text = fs.readFileSync(notesPath, "utf8");
    assert(text.includes("FleetOS v1.0.0"), "title");
    assert(text.includes("Production Readiness"), "readiness section");
  });

  test("inventory snapshot exists", () => {
    const invPath = path.join(ROOT, "data/release/v1-inventory.json");
    assert(fs.existsSync(invPath), "missing v1-inventory.json");
    const inv = JSON.parse(fs.readFileSync(invPath, "utf8"));
    assert(inv.version === "1.0.0", inv.version);
    assert(Array.isArray(inv.modules) && inv.modules.length === 4, "modules");
    assert(inv.counts.pages >= 16, "pages");
    assert(inv.counts.apis >= 18, "apis");
  });

  test("readiness service loads", () => {
    assert(typeof productionReadinessService.buildProductionReadiness === "function", "builder");
    const readiness = productionReadinessService.buildProductionReadiness();
    assert(readiness.version === "1.0.0", readiness.version);
    assert(readiness.inventory_summary, "inventory_summary");
  });

  test("production API returns JSON", () => {
    const readiness = productionReadinessService.buildProductionReadiness();
    const apiPayload = {
      version: readiness.version,
      status: readiness.status,
      production_ready: readiness.production_ready,
      support_level: readiness.support_level,
      known_issues_count: readiness.known_issues_count,
      inventory_summary: readiness.inventory_summary,
    };
    JSON.stringify(apiPayload);
    assert(apiPayload.status === "production", apiPayload.status);
  });

  test("production page renders", () => {
    const html = productionReleasePageHtml(productionReadinessService.buildProductionPageData());
    assert(html.includes("FleetOS v1.0.0"), "title");
    assert(html.includes("Platform Envanteri"), "inventory");
    assert(html.includes("Dashboard Envanteri"), "dashboard");
    assert(html.includes("Bilinen Sorunlar"), "issues");
    assert(html.includes("Release Candidate Referansı"), "rc ref");
  });

  test("production_ready exists", () => {
    const readiness = productionReadinessService.buildProductionReadiness();
    assert(typeof readiness.production_ready === "boolean", "type");
    assert(readiness.production_ready === true, "ready");
    const certPath = path.join(ROOT, "data/release/production-certification.json");
    const cert = JSON.parse(fs.readFileSync(certPath, "utf8"));
    assert(cert.production_ready === true, "certified");
  });

  test("support_level exists", () => {
    const readiness = productionReadinessService.buildProductionReadiness();
    assert(readiness.support_level === "stable", readiness.support_level);
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
