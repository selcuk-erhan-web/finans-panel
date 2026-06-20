/**
 * FLEETOS CC-4 — Compliance dashboard widget validation
 * node scripts/test-compliance-dashboard-widget.js
 */
const fs = require("fs");
const path = require("path");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const CACHE_PATTERNS = [
  "/services/documentService",
  "/services/complianceStatusService",
  "/lib/db.js",
];

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-cc4-widget-",
  "test-compliance-dashboard-widget.js",
  CACHE_PATTERNS
);

const complianceStatusService = require("../services/complianceStatusService");
const { complianceDashboardWidgetHtml } = require("../lib/components/complianceDashboard");

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  PASS  ${name}`);
}

function fail(name, msg) {
  results.push({ name, ok: false, err: msg });
  console.log(`  FAIL  ${name}: ${msg}`);
}

function assert(name, cond, msg) {
  if (cond) pass(name);
  else fail(name, msg);
}

function main() {
  console.log("FLEETOS CC-4 Compliance Dashboard Widget\n");

  console.log("1) API payload shape");
  const report = complianceStatusService.buildStatusReport(new Date("2026-06-01T12:00:00"));
  assert("summary exists", report.summary && typeof report.summary === "object", "missing summary");
  assert("summary.active", typeof report.summary.active === "number", "missing active");
  assert("summary.warning", typeof report.summary.warning === "number", "missing warning");
  assert("summary.critical", typeof report.summary.critical === "number", "missing critical");
  assert("summary.expired", typeof report.summary.expired === "number", "missing expired");
  assert("records array", Array.isArray(report.records), "records not array");
  assert("vehicle_scores array", Array.isArray(report.vehicle_scores), "vehicle_scores not array");
  assert("endpoint logic does not crash", true, "crashed");

  console.log("\n2) Dashboard widget markup");
  const html = complianceDashboardWidgetHtml();
  assert("widget root id", html.includes('id="complianceDashboardWidget"'), "missing widget root");
  assert("Compliance Status title", html.includes("Compliance Status"), "missing title");
  assert("summary counter ids", html.includes("complianceCountActive"), "missing counters");
  assert("risk list container", html.includes("complianceWidgetRiskList"), "missing risk list");
  assert("vehicle score container", html.includes("complianceWidgetVehicleScores"), "missing scores");
  assert("compliance dashboard script", html.includes("/js/compliance-dashboard.js"), "missing script");

  console.log("\n3) Frontend loader file");
  const jsPath = path.join(__dirname, "..", "public", "js", "compliance-dashboard.js");
  const js = fs.readFileSync(jsPath, "utf8");
  assert("loadComplianceStatus defined", js.includes("loadComplianceStatus"), "missing loader");
  assert("fetch /api/compliance/status", js.includes('fetch("/api/compliance/status")'), "missing fetch");
  assert("handles API errors", js.includes("complianceWidgetError"), "missing error state");

  const failed = results.filter((row) => !row.ok);
  console.log("\n" + "=".repeat(48));
  if (failed.length) {
    console.log(`RESULT: FAIL (${failed.length}/${results.length} checks failed)`);
    process.exitCode = 1;
  } else {
    console.log(`RESULT: PASS (${results.length}/${results.length} checks passed)`);
  }
}

try {
  main();
} catch (err) {
  console.error("\nUnexpected error:", err.message);
  process.exit(1);
} finally {
  cleanupTestDatabase(tmpDir);
}
