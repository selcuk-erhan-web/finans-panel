/**
 * FLEETOS STB-5A — Vehicle 360 route / lookup debug
 * node scripts/test-stb5a-vehicle-360-route-debug.js
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const {
  prepareIsolatedTestDatabase,
  cleanupTestDatabase,
} = require("./lib/testDbIsolation");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = path.join(__dirname, "..");
const { tmpDir } = prepareIsolatedTestDatabase(
  "fleetos-stb5a-route-",
  "test-stb5a-vehicle-360-route-debug.js"
);

const db = require("../lib/db");
const {
  getVehicleCenterBundle,
  resolveVehicleRouteParam,
} = require("../services/vehicleCenterService");
const { getAllVehicleSummaries } = require("../lib/finance");
const { vehicleDetailPath } = require("../lib/vehicleRoute");
const { fleetCardFit } = require("../lib/components/fleet");
const { renderVehicleDetail } = require("../routes/vehicle-detail");

const ins = db
  .prepare("INSERT INTO vehicles (plate, brand, model, year, type, km) VALUES (?, ?, ?, ?, ?, ?)")
  .run("16 RT 360", "Mercedes", "Vito", "2022", "Servis", 42000);
const vehicleId = ins.lastInsertRowid;

assert(resolveVehicleRouteParam(String(vehicleId))?.id === vehicleId, "numeric id resolves");
assert(resolveVehicleRouteParam("16 RT 360")?.id === vehicleId, "plate param resolves");
assert(resolveVehicleRouteParam(999999) === null, "missing vehicle returns null");
assert(getVehicleCenterBundle(vehicleId), "bundle by id");
assert(getVehicleCenterBundle("16 RT 360"), "bundle by plate");

const summaries = getAllVehicleSummaries();
assert(summaries.length > 0, "summaries available");
const first = summaries[0];
const firstPath = vehicleDetailPath(first);
assert(firstPath === `/vehicle/${first.id}`, `fleet path uses vehicles.id: ${firstPath}`);
assert(fleetCardFit(first).includes(`href="${firstPath}"`), "fleet card href matches resolver");

const app = express();
app.get("/vehicle/:id", (req, res) => renderVehicleDetail(req, res));
app.get("/vehicles/:id/360", (req, res) => renderVehicleDetail(req, res));

async function request(pathname) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://127.0.0.1:${port}${pathname}`)
        .then(async (res) => {
          const body = await res.text();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

(async () => {
  const byId = await request(`/vehicle/${first.id}`);
  assert(byId.status === 200, `/vehicle/:id status ${byId.status}`);
  assert(byId.body.includes("vehicle-360-center"), "/vehicle/:id renders Vehicle 360");
  assert(!byId.body.includes("Kayıt bulunamadı"), "/vehicle/:id not 404");

  const byAlias = await request(`/vehicles/${first.id}/360`);
  assert(byAlias.status === 200, `/vehicles/:id/360 status ${byAlias.status}`);
  assert(byAlias.body.includes("vehicle-360-center"), "/vehicles/:id/360 renders Vehicle 360");

  const missing = await request("/vehicle/999999");
  assert(missing.status === 404, "missing vehicle 404");
  assert(missing.body.includes("Araç bulunamadı"), "missing vehicle message");

  cleanupTestDatabase(tmpDir);
  console.log("✓ FleetOS STB-5A vehicle 360 route debug tests passed");
})().catch((err) => {
  cleanupTestDatabase(tmpDir);
  console.error(err);
  process.exit(1);
});
