/**
 * FLEETOS STB Final Audit — v1.2 freeze readiness
 * node scripts/test-stb-final-audit.js
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const { execSync } = require("child_process");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

const STB6F = "fleetos-stb6f-executive-information-architecture-01";

const CACHE_PATTERNS = [
  "/services/",
  "/lib/components/",
  "/routes/",
  "/middleware/",
];

const ROUTE_AUDIT = [
  { path: "/login", public: true, label: "Login" },
  { path: "/", label: "Dashboard" },
  { path: "/vehicles", label: "Vehicle list" },
  { path: "/vehicle/11", label: "Vehicle 360 #11", optional: true },
  { path: "/vehicle/12", label: "Vehicle 360 #12", optional: true },
  { path: "/vehicles/11/360", label: "Vehicle 360 alias #11", optional: true },
  { path: "/vehicles/12/360", label: "Vehicle 360 alias #12", optional: true },
  { path: "/vehicle-intelligence", label: "Vehicle intelligence" },
  { path: "/compliance", label: "Compliance (legacy path)", notAvailable: true },
  { path: "/documents", label: "Compliance hub (/documents)" },
  { path: "/maintenance", label: "Maintenance" },
  { path: "/tires", label: "Tires" },
  { path: "/income", label: "Income" },
  { path: "/expenses", label: "Expenses" },
  { path: "/finance", label: "Finance (legacy path)", notAvailable: true },
  { path: "/cashflow", label: "Finance hub (/cashflow)" },
  { path: "/personnel", label: "Personnel (legacy path)", notAvailable: true },
  { path: "/employees", label: "Personnel hub (/employees)" },
  { path: "/operations", label: "Operations (legacy path)", notAvailable: true },
  { path: "/subcontractors", label: "Operations hub (/subcontractors)" },
  { path: "/settings", label: "Settings" },
  { path: "/roadmap", label: "Roadmap (legacy path)", notAvailable: true },
  { path: "/roadmap/v1.1", label: "Roadmap v1.1" },
];

const V360_REQUIRED = [
  "vehicle-360-center",
  "vehicle-executive-cockpit",
  "vehicle-executive-scoreboard",
  "vehicle-action-intelligence--ticker",
  "executive-kpi-grid--grouped",
  "vehicle-intelligence-ribbons",
  "fleet-comparison-ribbon",
  "executive-predictive-ribbon",
  "vehicle-detail-accordions",
];

const NAV_LABELS = [
  "Ana Ekran",
  "Filo",
  "Araçlar",
  "Araç Zekâsı",
  "Uygunluk",
  "Bakım",
  "Lastik",
  "Gelirler",
  "Giderler",
  "Finans",
  "Personel",
  "Operasyon",
  "Sistem",
];

const ARTIFACT_PATTERNS = [
  { re: /\[object Object\]/, label: "[object Object]" },
  { re: />\s*undefined\s*</i, label: "undefined in markup" },
  { re: /ReferenceError:|TypeError:|SyntaxError:/, label: "JS error in page" },
  { re: /\n\s+at\s+\w+\s+\(/, label: "stack trace" },
  { re: /Sunucu hatası:\s*\w+Error/, label: "raw server error" },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildTestApp(port) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  const registerAuth = require("../routes/auth");
  const { requireAuth } = require("../middleware/auth");

  registerAuth(app);
  app.use(requireAuth);

  require("../routes/dashboard")(app);
  require("../routes/vehicles").registerVehicles(app);
  require("../routes/transactions")(app);
  require("../routes/income")(app);
  require("../routes/maintenanceAnalytics")(app);
  require("../routes/tireAnalytics")(app);
  require("../routes/tireSeasonalSchedule")(app);
  require("../routes/tires")(app);
  require("../routes/tireHistory")(app);
  require("../routes/tireAlerts")(app);
  require("../routes/maintenanceSchedule")(app);
  require("../routes/maintenanceAlerts")(app);
  require("../routes/maintenance")(app);
  require("../routes/fuel")(app);
  require("../routes/hgs")(app);
  require("../routes/alerts")(app);
  require("../routes/documents")(app);
  require("../routes/notifications")(app);
  require("../routes/complianceAnalytics")(app);
  require("../routes/auditLogs")(app);
  require("../routes/auditDashboard")(app);
  require("../routes/auditAnalytics")(app);
  require("../routes/release")(app);
  require("../routes/production")(app);
  require("../routes/roadmap")(app);
  require("../routes/v11ReleaseCandidate")(app);
  require("../routes/v11Production")(app);
  require("../routes/vehicleIntelligence")(app);
  require("../routes/vehicleHealth")(app);
  require("../routes/vehicleTimeline")(app);
  require("../routes/vehicleProfitRisk")(app);
  require("../routes/executiveVehicleDashboard")(app);
  require("../routes/reconciliation")(app);
  require("../routes/subcontractors")(app);
  require("../routes/employees")(app);
  require("../routes/payroll")(app);
  require("../routes/cashflow")(app);
  require("../routes/reports")(app);
  require("../routes/profitability")(app);
  require("../routes/settings")(app, port);
  require("../routes/export")(app);

  return app;
}

function seedAuditVehicles(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO vehicles (id, plate, brand, model, year, type, km)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run(11, "16 AUD 11", "Mercedes", "Vito", "2020", "Turizm", 120000);
  insert.run(12, "16 AUD 12", "Mercedes", "Sprinter", "2019", "Servis", 145000);
}

function makeAuthCookie() {
  const authService = require("../services/authService");
  const { COOKIE_NAME } = require("../utils/session");
  const user = authService.authenticate("admin", "1234");
  assert(user, "admin test user must exist");
  return `${COOKIE_NAME}=${authService.createSessionToken(user)}`;
}

function scanArtifacts(html, context) {
  for (const { re, label } of ARTIFACT_PATTERNS) {
    assert(!re.test(html), `${context}: artifact ${label}`);
  }
  assert(!html.includes("Cannot find module"), `${context}: missing module in output`);
}

function auditVehicle360Structure(html, label) {
  V360_REQUIRED.forEach((cls) => assert(html.includes(cls), `${label}: missing ${cls}`));

  const headerEnd = html.indexOf("vehicle-action-intelligence--ticker");
  const headerSlice = headerEnd > 0 ? html.slice(0, headerEnd) : html.slice(0, 8000);
  assert(
    !headerSlice.includes('aria-label="Fleet Comparison Intelligence"'),
    `${label}: full comparison not above action ticker`
  );
  assert(
    !headerSlice.includes('aria-label="Executive Predictive Intelligence"'),
    `${label}: full predictive not above action ticker`
  );

  const accordionPos = html.indexOf("vehicle-detail-accordions");
  assert(accordionPos > 0, `${label}: accordions present`);
  const accordionBody = html.slice(accordionPos);
  assert(accordionBody.includes('aria-label="Fleet Comparison Intelligence"'), `${label}: comparison in accordion`);
  assert(accordionBody.includes('aria-label="Executive Predictive Intelligence"'), `${label}: predictive in accordion`);
  assert(accordionBody.includes("predictive-maintenance"), `${label}: predictive maintenance preserved`);
  assert(accordionBody.includes("Finansal Görünüm") || html.includes("Finansal Görünüm"), `${label}: financial accordion`);
  assert(html.includes("Operasyon Zaman Çizelgesi"), `${label}: timeline accordion`);

  assert(
    html.indexOf("vehicle-executive-cockpit") < html.indexOf("vehicle-executive-scoreboard"),
    `${label}: cockpit before scoreboard`
  );
  assert(
    html.indexOf("vehicle-executive-scoreboard") < html.indexOf("vehicle-action-intelligence--ticker"),
    `${label}: scoreboard before ticker`
  );
  assert(
    html.indexOf("executive-kpi-grid--grouped") < html.indexOf("vehicle-intelligence-ribbons"),
    `${label}: ribbons after KPI`
  );
}

async function request(baseUrl, pathname, cookie) {
  const headers = cookie ? { Cookie: cookie } : {};
  const res = await fetch(`${baseUrl}${pathname}`, { redirect: "manual", headers });
  const body = await res.text();
  return { status: res.status, body, location: res.headers.get("location") };
}

function auditNavTree() {
  const { NAV_TREE } = require("../lib/navConfig");
  const { renderNav } = require("../lib/components/layout");
  const html = renderNav("/", "/");

  NAV_LABELS.forEach((label) => assert(html.includes(label), `nav label: ${label}`));
  assert(NAV_TREE.some((n) => n.label === "Ana Ekran"), "Ana Ekran link");
  const fleet = NAV_TREE.find((n) => n.id === "fleet");
  assert(fleet, "Filo group");
  assert(fleet.items.some(([, l]) => l === "Araçlar"), "Araçlar in fleet");
}

function auditLoginPage() {
  const { renderExecutiveLoginPage } = require("../lib/components/loginPage");
  const authSrc = fs.readFileSync(path.join(__dirname, "..", "routes/auth.js"), "utf8");
  const html = renderExecutiveLoginPage({ next: "/" });

  assert(authSrc.includes('app.post("/login"'), "POST /login preserved");
  assert(authSrc.includes("authService.authenticate"), "auth flow preserved");
  assert(html.includes('name="username"'), "username field");
  assert(html.includes('name="password"'), "password field");
  assert(html.includes("loginPasswordToggle"), "password toggle");
  assert(html.includes("admin / 1234"), "credentials hint");
  assert(html.includes("/images/mistur-fleetos-logo.png"), "heritage logo");
  assert(html.includes("login-page--executive"), "executive login layout");
}

function auditCodebase(root) {
  const layoutVersion = require("../lib/layout-version");
  assert(layoutVersion === STB6F, `layout version: ${layoutVersion}`);

  const intelligenceDir = path.join(root, "lib/intelligence");
  fs.readdirSync(intelligenceDir).forEach((file) => {
    const src = fs.readFileSync(path.join(intelligenceDir, file), "utf8");
    assert(!src.match(/\bfetch\s*\(/), `${file}: no fetch calls`);
    assert(!src.match(/openai|anthropic|gpt|llm/i), `${file}: no AI references`);
  });

  execSync("node -c lib/components/vehicle360Center.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/fleetComparisonIntelligence.js", { cwd: root, stdio: "pipe" });
  execSync("node -c lib/intelligence/executivePredictiveFleetIntelligence.js", { cwd: root, stdio: "pipe" });
}

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");

assert(css.includes(".vehicle-intelligence-ribbons"), "STB-6F ribbons CSS");
assert(css.includes(".vehicle-360-center--information-architecture"), "STB-6F IA modifier CSS");

auditCodebase(root);
auditNavTree();
auditLoginPage();

const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb-final-",
  "test-stb-final-audit.js",
  CACHE_PATTERNS
);

const db = require("../lib/db");
seedAuditVehicles(db);

const authCookie = makeAuthCookie();
const app = buildTestApp(0);
const routeResults = [];

(async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const loginRes = await request(baseUrl, "/login");
    assert(loginRes.status === 200, "/login returns 200");
    assert(loginRes.body.includes("login-page--executive"), "/login executive layout");
    scanArtifacts(loginRes.body, "/login");

    const unauthDash = await request(baseUrl, "/");
    assert(
      unauthDash.status === 302 && unauthDash.location?.includes("/login"),
      "/ redirects to login when unauthenticated"
    );

    for (const route of ROUTE_AUDIT) {
      if (route.notAvailable) {
        const res = await request(baseUrl, route.path, authCookie);
        const unavailable =
          res.status === 404 || (res.status === 302 && !res.body.includes("sidebar"));
        routeResults.push({ ...route, status: res.status, ok: unavailable, note: "not available (expected)" });
        continue;
      }

      if (route.optional) {
        const id = route.path.match(/\d+/)?.[0];
        const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(Number(id));
        if (!row) {
          routeResults.push({ ...route, status: "skipped", ok: true, note: "vehicle not seeded" });
          continue;
        }
      }

      const res = await request(baseUrl, route.path, route.public ? null : authCookie);
      const ok =
        res.status === 200 ||
        (route.public && res.status === 200) ||
        (!route.public && res.status === 200);
      assert(ok, `${route.path} expected 200, got ${res.status}`);
      assert(res.body.length > 200, `${route.path} empty body`);
      scanArtifacts(res.body, route.path);

      if (!route.public && route.path !== "/login") {
        assert(res.body.includes("sidebar") || res.body.includes("app-shell"), `${route.path}: shell renders`);
      }

      routeResults.push({ ...route, status: res.status, ok: true });
    }

    const dash = await request(baseUrl, "/", authCookie);
    assert(dash.body.includes("sidebar"), "dashboard sidebar");
    assert(dash.body.includes("mistur-fleetos-logo") || dash.body.includes("FleetOS"), "dashboard logo");
    assert(dash.body.includes("executive-insights-panel") || dash.body.includes("Yönetici İçgörüleri"), "executive insights");
    assert(dash.body.includes("command-center") || dash.body.includes("cockpit"), "dashboard command area");
    assert(!dash.body.includes("overflow-x: scroll"), "dashboard no overflow style leak");

    for (const id of [11, 12]) {
      const row = db.prepare("SELECT id FROM vehicles WHERE id = ?").get(id);
      if (!row) continue;
      for (const p of [`/vehicle/${id}`, `/vehicles/${id}/360`]) {
        const res = await request(baseUrl, p, authCookie);
        assert(res.status === 200, `${p} renders`);
        auditVehicle360Structure(res.body, p);
        scanArtifacts(res.body, p);
      }
    }

    const vehicles = await request(baseUrl, "/vehicles", authCookie);
    assert(vehicles.body.includes("Araç") || vehicles.body.includes("Filo"), "/vehicles Turkish content");

    server.close();
    cleanupTestDatabase(tmpDir);

    console.log("✓ FleetOS STB Final Audit tests passed");
    console.log(`  layout: ${STB6F}`);
    console.log(`  routes audited: ${routeResults.filter((r) => r.ok).length}/${ROUTE_AUDIT.length}`);
    console.log(`  vehicle 360 STB-6F sections: ${V360_REQUIRED.length} verified`);
    console.log(`  nav labels: ${NAV_LABELS.length} verified`);
  } catch (err) {
    server.close();
    cleanupTestDatabase(tmpDir);
    throw err;
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
