/**
 * FLEETOS STB-4F — Executive login experience
 * node scripts/test-stb4f-executive-login-experience.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");
const { renderExecutiveLoginPage } = require("../lib/components/loginPage");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const auth = fs.readFileSync(path.join(root, "routes/auth.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const loginPage = fs.readFileSync(path.join(root, "lib/components/loginPage.js"), "utf8");

assert(LAYOUT_VERSION === "fleetos-stb5a-vehicle-360-center-01", `layout version: ${LAYOUT_VERSION}`);

assert(auth.includes("renderExecutiveLoginPage"), "auth uses executive login renderer");
assert(auth.includes("authService.authenticate"), "authenticate flow preserved");
assert(!auth.includes('<div class="sidebar__logo">M</div>'), "old purple M login brand removed");
assert(loginPage.includes('method="POST" action="/login"'), "POST login form preserved");
assert(auth.includes('app.post("/login"'), "POST login route preserved");

assert(loginPage.includes("/images/mistur-fleetos-logo.png"), "heritage logo on login hero");
assert(loginPage.includes("Executive Fleet Management Platform"), "hero slogan present");
assert(loginPage.includes("Gelir & Gider Takibi"), "feature card 1");
assert(loginPage.includes("Bakım Yönetimi"), "feature card 2");
assert(loginPage.includes("Uygunluk & Risk Kontrolü"), "feature card 3");
assert(loginPage.includes("Operasyonel İzleme"), "feature card 4");
assert(loginPage.includes("Sisteme Giriş Yapın"), "login card title");
assert(loginPage.includes('name="username"'), "username field preserved");
assert(loginPage.includes('name="password"'), "password field preserved");
assert(loginPage.includes('name="next"'), "next hidden field preserved");
assert(loginPage.includes("loginPasswordToggle"), "password show/hide toggle");
assert(loginPage.includes("Beni Hatırla"), "remember option");
assert(loginPage.includes("Şifremi Unuttum"), "forgot password link");
assert(loginPage.includes("Güvenli Bağlantı"), "secure connection block");
assert(loginPage.includes("v1.0.0"), "version footer");
assert(loginPage.includes("© Mistur FleetOS"), "copyright footer");
assert(loginPage.includes("admin / 1234"), "default credentials hint preserved");

assert(css.includes(".login-page--executive"), "executive login page styles");
assert(css.includes(".login-hero"), "login hero panel styles");
assert(css.includes(".login-panel"), "login form panel styles");
assert(css.includes("flex: 0 0 40%"), "40% hero split");

const html = renderExecutiveLoginPage({ next: "/", err: "" });
assert(html.includes("login-shell"), "split shell markup");
assert(html.includes("login-hero"), "left hero panel");
assert(html.includes("login-card--executive"), "executive login card");

const errHtml = renderExecutiveLoginPage({ err: "Hatalı kullanıcı adı veya şifre" });
assert(errHtml.includes("login-error"), "error state renders");

execSync("node -c routes/auth.js", { cwd: root, stdio: "pipe" });
execSync("node -c lib/components/loginPage.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4F executive login experience tests passed");
