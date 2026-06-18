const vehicleCenterService = require("../services/vehicleCenterService");
const { vehicleCenterPageHtml } = require("../lib/components/vehicleCenter");
const { renderLayout, errorPage } = require("../lib/ui");

function renderVehicleDetail(req, res) {
  try {
    const bundle = vehicleCenterService.getVehicleCenterBundle(req.params.id);
    if (!bundle) return res.status(404).send(errorPage("Araç bulunamadı", "Kayıt bulunamadı."));

    const { vehicle } = bundle;
    const content = vehicleCenterPageHtml(bundle);

    renderLayout(res, vehicle.plate, content, "/vehicles", req, {
      pageTitle: vehicle.plate,
      breadcrumb: `Filo / ${vehicle.plate} · Araç Merkezi`,
    });
  } catch (err) {
    console.error("vehicle center:", err);
    res.status(500).send(errorPage("Hata", "Araç merkezi yüklenirken bir sorun oluştu."));
  }
}

module.exports = { renderVehicleDetail };
