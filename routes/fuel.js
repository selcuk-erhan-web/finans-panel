const express = require("express");
const multer = require("multer");
const fuelService = require("../services/fuelService");
const fuelImportService = require("../services/fuelImportService");
const { fuelImportResultHtml, fuelImportDualFormHtml, unmatchedPlatesPanelHtml, fuelUnmatchedScript } = require("../lib/components/fuelImport");
const { redirectWithFlash } = require("../lib/flash");
const { getVehicles } = require("./vehicles");
const { money } = require("../lib/finance");
const {
  renderLayout,
  glassPanel,
  vehicleOptions,
  escapeHtml,
  dataTable,
  buildQueryString,
} = require("../lib/components");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Sadece .xlsx veya .xls dosyaları yüklenebilir."));
  },
});

function wantsJson(req) {
  return (
    req.xhr ||
    req.get("X-Requested-With") === "XMLHttpRequest" ||
    (req.get("Accept") || "").includes("application/json")
  );
}

function jsonImportResponse(res, result, status = 200) {
  res.status(status).json({
    ok: status < 400,
    result,
    resultHtml: fuelImportResultHtml(result),
  });
}

function registerFuel(app) {
  app.get("/fuel", (req, res) => {
    const vehicles = getVehicles();
    const query = {
      vehicle_id: req.query.vehicle_id || "",
      date_from: req.query.date_from || "",
      date_to: req.query.date_to || "",
      unmatched: req.query.unmatched || "",
    };
    const rows = fuelService.listAll(query);
    const analytics = fuelService.getFuelPageAnalytics();

    const tableRows = rows.map((f) => {
      const plate = f.display_plate || f.plate || f.plate_text || "—";
      const plateCell = f.vehicle_id
        ? `<a class="plate-link" href="/vehicle/${f.vehicle_id}">${escapeHtml(plate)}</a>`
        : escapeHtml(plate);
      return `<tr>
        <td>${plateCell}</td>
        <td>${Number(f.liter).toLocaleString("tr-TR")} L</td>
        <td>${f.price_per_liter ? Number(f.price_per_liter).toLocaleString("tr-TR") + " ₺" : "—"}</td>
        <td class="text-neg"><strong>${money(f.total_amount)}</strong></td>
        <td>${f.km != null ? Number(f.km).toLocaleString("tr-TR") : "—"}</td>
        <td>${escapeHtml(f.station || "—")}</td>
        <td>${escapeHtml(f.fuel_date || "")}</td>
        <td class="data-table__actions">
          <a href="/fuel/edit/${f.id}" class="btn btn--sm btn--ghost">Düzenle</a>
          <a href="/fuel/delete/${f.id}" class="btn btn--sm btn--danger" onclick="return confirm('Silinsin mi?')">Sil</a>
        </td>
      </tr>`;
    });

    const filtersForm = `<form class="filters filters--fuel" method="GET" action="/fuel">
      <select name="vehicle_id">
        <option value="">Tüm araçlar</option>
        ${vehicles
          .map(
            (v) =>
              `<option value="${v.id}" ${String(query.vehicle_id) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
          )
          .join("")}
      </select>
      <input type="date" name="date_from" value="${escapeHtml(query.date_from)}"/>
      <input type="date" name="date_to" value="${escapeHtml(query.date_to)}"/>
      <button type="submit" class="btn btn--primary btn--sm">Filtrele</button>
      <a href="/fuel" class="btn btn--ghost btn--sm">Temizle</a>
    </form>`;

    const exportCsvUrl = buildQueryString("/fuel/export/csv", query);
    const exportXlsxUrl = buildQueryString("/export/fuel/xlsx", query);
    const today = new Date().toISOString().slice(0, 10);

    let importResultBlock = "";
    if (req.query.import_batch) {
      const batch = fuelImportService.getBatchSummary(Number(req.query.import_batch));
      const result = fuelImportService.batchToResult(batch);
      if (result) {
        importResultBlock = `<section class="fuel-import-result">${fuelImportResultHtml(result, vehicles)}</section>`;
      }
    }

    const allUnmatched = fuelImportService.getAllUnmatchedPlates();
    const showGlobalUnmatched =
      allUnmatched.length > 0 && !req.query.import_batch && query.unmatched !== "1";
    const globalUnmatchedBlock = showGlobalUnmatched
      ? unmatchedPlatesPanelHtml(allUnmatched, vehicles, null, "Eşleşmeyen plakalar")
      : "";

    const content = `
      <div class="dash page-enter">
        <p class="page-lead">Yakıt yönetimi · ${rows.length} kayıt</p>
        ${importResultBlock}
        ${globalUnmatchedBlock}

        <div class="grid2">
          <div class="fuel-col-stack">
            <section class="fuel-import-card" id="fuelExcelImportCard">
              <div class="fuel-import-header">
                <div>
                  <p class="eyebrow">UTTS / Arkpet / Shell</p>
                  <h2>Yakıt Excel İçe Aktar</h2>
                  <p>Dokum detay dosyasından yakıt kayıtları oluşturulur. İsteğe bağlı Yakıt Alım Raporu ile mutabakat yapılır.</p>
                </div>
              </div>
              ${fuelImportDualFormHtml()}
            </section>

          ${glassPanel({
            title: "Yakıt ekle",
            body: `<form method="POST" action="/fuel/add" class="form-grid" id="fuelForm">
              <select name="vehicle_id" required>${vehicleOptions(vehicles, query.vehicle_id)}</select>
              <input name="liter" type="number" step="0.01" min="0.1" placeholder="Litre" required />
              <input name="price_per_liter" type="number" step="0.01" min="0" placeholder="₺/Litre" id="fuelPrice"/>
              <input name="total_amount" type="number" min="1" placeholder="Toplam TL" id="fuelTotal"/>
              <input name="km" type="number" min="0" placeholder="KM"/>
              <input name="station" placeholder="İstasyon"/>
              <input type="date" name="fuel_date" value="${today}" required/>
              <input class="full" name="note" placeholder="Not"/>
              <button type="submit" class="btn btn--primary full">Kaydet</button>
            </form>`,
          })}
          </div>
          ${glassPanel({
            title: "Filtre",
            body: `${filtersForm}
              <div class="fuel-export-actions">
                <a href="${exportCsvUrl}" class="btn btn--ghost btn--sm">CSV indir</a>
                <a href="${exportXlsxUrl}" class="btn btn--ghost btn--sm">Excel indir</a>
              </div>`,
          })}
        </div>
        ${glassPanel({
          title: "Yakıt listesi",
          action: analytics.unmatchedCount
            ? `<a href="/fuel?unmatched=1" class="btn btn--ghost btn--sm">${analytics.unmatchedCount} eşleşmeyen</a>`
            : "",
          body: dataTable(
            ["Araç", "Litre", "₺/L", "Toplam", "KM", "İstasyon", "Tarih", ""],
            tableRows,
            { text: "Henüz yakıt kaydı yok." }
          ),
        })}
      </div>
      <script>
        (function(){
          var L=document.querySelector('#fuelForm [name=liter]');
          var P=document.getElementById('fuelPrice');
          var T=document.getElementById('fuelTotal');
          function calc(){ if(L&&P&&T&&L.value&&P.value) T.value=Math.round(Number(L.value)*Number(P.value)); }
          L&&L.addEventListener('input',calc); P&&P.addEventListener('input',calc);
        })();
      </script>
      ${fuelUnmatchedScript()}`;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    renderLayout(res, "Yakıt", content, "/fuel", req, {
      pageTitle: "Yakıt Yönetimi",
      breadcrumb: "Operasyon / Yakıt",
    });
  });

  app.post("/fuel/import", (req, res) => {
    upload.fields([
      { name: "detailFile", maxCount: 1 },
      { name: "controlFile", maxCount: 1 },
      { name: "excelFile", maxCount: 1 },
    ])(req, res, (uploadErr) => {
      const sendError = (message, status = 400) => {
        if (wantsJson(req)) {
          return res.status(status).json({ ok: false, message });
        }
        const msg = encodeURIComponent(message);
        return res.redirect(`/fuel?err=import&msg=${msg}`);
      };

      if (uploadErr) return sendError(uploadErr.message || "Dosya yüklenemedi.");

      try {
        const detailFile = req.files?.detailFile?.[0] || req.files?.excelFile?.[0];
        const controlFile = req.files?.controlFile?.[0];

        if (!detailFile || !detailFile.buffer?.length) {
          return sendError("Detay Excel (Dokum) dosyası seçilmedi veya okunamadı.");
        }

        const result = fuelImportService.importFromBuffers({
          detailBuffer: detailFile.buffer,
          detailName: detailFile.originalname,
          controlBuffer: controlFile?.buffer,
          controlName: controlFile?.originalname || "",
          autoCreateVehicle: !!req.body.auto_create_vehicle,
          syncExpense: req.body.sync_expense !== "0" && req.body.sync_expense !== "off",
        });

        if (wantsJson(req)) {
          return jsonImportResponse(res, result);
        }
        res.redirect(`/fuel?import_batch=${result.batchId}&ok=fuel_imported`);
      } catch (e) {
        console.error("Yakıt import:", e);
        return sendError(e.message || "Excel işlenemedi.", 500);
      }
    });
  });

  app.get("/fuel/import/summary/:id", (req, res) => {
    const batch = fuelImportService.getBatchSummary(req.params.id);
    const result = fuelImportService.batchToResult(batch);
    if (!result) {
      return wantsJson(req)
        ? res.status(404).json({ ok: false, message: "Batch bulunamadı" })
        : res.status(404).send("Bulunamadı");
    }
    if (wantsJson(req)) return jsonImportResponse(res, result);
    res.redirect(`/fuel?import_batch=${result.batchId}`);
  });

  app.post("/fuel/import/link-vehicle", express.json({ limit: "64kb" }), (req, res) => {
    try {
      const plate = req.body?.plate;
      const vehicleId = req.body?.vehicle_id;
      const batchId = req.body?.batch_id ? Number(req.body.batch_id) : null;
      const out = fuelImportService.linkPlateToVehicle(plate, vehicleId, batchId);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message || "Bağlama başarısız" });
    }
  });

  app.post("/fuel/import/create-vehicle", express.json({ limit: "64kb" }), (req, res) => {
    try {
      const plate = req.body?.plate;
      const batchId = req.body?.batch_id ? Number(req.body.batch_id) : null;
      const out = fuelImportService.createVehicleAndLinkPlate(plate, batchId);
      res.json({
        ok: true,
        vehicleId: out.vehicleId,
        linked: out.linked,
        expensesCreated: out.expensesCreated,
      });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message || "İşlem başarısız" });
    }
  });

  app.get("/fuel/import/result/:id", (req, res) => {
    const batch = fuelImportService.getBatchSummary(req.params.id);
    if (!batch) return res.status(404).send("İçe aktarma bulunamadı");
    return res.redirect(`/fuel?import_batch=${batch.id}&ok=fuel_imported`);
  });

  app.get("/fuel/export/csv", (req, res) => {
    const filters = {
      vehicle_id: req.query.vehicle_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      unmatched: req.query.unmatched,
    };
    const csv = fuelService.exportCsv(filters);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="yakit-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  });

  app.post("/fuel/add", (req, res) => {
    fuelService.create(req.body);
    const back = req.body.vehicle_id ? `/vehicle/${req.body.vehicle_id}` : "/fuel";
    redirectWithFlash(res, back, "fuel_added");
  });

  app.get("/fuel/delete/:id", (req, res) => {
    const f = fuelService.getById(req.params.id);
    fuelService.remove(req.params.id);
    redirectWithFlash(res, f?.vehicle_id ? `/vehicle/${f.vehicle_id}` : "/fuel", "fuel_deleted");
  });

  app.get("/fuel/edit/:id", (req, res) => {
    const f = fuelService.getById(req.params.id);
    if (!f) return res.status(404).send("Kayıt yok");
    const vehicles = getVehicles();
    const content = `
      <div class="dash page-enter">
        ${glassPanel({
          title: "Yakıt düzenle",
          body: `<form method="POST" action="/fuel/edit/${f.id}" class="form-grid" style="max-width:520px">
            <select name="vehicle_id">${vehicleOptions(vehicles, f.vehicle_id)}<option value="">— Eşleşmedi —</option></select>
            <input name="liter" type="number" step="0.01" value="${f.liter}" required/>
            <input name="price_per_liter" type="number" step="0.01" value="${f.price_per_liter || ""}"/>
            <input name="total_amount" type="number" value="${f.total_amount}" required/>
            <input name="km" type="number" value="${f.km ?? ""}"/>
            <input name="station" value="${escapeHtml(f.station || "")}"/>
            <input type="date" name="fuel_date" value="${escapeHtml(f.fuel_date || "")}"/>
            <input name="note" value="${escapeHtml(f.note || "")}"/>
            <button type="submit" class="btn btn--primary">Kaydet</button>
            <a href="/fuel" class="btn btn--ghost">İptal</a>
          </form>`,
        })}
      </div>`;
    renderLayout(res, "Yakıt Düzenle", content, "/fuel", req);
  });

  app.post("/fuel/edit/:id", (req, res) => {
    const data = { ...req.body };
    if (!data.vehicle_id) data.vehicle_id = null;
    fuelService.update(req.params.id, data);
    redirectWithFlash(res, "/fuel", "fuel_updated");
  });
}

module.exports = registerFuel;
