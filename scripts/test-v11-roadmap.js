/**
 * FLEETOS V11-PLN-1 — v1.1 Roadmap Planning tests
 * node scripts/test-v11-roadmap.js
 */
const fs = require("fs");
const path = require("path");
const roadmapService = require("../services/roadmapService");
const { roadmapPageHtml } = require("../lib/components/roadmap");

const ROOT = path.join(__dirname, "..");
const results = [];

const REQUIRED_PHASE_IDS = [
  "V11-PLN-1",
  "VI-1",
  "VI-2",
  "VI-3",
  "VI-4",
  "VI-5",
  "STB-2",
  "RC-2",
  "PRD-2",
];

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
  console.log("FLEETOS V11-PLN-1 v1.1 Roadmap Planning tests\n");

  test("roadmap JSON exists", () => {
    const jsonPath = path.join(ROOT, "data/roadmap/v1.1-roadmap.json");
    assert(fs.existsSync(jsonPath), "missing v1.1-roadmap.json");
    const meta = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert(meta.version === "1.1.0", meta.version);
    assert(meta.base_version === "1.0.1", meta.base_version);
  });

  test("roadmap markdown exists", () => {
    const mdPath = path.join(ROOT, "data/roadmap/v1.1-roadmap.md");
    assert(fs.existsSync(mdPath), "missing v1.1-roadmap.md");
    const text = fs.readFileSync(mdPath, "utf8");
    assert(text.includes("# FleetOS v1.1 Roadmap"), "title");
    assert(text.includes("Vehicle Intelligence & Operational Control"), "theme");
  });

  test("roadmap service loads", () => {
    assert(typeof roadmapService.getV11Roadmap === "function", "getV11Roadmap");
    const roadmap = roadmapService.getV11Roadmap();
    assert(roadmap && typeof roadmap === "object", "roadmap object");
    assert(Array.isArray(roadmap.pillars) && roadmap.pillars.length > 0, "pillars");
  });

  test("version is 1.1.0", () => {
    const roadmap = roadmapService.getV11Roadmap();
    assert(roadmap.version === "1.1.0", roadmap.version);
  });

  test("base_version is 1.0.1", () => {
    const roadmap = roadmapService.getV11Roadmap();
    assert(roadmap.base_version === "1.0.1", roadmap.base_version);
  });

  test("phases exist", () => {
    const roadmap = roadmapService.getV11Roadmap();
    assert(Array.isArray(roadmap.phases) && roadmap.phases.length > 0, "phases array");
  });

  test("required phases exist", () => {
    const roadmap = roadmapService.getV11Roadmap();
    const ids = roadmap.phases.map((phase) => phase.id);
    for (const id of REQUIRED_PHASE_IDS) {
      assert(ids.includes(id), `missing phase ${id}`);
    }
  });

  test("API returns JSON", () => {
    const roadmap = roadmapService.getV11Roadmap();
    const apiPayload = {
      version: roadmap.version,
      codename: roadmap.codename,
      status: roadmap.status,
      base_version: roadmap.base_version,
      primary_goal: roadmap.primary_goal,
      pillars: roadmap.pillars,
      phases: roadmap.phases,
      out_of_scope: roadmap.out_of_scope,
    };
    const serialized = JSON.stringify(apiPayload);
    const parsed = JSON.parse(serialized);
    assert(parsed.version === "1.1.0", parsed.version);
    assert(parsed.status === "planning", parsed.status);
  });

  test("roadmap page renders", () => {
    const html = roadmapPageHtml(roadmapService.getV11Roadmap());
    assert(html.includes("FleetOS v1.1 Roadmap"), "title");
    assert(html.includes("Primary Goal"), "primary goal section");
    assert(html.includes("Pillars"), "pillars section");
    assert(html.includes("Planned Phases"), "phases section");
    assert(html.includes("V11-PLN-1"), "planning phase");
    assert(html.includes("VI-5"), "executive dashboard phase");
  });

  test("out-of-scope section exists", () => {
    const roadmap = roadmapService.getV11Roadmap();
    assert(Array.isArray(roadmap.out_of_scope) && roadmap.out_of_scope.length > 0, "out_of_scope");
    const html = roadmapPageHtml(roadmap);
    assert(html.includes("Out of Scope"), "out of scope heading");
    assert(html.includes("Multi-user RBAC"), "rbac item");
    assert(html.includes("Approval workflow"), "approval workflow item");
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
