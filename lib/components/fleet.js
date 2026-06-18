const { escapeHtml } = require("./escape");
const { money, vehicleStatus } = require("../finance");
const { formatPlateDisplay } = require("../../utils/plate");
const { ICONS } = require("../icons");

function displayPlate(plate) {
  return formatPlateDisplay(plate) || plate || "—";
}
function vehicleEmoji(type) {
  if (type === "Servis") return "🚐";
  if (type === "Turizm") return "🚙";
  return "🚗";
}

function typeBadge(type) {
  const t = escapeHtml(type || "—");
  if (type === "Servis") return `<span class="pill pill--blue">${t}</span>`;
  if (type === "Turizm") return `<span class="pill pill--amber">${t}</span>`;
  return `<span class="pill">${t}</span>`;
}

function statusPill(v) {
  const s = vehicleStatus(v);
  if (s === "profit") return `<span class="pill pill--green">Kârlı</span>`;
  if (s === "loss") return `<span class="pill pill--red">Zararda</span>`;
  return `<span class="pill pill--muted">Veri yok</span>`;
}

function vehicleCard(v) {
  const s = vehicleStatus(v);
  const state = s === "profit" ? "up" : s === "loss" ? "down" : "flat";
  const net =
    v.income === 0 && v.expense === 0
      ? "—"
      : money(v.net);
  const netClass =
    v.income === 0 && v.expense === 0
      ? "muted"
      : v.net >= 0
        ? "pos"
        : "neg";

  return `<a href="/vehicle/${v.id}" class="vehicle-card vehicle-card--${state} vehicle-card--clickable">
    <div class="vehicle-card__head">
      <span class="vehicle-card__plate">${escapeHtml(displayPlate(v.plate))}</span>
      ${typeBadge(v.type)}
    </div>
    <div class="vehicle-card__metrics">
      <div><span>Gelir</span><strong class="text-pos">${money(v.income)}</strong></div>
      <div><span>Gider</span><strong class="text-neg">${money(v.expense)}</strong></div>
    </div>
    <div class="vehicle-card__footer">
      <div>
        <span class="vehicle-card__net-label">Net</span>
        <span class="vehicle-card__net vehicle-card__net--${netClass}">${net}</span>
      </div>
      ${statusPill(v)}
    </div>
    <span class="vehicle-card__cta">
      Araç Merkezi ${ICONS.arrow}
    </span>
  </a>`;
}

function vehicleGrid(summaries) {
  if (!summaries.length) {
    return `<div class="empty">
      <div class="empty__icon">🚗</div>
      <h3>Henüz araç yok</h3>
      <p>İlk aracınızı ekleyerek filo özetini oluşturun.</p>
      <a href="/vehicles" class="btn btn--primary">Araç Ekle</a>
    </div>`;
  }
  return `<div class="vehicle-grid">${summaries.map(vehicleCard).join("")}</div>`;
}

/** Araçlar sayfası — büyük premium kartlar */
function fleetCardLarge(v) {
  const s = vehicleStatus(v);
  const state = s === "profit" ? "up" : s === "loss" ? "down" : "flat";
  const net =
    v.income === 0 && v.expense === 0 ? "—" : money(v.net);
  const netClass =
    v.income === 0 && v.expense === 0 ? "muted" : v.net >= 0 ? "pos" : "neg";
  const emoji = vehicleEmoji(v.type);
  const meta = [v.brand, v.model, v.year].filter(Boolean).join(" · ") || "Araç bilgisi";

  return `<a href="/vehicle/${v.id}" class="fleet-card fleet-card--${state} fleet-card--clickable fade-in">
    <div class="fleet-card__glow"></div>
    <div class="fleet-card__top">
      <div class="fleet-card__icon">${emoji}</div>
      <div class="fleet-card__head">
        <h3 class="fleet-card__plate">${escapeHtml(displayPlate(v.plate))}</h3>
        <p class="fleet-card__meta">${escapeHtml(meta)}</p>
      </div>
      ${typeBadge(v.type)}
    </div>
    <div class="fleet-card__metrics">
      <div class="fleet-card__metric">
        <span>Gelir</span>
        <strong class="text-pos">${money(v.income)}</strong>
      </div>
      <div class="fleet-card__metric">
        <span>Gider</span>
        <strong class="text-neg">${money(v.expense)}</strong>
      </div>
      <div class="fleet-card__metric fleet-card__metric--net">
        <span>Net</span>
        <strong class="fleet-card__net fleet-card__net--${netClass}">${net}</strong>
      </div>
    </div>
    <div class="fleet-card__foot">
      ${statusPill(v)}
      <span class="btn btn--primary fleet-card__cta">
        Araç Merkezi ${ICONS.arrow}
      </span>
    </div>
  </a>`;
}

/** Araçlar sayfası — tek ekran kompakt kart */
function fleetCardFit(v) {
  const s = vehicleStatus(v);
  const state = s === "profit" ? "up" : s === "loss" ? "down" : "flat";
  const net =
    v.income === 0 && v.expense === 0 ? "—" : money(v.net);
  const netClass =
    v.income === 0 && v.expense === 0 ? "muted" : v.net >= 0 ? "pos" : "neg";

  return `<a href="/vehicle/${v.id}" class="fleet-card fleet-card--fit fleet-card--${state} fleet-card--clickable fade-in">
    <div class="fleet-card__glow"></div>
    <div class="fleet-card__row fleet-card__row--head">
      <span class="fleet-card__icon" aria-hidden="true">${vehicleEmoji(v.type)}</span>
      <h3 class="fleet-card__plate">${escapeHtml(displayPlate(v.plate))}</h3>
      ${typeBadge(v.type)}
    </div>
    <div class="fleet-card__metrics fleet-card__metrics--fit">
      <div class="fleet-card__metric">
        <span>Gelir</span>
        <strong class="text-pos">${money(v.income)}</strong>
      </div>
      <div class="fleet-card__metric">
        <span>Gider</span>
        <strong class="text-neg">${money(v.expense)}</strong>
      </div>
      <div class="fleet-card__metric fleet-card__metric--net">
        <span>Net</span>
        <strong class="fleet-card__net fleet-card__net--${netClass}">${net}</strong>
      </div>
    </div>
    <div class="fleet-card__foot fleet-card__foot--fit">
      ${statusPill(v)}
      <span class="btn btn--primary btn--sm fleet-card__cta">Araç Merkezi ${ICONS.arrow}</span>
    </div>
  </a>`;
}

function fleetCardGrid(summaries, opts = {}) {
  const fit = !!(opts && opts.fit);
  if (!summaries.length) {
    return `<div class="empty empty--rich fade-in">
      <div class="empty__ring">🚗</div>
      <h3>İlk aracınızı ekleyerek filo operasyonunu başlatın</h3>
      <p>Yukarıdaki formdan plaka girin. HGS ve yakıt kayıtları bu plakalarla eşleşerek giderlere dönüşür.</p>
      <div class="empty__action"><a href="#vehicleAddForm" class="btn btn--primary">Araç Ekle</a></div>
    </div>`;
  }
  const gridClass = fit ? "fleet-card-grid fleet-card-grid--fit" : "fleet-card-grid";
  const render = fit ? fleetCardFit : fleetCardLarge;
  return `<div class="${gridClass}">${summaries.map(render).join("")}</div>`;
}

module.exports = {
  vehicleCard,
  vehicleGrid,
  fleetCardLarge,
  fleetCardFit,
  fleetCardGrid,
  typeBadge,
  statusPill,
  vehicleEmoji,
};
