const { escapeHtml } = require("./escape");
const { formatDateDisplay } = require("../../utils/date");
const { DOCUMENT_TYPES, STATUS_LABELS } = require("../../services/documentService");

function statusBadge(status) {
  const map = {
    expired: "pill pill--red",
    critical: "pill pill--red",
    warning: "pill pill--amber",
    upcoming: "pill pill--blue",
    ok: "pill pill--green",
    no_date: "pill pill--muted",
  };
  const cls = map[status] || map.no_date;
  const label = STATUS_LABELS[status] || status;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function typeOptions(selected = "") {
  return Object.entries(DOCUMENT_TYPES)
    .map(
      ([k, label]) =>
        `<option value="${k}" ${k === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function documentsPageHtml({ kpi, upcoming, rows, vehicles, filters, editDoc }) {
  const vehicleFilter = filters.vehicle_id || "";

  const kpiCards = `
    <div class="doc-kpi-row fade-in">
      <article class="doc-kpi doc-kpi--expired"><span>Süresi Geçen</span><strong>${kpi.expired}</strong></article>
      <article class="doc-kpi doc-kpi--critical"><span>7 Gün İçinde</span><strong>${kpi.within7}</strong></article>
      <article class="doc-kpi doc-kpi--warning"><span>30 Gün İçinde</span><strong>${kpi.within30}</strong></article>
      <article class="doc-kpi doc-kpi--upcoming"><span>60 Gün İçinde</span><strong>${kpi.within60}</strong></article>
    </div>`;

  const upcomingRows = upcoming.length
    ? upcoming
        .map(
          (d) => `<tr>
          <td><a class="plate-link" href="/vehicle/${d.vehicle_id}">${escapeHtml(d.plate || "—")}</a></td>
          <td>${escapeHtml(d.type_label)}</td>
          <td>${escapeHtml(d.title || "—")}</td>
          <td>${formatDateDisplay(d.expiry_date)}</td>
          <td>${d.daysLeft != null ? d.daysLeft.toLocaleString("tr-TR") : "—"}</td>
          <td>${statusBadge(d.status)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="data-table__empty">Yaklaşan evrak bulunmuyor.</td></tr>`;

  const allRows = rows.length
    ? rows
        .map(
          (d) => `<tr>
          <td><a class="plate-link" href="/vehicle/${d.vehicle_id}">${escapeHtml(d.plate || "—")}</a></td>
          <td>${escapeHtml(d.type_label)}</td>
          <td>${escapeHtml(d.title || "—")}</td>
          <td>${formatDateDisplay(d.expiry_date)}</td>
          <td>${d.daysLeft != null ? d.daysLeft.toLocaleString("tr-TR") : "—"}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${escapeHtml(d.note || "—")}</td>
          <td class="data-table__actions">
            <a href="/documents/edit/${d.id}" class="btn btn--sm btn--ghost">Düzenle</a>
            <a href="/documents/delete/${d.id}" class="btn btn--sm btn--danger" onclick="return confirm('Evrak kaydı silinsin mi?')">Sil</a>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="data-table__empty">Henüz evrak kaydı yok.</td></tr>`;

  const formTitle = editDoc ? "Evrak düzenle" : "Evrak ekle";
  const formAction = editDoc ? `/documents/edit/${editDoc.id}` : "/documents/add";
  const selectedVehicle = editDoc ? String(editDoc.vehicle_id) : vehicleFilter;
  const expiryValue = editDoc?.expiry_date ? formatDateDisplay(editDoc.expiry_date) : "";

  const formPanel = `<section class="panel fade-in">
    <header class="panel__head"><h2 class="panel__title">${escapeHtml(formTitle)}</h2></header>
    <div class="panel__body">
      <form method="POST" action="${formAction}" class="form-grid">
        <select name="vehicle_id" required>
          <option value="">Araç seçin</option>
          ${vehicles
            .map(
              (v) =>
                `<option value="${v.id}" ${String(selectedVehicle) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
            )
            .join("")}
        </select>
        <select name="document_type" required>${typeOptions(editDoc?.document_type || "")}</select>
        <input name="title" placeholder="Başlık (opsiyonel)" value="${escapeHtml(editDoc?.title || "")}"/>
        <input name="expiry_date" placeholder="Bitiş tarihi (GG.AA.YYYY veya YYYY-MM-DD)" value="${escapeHtml(expiryValue === "—" ? "" : expiryValue)}"/>
        <input class="full" name="note" placeholder="Not" value="${escapeHtml(editDoc?.note || "")}"/>
        <div class="form-actions full">
          <button type="submit" class="btn btn--primary">${editDoc ? "Güncelle" : "Kaydet"}</button>
          ${editDoc ? `<a href="/documents" class="btn btn--ghost">İptal</a>` : ""}
        </div>
      </form>
    </div>
  </section>`;

  return `<div class="dash page-enter documents-hub">
    <header class="documents-hub__header fade-in">
      <p class="documents-hub__eyebrow">Filo Uygunluk · Evrak Takibi</p>
      <h2 class="documents-hub__title">Muayene / Sigorta / Yetki Belgesi</h2>
      <p class="documents-hub__desc">Araç bazlı evrak bitiş tarihleri ve notları tek ekranda.</p>
    </header>

    ${kpiCards}

    <div class="grid2">
      ${formPanel}
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Yaklaşan Evraklar</h2>
          <p class="panel__desc">Süresi dolmuş veya 60 gün içinde bitecek kayıtlar</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Araç</th><th>Tür</th><th>Başlık</th><th>Bitiş</th><th>Kalan Gün</th><th>Durum</th>
            </tr></thead>
            <tbody>${upcomingRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Tüm Evraklar</h2>
          <p class="panel__desc">${rows.length} kayıt</p>
        </div>
        <form class="filters" method="GET" action="/documents">
          <select name="vehicle_id" onchange="this.form.submit()">
            <option value="">Tüm araçlar</option>
            ${vehicles
              .map(
                (v) =>
                  `<option value="${v.id}" ${String(vehicleFilter) === String(v.id) ? "selected" : ""}>${escapeHtml(v.plate)}</option>`
              )
              .join("")}
          </select>
          <a href="/documents" class="btn btn--ghost btn--sm">Temizle</a>
        </form>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Araç</th><th>Tür</th><th>Başlık</th><th>Bitiş</th><th>Kalan Gün</th><th>Durum</th><th>Not</th><th></th>
          </tr></thead>
          <tbody>${allRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  documentsPageHtml,
  statusBadge,
  typeOptions,
};
