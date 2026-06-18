/**
 * Fuel import reachability + HGS PDF click target (rendered HTML smoke tests)
 * node scripts/test-import-ux.js
 */
const fs = require("fs");
const path = require("path");
const { prepareIsolatedTestDatabase, cleanupTestDatabase } = require("./lib/testDbIsolation");

const { tmpDir } = prepareIsolatedTestDatabase("fleetos-import-ux-", "test-import-ux.js");

const { hgsImportFormHtml } = require("../lib/components/hgsImport");
const { fuelImportDualFormHtml } = require("../lib/components/fuelImport");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const hgs = hgsImportFormHtml();
  assert(hgs.includes('id="hgsPdfFileInput"'), "HGS file input id missing");
  assert(hgs.includes('type="file"'), "HGS type=file missing");
  assert(hgs.includes('for="hgsPdfFileInput"'), "HGS label for= association missing");
  assert(hgs.includes("hgs-upload-dropzone"), "HGS dropzone class missing");
  assert(hgs.includes('accept=".pdf,application/pdf"'), "HGS PDF accept missing");
  assert(!/\bdisabled\b/i.test(hgs), "HGS file input must not be disabled");

  const fuelImport = fuelImportDualFormHtml({ compact: true });
  assert(fuelImport.includes("fuel-dropzone"), "fuel dropzone missing");
  assert(fuelImport.includes('name="detailFile"'), "detail Excel input missing");
  assert(fuelImport.includes('name="controlFile"'), "control Excel input missing");
  assert(fuelImport.includes("Detay Excel"), "detail Excel label missing");
  assert(fuelImport.includes("Kontrol / Mutabakat"), "control Excel label missing");
  assert(fuelImport.includes('type="submit"'), "import submit button missing");
  assert(fuelImport.includes("İçe Aktar"), "import button text missing");
  assert(!/\bdisabled\b/i.test(fuelImport), "fuel file inputs must not be disabled");

  const fuelRoute = fs.readFileSync(path.join(__dirname, "../routes/fuel.js"), "utf8");
  assert(fuelRoute.includes('id="fuelForm"'), "manual fuel form missing");
  assert(fuelRoute.includes('id="fuelExcelImportCard"'), "fuel import section id missing");
  assert(fuelRoute.includes("fuel-hub-cockpit"), "fuel cockpit layout missing");
  assert(fuelRoute.includes("fuel-hub--compact"), "fuel compact layout class missing");
  assert(fuelRoute.includes("fuel-hub-lower"), "fuel lower section missing");
  assert(fuelRoute.includes("Filtre ve dışa aktar"), "filter/export section missing");
  assert(fuelRoute.includes("Yakıt listesi"), "fuel list section missing");
  assert(fuelRoute.includes("fuelImportDualFormHtml({ compact: true })"), "compact import form missing");
  assert(!fuelRoute.includes("fuel-import-details"), "collapsible import should be removed");

  const hgsRoute = fs.readFileSync(path.join(__dirname, "../routes/hgs.js"), "utf8");
  assert(hgsRoute.includes('id="hgsPdfImportCard"'), "HGS import card id missing");
  assert(hgsRoute.includes("hgs-hub"), "hgs-hub class missing");
  assert(hgsRoute.includes("hgsImportFormHtml"), "HGS import form hook missing");

  const vehiclesRoute = fs.readFileSync(path.join(__dirname, "../routes/vehicles.js"), "utf8");
  assert(vehiclesRoute.includes("dash--vehicles-fit"), "vehicles fit layout missing");
  assert(vehiclesRoute.includes("fleetCardGrid(summaries, { fit: true })"), "fit fleet grid missing");
  assert(vehiclesRoute.includes("vehicles-add-details"), "collapsible vehicle add form missing");

  const fleetJs = fs.readFileSync(path.join(__dirname, "../lib/components/fleet.js"), "utf8");
  assert(fleetJs.includes("fleet-card--fit"), "fit fleet card missing");
  assert(fleetJs.includes('href="/vehicle/'), "vehicle center links missing");
  assert(fleetJs.includes("Araç Merkezi"), "Araç Merkezi CTA missing");

  const css = fs.readFileSync(path.join(__dirname, "../public/css/main.css"), "utf8");
  assert(css.includes(".fuel-hub--compact"), "fuel compact CSS missing");
  assert(css.includes(".fuel-hub-cockpit"), "fuel cockpit CSS missing");
  assert(css.includes(".hgs-upload-dropzone"), "HGS dropzone CSS missing");
  assert(css.includes(".fuel-dropzone--compact"), "compact fuel dropzone CSS missing");
  assert(css.includes(".dash--vehicles-fit"), "vehicles fit CSS missing");
  assert(css.includes(".fleet-card-grid--fit"), "3x3 fleet grid CSS missing");

  console.log("✓ import UX HTML/CSS smoke tests passed");
  cleanupTestDatabase(tmpDir);
}

main();
