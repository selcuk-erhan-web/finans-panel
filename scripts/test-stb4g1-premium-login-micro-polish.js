/**
 * FLEETOS STB-4G.1 — Premium login micro polish
 * node scripts/test-stb4g1-premium-login-micro-polish.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const {
  renderExecutiveLoginPage,
  LOGIN_FLEET_SHOWCASE,
} = require("../lib/components/loginPage");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const auth = fs.readFileSync(path.join(root, "routes/auth.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const loginPage = fs.readFileSync(path.join(root, "lib/components/loginPage.js"), "utf8");

assert(
  LAYOUT_VERSION === "fleetos-stb5g-predictive-maintenance-intelligence-01",
  `layout version: ${LAYOUT_VERSION}`
);

assert(loginPage.includes("/images/mistur-fleetos-logo.png"), "heritage logo asset path preserved");
assert(css.includes("max-width: 368px"), "logo hero size increased");
assert(css.includes("max-height: 172px"), "logo hero height increased");
assert(css.includes("object-fit: contain"), "logo aspect ratio preserved");
assert(loginPage.includes("login-hero__slogan"), "premium slogan under logo");
assert(loginPage.includes("Executive Fleet Management Platform"), "slogan text present");

assert(loginPage.includes("login-hero__showcase"), "fleet vehicle showcase block");
assert(loginPage.includes("Mistur filosundan seçili araç görünümü"), "showcase label");
assert(loginPage.includes("/images/vehicles/vito-clean.png"), "vito showcase asset");
assert(loginPage.includes("/images/vehicles/bus-clean.png"), "bus showcase asset");
assert(loginPage.includes("/images/vehicles/sprinter-clean.png"), "sprinter showcase asset");
assert(loginPage.includes("login-hero__showcase-fallback"), "showcase graceful fallback");

LOGIN_FLEET_SHOWCASE.forEach((item) => {
  assert(item.plate && item.src, `showcase item: ${item.plate}`);
});

assert(css.includes(".login-form__submit--premium"), "premium login button class");
assert(css.includes("linear-gradient(135deg, #7c3aed, #4f46e5)"), "button gradient");
assert(css.includes("translateY(-2px)"), "button hover lift");
assert(css.includes("0 14px 30px rgba(124, 58, 237, 0.35)"), "button hover glow");

assert(auth.includes("authService.authenticate"), "authenticate unchanged");
assert(auth.includes('app.get("/login"'), "GET /login preserved");
assert(auth.includes('app.get("/logout"'), "GET /logout preserved");
assert(auth.includes('app.post("/login"'), "POST /login preserved");
assert(loginPage.includes("admin / 1234"), "default credentials hint preserved");

const html = renderExecutiveLoginPage({ next: "/" });
assert(html.includes("login-hero__brand"), "logo hero brand block");
assert(html.includes("login-form__submit--premium"), "premium submit button in output");

execSync("node -c lib/components/loginPage.js", { cwd: root, stdio: "pipe" });
execSync("node -c routes/auth.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4G.1 premium login micro polish tests passed");
