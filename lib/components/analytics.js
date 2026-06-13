const { escapeHtml } = require("./escape");
const { money, vehicleStatus } = require("../finance");
const { typeBadge, statusPill } = require("./fleet");

function statusAnalysisGrid({ profit, loss, empty }) {
  return `<div class="status-grid">
    <div class="status-card status-card--profit">
      <div class="status-card__n">${profit}</div>
      <div class="status-card__l">Kârlı araç</div>
    </div>
    <div class="status-card status-card--loss">
      <div class="status-card__n">${loss}</div>
      <div class="status-card__l">Zararda araç</div>
    </div>
    <div class="status-card status-card--empty">
      <div class="status-card__n">${empty}</div>
      <div class="status-card__l">Veri yok</div>
    </div>
  </div>`;
}

function vehicleSummaryRow(v) {
  const netCls =
    v.income === 0 && v.expense === 0 ? "muted" : v.net >= 0 ? "text-pos" : "text-neg";
  const netVal =
    v.income === 0 && v.expense === 0 ? "—" : money(v.net);

  return `<tr>
    <td><a href="/vehicle/${v.id}" class="data-table__plate">${escapeHtml(v.plate)}</a></td>
    <td>${typeBadge(v.type)}</td>
    <td class="text-pos">${money(v.income)}</td>
    <td class="text-neg">${money(v.expense)}</td>
    <td class="${netCls}"><strong>${netVal}</strong></td>
    <td>${statusPill(v)}</td>
    <td class="data-table__actions">
      <a href="/vehicle/${v.id}" class="btn btn--sm btn--ghost">Detay</a>
    </td>
  </tr>`;
}

function fleetTypePanel(title, data, tone) {
  const netCls = data.net >= 0 ? "text-pos" : "text-neg";
  return `<section class="panel">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">${escapeHtml(title)}</h2>
        <p class="panel__desc">${data.count} araç</p>
      </div>
    </header>
    <div class="panel__body">
      <div class="info-grid">
        <div class="info-item"><span>Toplam gelir</span><strong class="text-pos">${money(data.income)}</strong></div>
        <div class="info-item"><span>Toplam gider</span><strong class="text-neg">${money(data.expense)}</strong></div>
        <div class="info-item"><span>Net</span><strong class="${netCls}">${money(data.net)}</strong></div>
      </div>
    </div>
  </section>`;
}

module.exports = { statusAnalysisGrid, vehicleSummaryRow, fleetTypePanel };
