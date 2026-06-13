const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function profitNetClass(net) {
  if (net > 0) return "text-pos";
  if (net < 0) return "text-neg";
  return "";
}

function profitabilityKpiRow(summary) {
  return `<div class="profit-kpi-row fade-in">
    <article class="profit-kpi-card profit-kpi-card--income">
      <span class="profit-kpi-card__label">Toplam Filo Geliri</span>
      <strong class="profit-kpi-card__value text-pos">${money(summary.totalIncome)}</strong>
    </article>
    <article class="profit-kpi-card profit-kpi-card--expense">
      <span class="profit-kpi-card__label">Toplam Filo Gideri</span>
      <strong class="profit-kpi-card__value text-neg">${money(summary.totalExpense)}</strong>
    </article>
    <article class="profit-kpi-card profit-kpi-card--net">
      <span class="profit-kpi-card__label">Toplam Net Kâr</span>
      <strong class="profit-kpi-card__value ${profitNetClass(summary.totalNet)}">${money(summary.totalNet)}</strong>
    </article>
    <article class="profit-kpi-card profit-kpi-card--avg">
      <span class="profit-kpi-card__label">Araç Başına Ortalama Kâr</span>
      <strong class="profit-kpi-card__value ${profitNetClass(summary.avgProfitPerVehicle)}">${money(summary.avgProfitPerVehicle)}</strong>
    </article>
  </div>`;
}

function profitabilityRankPanel(topVehicles) {
  if (!topVehicles.length) {
    return `<section class="panel profit-rank-panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">En Karlı Araçlar</h2>
          <p class="panel__desc">Net kâra göre sıralama</p>
        </div>
      </header>
      <div class="panel__body"><p class="profit-rank-empty">Henüz sıralanacak araç verisi yok.</p></div>
    </section>`;
  }

  const items = topVehicles
    .map(
      (v, i) => `<a href="/vehicle/${v.vehicleId}" class="profit-rank-item profit-rank-item--${v.netProfit >= 0 ? "up" : "down"}">
        <span class="profit-rank-item__n">${i + 1}.</span>
        <span class="profit-rank-item__plate">${escapeHtml(v.plate)}</span>
        <strong class="profit-rank-item__net ${profitNetClass(v.netProfit)}">${money(v.netProfit)}</strong>
      </a>`
    )
    .join("");

  return `<section class="panel profit-rank-panel fade-in">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">En Karlı Araçlar</h2>
        <p class="panel__desc">Net kâr · DESC · ilk 5</p>
      </div>
    </header>
    <div class="panel__body profit-rank-list">${items}</div>
  </section>`;
}

function profitabilityTable(rows) {
  const body = rows
    .map((r) => {
      const href = r.vehicleId ? `/vehicle/${r.vehicleId}` : "#";
      const plateClass = r.isUnassigned ? "profit-table__plate profit-table__plate--muted" : "profit-table__plate";
      return `<tr class="profit-table__row${r.isUnassigned ? " profit-table__row--unassigned" : ""}">
        <td><a href="${href}" class="${plateClass}">${escapeHtml(r.plate)}</a></td>
        <td class="text-pos"><strong>${money(r.income)}</strong></td>
        <td>${money(r.fuel)}</td>
        <td>${money(r.hgs)}</td>
        <td>${money(r.maintenance)}</td>
        <td>${money(r.other)}</td>
        <td class="text-neg"><strong>${money(r.totalExpense)}</strong></td>
        <td class="${profitNetClass(r.netProfit)}"><strong>${money(r.netProfit)}</strong></td>
      </tr>`;
    })
    .join("");

  return `<div class="profit-table-wrap">
    <table class="profit-table">
      <thead>
        <tr>
          <th>Araç</th>
          <th>Gelir</th>
          <th>Yakıt</th>
          <th>HGS</th>
          <th>Bakım</th>
          <th>Diğer Gider</th>
          <th>Toplam Gider</th>
          <th>Net Kâr</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function profitabilityEmptyState() {
  return `<div class="profit-empty fade-in">
    <div class="profit-empty__ring" aria-hidden="true"></div>
    <h3 class="profit-empty__title">Kârlılık analizi için araç bazlı gelir ve gider verisi gerekli.</h3>
    <p class="profit-empty__hint">Gelir kaydı, gider, yakıt veya HGS verisi girdikten sonra araç bazlı net kâr hesaplanır.</p>
    <div class="profit-empty__actions">
      <a href="/income/service" class="btn btn--primary btn--sm">Gelir Ekle</a>
      <a href="/expenses" class="btn btn--ghost btn--sm">Gider Yönetimi</a>
    </div>
  </div>`;
}

function profitabilityPage({ summary, rows, topVehicles, hasData }) {
  if (!hasData) {
    return `<div class="dash page-enter profit-hub">
      <header class="profit-hub__header fade-in">
        <p class="profit-hub__eyebrow">Filo Finans · Kârlılık Motoru</p>
        <h2 class="profit-hub__title">Araç Karlılık Merkezi</h2>
        <p class="profit-hub__desc">Hangi aracın gerçekten para kazandırdığını net kâr formülüyle görün.</p>
      </header>
      ${profitabilityEmptyState()}
    </div>`;
  }

  return `<div class="dash page-enter profit-hub">
    <header class="profit-hub__header fade-in">
      <p class="profit-hub__eyebrow">Filo Finans · Kârlılık Motoru</p>
      <h2 class="profit-hub__title">Araç Karlılık Merkezi</h2>
      <p class="profit-hub__desc">Net Kâr = Toplam Gelir − (Yakıt + HGS + Bakım + Diğer Giderler)</p>
    </header>
    ${profitabilityKpiRow(summary)}
    <div class="profit-layout fade-in">
      <section class="panel profit-table-panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Araç Kârlılık Tablosu</h2>
            <p class="panel__desc">Gelir, operasyonel gider kalemleri ve net kâr</p>
          </div>
        </header>
        <div class="panel__body">${profitabilityTable(rows)}</div>
      </section>
      ${profitabilityRankPanel(topVehicles)}
    </div>
  </div>`;
}

module.exports = {
  profitabilityPage,
  profitabilityKpiRow,
  profitabilityRankPanel,
  profitabilityTable,
  profitabilityEmptyState,
};
