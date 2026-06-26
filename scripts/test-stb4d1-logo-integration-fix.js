/**
 * FLEETOS STB-4D.1 — Logo integration fix
 * node scripts/test-stb4d1-logo-integration-fix.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const LAYOUT_VERSION = require("../lib/layout-version");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const layout = fs.readFileSync(path.join(root, "lib/components/layout.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/main.css"), "utf8");
const pngPath = path.join(root, "public/images/mistur-fleetos-logo-cropped.png");
const originalPngPath = path.join(root, "public/images/mistur-fleetos-logo.png");
const svgPath = path.join(root, "public/images/mistur-fleetos-logo.svg");

assert(LAYOUT_VERSION === "fleetos-stb4g1-premium-login-micro-polish-01", `layout version: ${LAYOUT_VERSION}`);

assert(fs.existsSync(pngPath), "heritage logo PNG asset exists");
const pngHeader = fs.readFileSync(pngPath).subarray(0, 8).toString("latin1");
assert(pngHeader.startsWith("\x89PNG"), "logo asset is a PNG file");

assert(!fs.existsSync(svgPath), "generated SVG logo removed");

assert(fs.existsSync(originalPngPath), "original heritage logo PNG exists");
assert(layout.includes('/images/mistur-fleetos-logo-cropped.png'), "layout references cropped PNG logo");
assert(!layout.includes('/images/mistur-fleetos-logo.png'), "layout no longer references uncropped PNG");
assert(!layout.includes("mistur-fleetos-logo.svg"), "layout does not reference SVG logo");
assert(layout.includes('alt="MISTUR FleetOS"'), "logo alt text present");
assert(layout.includes("sidebar__brand-logo"), "sidebar brand logo class present");
assert(!layout.includes('<div class="sidebar__logo"'), "purple M placeholder not in sidebar brand");
assert(!layout.includes("sidebar__brand-text"), "duplicate brand text block removed");

assert(css.includes(".sidebar__brand"), "sidebar brand styles present");
assert(css.includes("max-width: 260px"), "logo max width for readability");
assert(css.includes("max-height: 145px"), "logo max height for readability");
assert(css.includes("min-height: 165px"), "sidebar brand min-height");
assert(!layout.includes("sidebar__brand-card"), "brand card class removed");
assert(css.includes("object-fit: contain"), "logo aspect ratio preserved");

execSync("node -c lib/components/layout.js", { cwd: root, stdio: "pipe" });

console.log("✓ FleetOS STB-4D.1 logo integration fix tests passed");
