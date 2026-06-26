const db = require("../lib/db");
const { VEHICLE_TARGET } = require("../lib/constants");
const { redirectWithFlash, redirectWithError } = require("../lib/flash");
const { getAllVehicleSummaries } = require("../lib/finance");
const { formatPlateDisplay } = require("../utils/plate");
const {
  createVehicleRecord,
  updateVehicleRecord,
} = require("../services/vehiclePlateService");
const {
  escapeHtml,
  fleetCardGrid,
  glassPanel,
  renderLayout,
  errorPage,
} = require("../lib/ui");
const { renderVehicleDetail } = require("./vehicle-detail");

function getVehicles() {
  return db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
}

function getVehicleKm(v) {
  const km = v.current_km ?? v.km;
  return km != null && km !== "" ? Math.max(0, Number(km) || 0) : 0;
}

function vehicleAddFormHtml() {
  return `<form method="POST" action="/vehicles" class="vehicle-add-form--fit" id="vehicleAddForm">
    <input name="plate" placeholder="Plaka" required autocomplete="off" />
    <input name="brand" placeholder="Marka" />
    <input name="model" placeholder="Model" />
    <input name="year" placeholder="Yıl" />
    <input name="km" type="number" placeholder="KM" min="0" />
    <select name="type" required><option value="Servis">Servis</option><option value="Turizm">Turizm</option></select>
    <button class="btn btn--primary btn--sm" type="submit">Kaydet</button>
  </form>`;
}

function handleVehicleAdd(req, res) {
  const { plate, brand, model, year, km, type } = req.body || {};
  if (!plate?.trim()) {
    return redirectWithError(res, "/vehicles", "Plaka gerekli.");
  }
  try {
    createVehicleRecord({ plate, brand, model, year, km, type });
    return redirectWithFlash(res, "/vehicles", "vehicle_added");
  } catch (e) {
    console.error("Araç ekleme:", e.message);
    return redirectWithError(res, "/vehicles", e.message || "Araç eklenemedi.");
  }
}

function registerVehicles(app) {
  app.get("/vehicles", (req, res) => {
    const summaries = getAllVehicleSummaries();
    const vehicles = getVehicles();

    const addOpen = req.query.add === "1" ? " open" : "";

    const content = `
      <div class="dash page-enter dash--dense dash--vehicles dash--vehicles-fit">
        <div class="vehicles-fit-bar fade-in">
          <p class="page-lead">Filo · <strong>${vehicles.length}</strong> / ${VEHICLE_TARGET} araç</p>
          <details class="vehicles-add-details" id="vehicleAddPanel"${addOpen}>
            <summary class="vehicles-add-details__summary">
              <span class="vehicles-add-details__label">+ Yeni Araç Ekle</span>
            </summary>
            <div class="vehicles-add-details__body">
              ${vehicleAddFormHtml()}
            </div>
          </details>
        </div>
        <section class="vehicles-fleet-section fade-in" style="--delay:40ms">
          ${fleetCardGrid(summaries, { fit: true })}
        </section>
      </div>`;

    renderLayout(res, "Araçlar", content, "/vehicles", req, {
      pageTitle: "Araçlar",
      breadcrumb: "Filo / Premium Kart Görünümü",
    });
  });

  app.post("/vehicles", handleVehicleAdd);
  app.post("/vehicle/add", handleVehicleAdd);

  app.get("/vehicle/add", (_req, res) => {
    res.redirect("/vehicles");
  });

  app.get("/vehicle/edit/:id", (req, res) => {
    const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
    if (!v) return res.status(404).send(errorPage("Araç bulunamadı", "Bu araç silinmiş veya mevcut değil."));

    const content = `
      <div class="dash page-enter">
        <p class="page-lead">${escapeHtml(formatPlateDisplay(v.plate) || v.plate)} düzenleniyor</p>
        ${glassPanel({
          title: "Araç bilgileri",
          body: `<form method="POST" action="/vehicle/edit/${v.id}" class="form-grid form-panel--narrow">
            <input name="plate" value="${escapeHtml(formatPlateDisplay(v.plate) || v.plate)}" required />
            <input name="brand" value="${escapeHtml(v.brand || "")}" placeholder="Marka" />
            <input name="model" value="${escapeHtml(v.model || "")}" placeholder="Model" />
            <input name="year" value="${escapeHtml(v.year || "")}" placeholder="Yıl" />
            <input name="km" type="number" value="${getVehicleKm(v)}" placeholder="Güncel KM" min="0" />
            <select name="type">
              <option value="Servis" ${v.type === "Servis" ? "selected" : ""}>Servis</option>
              <option value="Turizm" ${v.type === "Turizm" ? "selected" : ""}>Turizm</option>
            </select>
            <button class="btn btn--primary" type="submit">Kaydet</button>
            <a class="btn btn--ghost" href="/vehicles">İptal</a>
          </form>`,
        })}
      </div>`;

    renderLayout(res, "Araç Düzenle", content, "/vehicles", req, {
      pageTitle: "Araç Düzenle",
      breadcrumb: "Filo / Düzenle",
    });
  });

  app.post("/vehicle/edit/:id", (req, res) => {
    const { plate, brand, model, year, km, type } = req.body || {};
    if (!plate?.trim()) {
      return redirectWithError(res, `/vehicle/edit/${req.params.id}`, "Plaka gerekli.");
    }
    try {
      updateVehicleRecord(req.params.id, { plate, brand, model, year, km, type });
      return redirectWithFlash(res, "/vehicles", "vehicle_updated");
    } catch (e) {
      console.error("Araç güncelleme:", e.message);
      return redirectWithError(res, `/vehicle/edit/${req.params.id}`, e.message || "Güncellenemedi.");
    }
  });

  app.get("/vehicle/delete/:id", (req, res) => {
    const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
    if (v) {
      const auditService = require("../services/auditService");
      auditService.log("vehicle_delete", "vehicle", v.id, v, null, "Araç silindi");
    }
    redirectWithFlash(res, "/vehicles", "vehicle_deleted");
  });

  app.get("/vehicle/:id", (req, res) => renderVehicleDetail(req, res));

  app.get("/vehicles/:id/360", (req, res) => renderVehicleDetail(req, res));
}

module.exports = { registerVehicles, getVehicles };
