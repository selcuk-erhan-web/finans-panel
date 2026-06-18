const maintenanceService = require("../services/maintenanceService");
const { MAINTENANCE_TYPES } = require("../lib/constants");
const { redirectWithFlash } = require("../lib/flash");
const { moneyInputHtml, formatMoneyInputValue } = require("../utils/money");
const { getVehicles } = require("./vehicles");
const {
  renderLayout,
  glassPanel,
  vehicleOptions,
  escapeHtml,
  dataTable,
} = require("../lib/ui");

function typeOptions(selected = "") {
  return MAINTENANCE_TYPES.map(
    ([k, label]) =>
      `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function statusBadge(status) {
  const map = {
    done: '<span class="pill pill--green">Tamamlandı</span>',
    overdue: '<span class="pill pill--red">Gecikmiş</span>',
    upcoming: '<span class="pill pill--amber">Yaklaşıyor</span>',
    pending: '<span class="pill pill--muted">Planlı</span>',
  };
  return map[status] || map.pending;
}

function registerMaintenance(app) {
  app.get("/maintenance", (req, res) => {
    const vehicles = getVehicles();
    const filters = { vehicle_id: req.query.vehicle_id, type: req.query.type };
    const rows = maintenanceService.listAll(filters);

    const tableRows = rows.map(
      (m) => `<tr>
        <td><a class="plate-link" href="/vehicle/${m.vehicle_id}">${escapeHtml(m.plate || "—")}</a></td>
        <td>${escapeHtml(m.type_label)}</td>
        <td>${escapeHtml(m.description || "—")}</td>
        <td>${m.amount ? Number(m.amount).toLocaleString("tr-TR") + " TL" : "—"}</td>
        <td>${escapeHtml(m.service_date || "—")}</td>
        <td>${escapeHtml(m.next_service_date || "—")}</td>
        <td>${statusBadge(m.status)}</td>
        <td class="data-table__actions">
          <a href="/maintenance/edit/${m.id}" class="btn btn--sm btn--ghost">Düzenle</a>
          <a href="/maintenance/delete/${m.id}" class="btn btn--sm btn--danger" onclick="return confirm('Bakım kaydı silinsin mi?')">Sil</a>
        </td>
      </tr>`
    );

    const vehicleFilter = `<form class="filters" method="GET" action="/maintenance">
      <select name="vehicle_id" onchange="this.form.submit()">
        <option value="">Tüm araçlar</option>
        ${vehicles
          .map(
            (v) =>
              `<option value="${v.id}" ${String(filters.vehicle_id) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
          )
          .join("")}
      </select>
      <a href="/maintenance" class="btn btn--ghost">Temizle</a>
    </form>`;

    const content = `
      <div class="dash page-enter dash--dense">
        <p class="page-lead">Bakım takibi · ${rows.length} kayıt</p>
        <div class="grid2">
          ${glassPanel({
            title: "Bakım ekle",
            body: `<form method="POST" action="/maintenance/add" class="form-grid">
              <select name="vehicle_id" required>${vehicleOptions(vehicles)}</select>
              <select name="type" required>${typeOptions()}</select>
              <input name="description" placeholder="Açıklama" class="full"/>
              ${moneyInputHtml("amount", { required: false, placeholder: "Tutar (örn. 42.357,00)" })}
              <input type="number" name="km" placeholder="KM"/>
              <input type="date" name="service_date" placeholder="Servis tarihi"/>
              <input type="date" name="next_service_date" placeholder="Sonraki bakım"/>
              <input class="full" name="note" placeholder="Not"/>
              <button type="submit" class="btn btn--primary full">Kaydet</button>
            </form>`,
          })}
          ${glassPanel({
            title: "Yaklaşan bakımlar",
            desc: "30 gün içinde",
            body:
              rows.filter((m) => m.status === "upcoming" || m.status === "overdue").length > 0
                ? `<ul class="task-list">${rows
                    .filter((m) => m.status === "upcoming" || m.status === "overdue")
                    .slice(0, 8)
                    .map(
                      (m) =>
                        `<li class="task-list__item task-list__item--${m.status}">
                          <strong>${escapeHtml(m.plate)}</strong> · ${escapeHtml(m.type_label)}
                          <em>${escapeHtml(m.next_service_date || "")}</em>
                        </li>`
                    )
                    .join("")}</ul>`
                : `<div class="empty empty--sm"><div class="empty__ring">✓</div><p>Yaklaşan bakım yok</p></div>`,
          })}
        </div>
        ${glassPanel({
          title: "Bakım listesi",
          action: `<a href="/export/maintenance/xlsx" class="btn btn--ghost btn--sm">Excel</a>`,
          body: `${vehicleFilter}
            ${dataTable(
              ["Araç", "Tür", "Açıklama", "Tutar", "Servis", "Sonraki", "Durum", ""],
              tableRows,
              { text: "Henüz bakım kaydı yok" }
            )}`,
        })}
      </div>`;

    renderLayout(res, "Bakım", content, "/maintenance", req, {
      pageTitle: "Bakım Takibi",
      breadcrumb: "Giderler / Bakım",
    });
  });

  app.post("/maintenance/add", (req, res) => {
    try {
      maintenanceService.create(req.body);
      const back = req.body.vehicle_id ? `/vehicle/${req.body.vehicle_id}` : "/maintenance";
      redirectWithFlash(res, back, "maintenance_added");
    } catch (e) {
      redirectWithFlash(res, `/maintenance?err=1&msg=${encodeURIComponent(e.message)}`, "maintenance_add_failed");
    }
  });

  app.get("/maintenance/delete/:id", (req, res) => {
    const m = maintenanceService.getById(req.params.id);
    maintenanceService.remove(req.params.id);
    redirectWithFlash(res, m ? `/vehicle/${m.vehicle_id}` : "/maintenance", "maintenance_deleted");
  });

  app.get("/maintenance/edit/:id", (req, res) => {
    const m = maintenanceService.getById(req.params.id);
    if (!m) return res.status(404).send("Kayıt yok");
    const vehicles = getVehicles();
    const content = `
      <div class="dash page-enter dash--dense">
        ${glassPanel({
          title: "Bakım düzenle",
          body: `<form method="POST" action="/maintenance/edit/${m.id}" class="form-grid" style="max-width:520px">
            <select name="vehicle_id" required>${vehicleOptions(vehicles, m.vehicle_id)}</select>
            <select name="type" required>${typeOptions(m.type)}</select>
            <input name="description" value="${escapeHtml(m.description || "")}"/>
            ${moneyInputHtml("amount", { value: m.amount ? formatMoneyInputValue(m.amount) : "", required: false, placeholder: "Tutar (örn. 42.357,00)" })}
            <input type="number" name="km" value="${m.km || ""}"/>
            <input type="date" name="service_date" value="${escapeHtml(m.service_date || "")}"/>
            <input type="date" name="next_service_date" value="${escapeHtml(m.next_service_date || "")}"/>
            <input name="note" value="${escapeHtml(m.note || "")}"/>
            <button type="submit" class="btn btn--primary">Kaydet</button>
            <a href="/maintenance" class="btn btn--ghost">İptal</a>
          </form>`,
        })}
      </div>`;
    renderLayout(res, "Bakım Düzenle", content, "/maintenance", req);
  });

  app.post("/maintenance/edit/:id", (req, res) => {
    try {
      maintenanceService.update(req.params.id, req.body);
      redirectWithFlash(res, "/maintenance", "maintenance_updated");
    } catch (e) {
      redirectWithFlash(res, `/maintenance?err=1&msg=${encodeURIComponent(e.message)}`, "maintenance_update_failed");
    }
  });
}

module.exports = registerMaintenance;
