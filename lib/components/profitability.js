const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function profitNetClass(net) {
  if (net > 0) return "text-pos";
  if (net < 0) return "text-neg";
  return "";
}

function formatMargin(margin) {
  if (margin == null) return "—";
  return `${Number(margin).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function profitabilityKpiRow(summary) {
  const best = summary.mostProfitable;
  const worst = summary.leastProfitable;

  return `<div class="profit-kpi-row fade-in">
    <article class="profit-kpi-card profit-kpi-card--best">
      <span class="profit-kpi-card__label">En Karlı Araç</span>
      <strong class="profit-kpi-card__value ${profitNetClass(best?.netProfit || 0)}">${escapeHtml(best?.plate || "—")}</strong>
      <span class="profit-kpi-card__sub">${best?.netProfit != null ? money(best.netProfit) : "—"}</span>
    </article>
    <article class="profit-kpi-card profit-kpi-card--worst">
      <span class="profit-kpi-card__label">En Düşük Karlı Araç</span>
      <strong class="profit-kpi-card__value ${profitNetClass(worst?.netProfit || 0)}">${escapeHtml(worst?.plate || "—")}</strong>
      <span class="profit-kpi-card__sub">${worst?.netProfit != null ? money(worst.netProfit) : "—"}</span>
    </article>
    <article class="profit-kpi-card profit-kpi-card--net">
      <span class="profit-kpi-card__label">Toplam Filo Kârı</span>
      <strong class="profit-kpi-card__value ${profitNetClass(summary.totalNet)}">${money(summary.totalNet)}</strong>
    </article>
    <article class="profit-kpi-card profit-kpi-card--avg">
      <span class="profit-kpi-card__label">Ortalama Araç Karlılığı</span>
      <strong class="profit-kpi-card__value ${profitNetClass(summary.avgProfitPerVehicle)}">${money(summary.avgProfitPerVehicle)}</strong>
      <span class="profit-kpi-card__sub">${summary.avgProfitMargin != null ? formatMargin(summary.avgProfitMargin) + " marj" : "—"}</span>
    </article>
  </div>`;
}

function profitabilityFilterBar(activeFilter) {
  const filters = [
    { key: "", label: "Tüm Araçlar" },
    { key: "Servis", label: "Servis Araçları" },
    { key: "Turizm", label: "Turizm Araçları" },
  ];
  const links = filters
    .map((f) => {
      const href = f.key ? `/profitability?type=${encodeURIComponent(f.key)}` : "/profitability";
      const active = (activeFilter || "") === f.key ? " is-active" : "";
      return `<a href="${href}" class="profit-filter-chip${active}">${escapeHtml(f.label)}</a>`;
    })
    .join("");
  return `<div class="profit-filter-bar fade-in">${links}</div>`;
}

function profitabilityRankPanel(rankedRows) {
  const list = rankedRows.filter((r) => !r.isUnassigned && (r.income > 0 || r.totalExpense > 0));

  if (!list.length) {
    return `<section class="panel profit-rank-panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Net Kâr Sıralaması</h2>
          <p class="panel__desc">En yüksek net kârdan başlayarak</p>
        </div>
      </header>
      <div class="panel__body"><p class="profit-rank-empty">Henüz sıralanacak araç verisi yok.</p></div>
    </section>`;
  }

  const items = list
    .map(
      (v, i) => `<a href="/vehicle/${v.vehicleId}" class="profit-rank-item profit-rank-item--${v.netProfit >= 0 ? "up" : "down"}">
        <span class="profit-rank-item__n">${i + 1}</span>
        <span class="profit-rank-item__plate">${escapeHtml(v.plate)}</span>
        <span class="profit-rank-item__margin">${formatMargin(v.profitMargin)}</span>
        <strong class="profit-rank-item__net ${profitNetClass(v.netProfit)}">${money(v.netProfit)}</strong>
      </a>`
    )
    .join("");

  return `<section class="panel profit-rank-panel fade-in">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">Net Kâr Sıralaması</h2>
        <p class="panel__desc">${list.length} araç · net kâra göre DESC</p>
      </div>
    </header>
    <div class="panel__body profit-rank-list">${items}</div>
  </section>`;
}

function profitabilityTable(rows) {
  const sorted = [...rows]
    .filter((r) => !r.isUnassigned)
    .sort((a, b) => b.netProfit - a.netProfit);

  const body = sorted
    .map((r) => {
      const href = r.vehicleId ? `/vehicle/${r.vehicleId}` : "#";
      return `<tr class="profit-table__row">
        <td><a href="${href}" class="profit-table__plate">${escapeHtml(r.plate)}</a></td>
        <td class="text-pos"><strong>${money(r.income)}</strong></td>
        <td>${money(r.fuel)}</td>
        <td>${money(r.hgs)}</td>
        <td>${money(r.maintenance)}</td>
        <td class="text-neg"><strong>${money(r.totalExpense)}</strong></td>
        <td class="${profitNetClass(r.netProfit)}"><strong>${money(r.netProfit)}</strong></td>
        <td>${formatMargin(r.profitMargin)}</td>
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
          <th>Toplam Gider</th>
          <th>Net Kâr</th>
          <th>Karlılık %</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="8">Kayıt yok</td></tr>`}</tbody>
    </table>
  </div>`;
}

function profitabilityEmptyState() {
  return `<div class="profit-empty fade-in">
    <div class="profit-empty__ring" aria-hidden="true"></div>
    <h3 class="profit-empty__title">Kârlılık analizi için araç bazlı gelir ve gider verisi gerekli.</h3>
    <p class="profit-empty__hint">Servis/Turizm geliri, yakıt, HGS/OGS veya bakım verisi girdikten sonra net kâr hesaplanır.</p>
    <div class="profit-empty__actions">
      <a href="/income/service" class="btn btn--primary btn--sm">Gelir Ekle</a>
      <a href="/expenses" class="btn btn--ghost btn--sm">Gider Yönetimi</a>
    </div>
  </div>`;
}

function profitabilityPage({ summary, rows, rankedRows, hasData, vehicleFilter = "" }) {
  if (!hasData) {
    return `<div class="dash page-enter profit-hub">
      <header class="profit-hub__header fade-in">
        <p class="profit-hub__eyebrow">Filo Finans · Kârlılık Motoru</p>
        <h2 class="profit-hub__title">Araç Karlılık Merkezi</h2>
        <p class="profit-hub__desc">Hangi aracın gerçekten para kazandırdığını net kâr formülüyle görün.</p>
      </header>
      ${profitabilityFilterBar(vehicleFilter)}
      ${profitabilityEmptyState()}
    </div>`;
  }

  return `<div class="dash page-enter profit-hub">
    <header class="profit-hub__header fade-in">
      <p class="profit-hub__eyebrow">Filo Finans · PROFIT-03 Gerçek Kârlılık</p>
      <h2 class="profit-hub__title">Araç Karlılık Merkezi</h2>
      <p class="profit-hub__desc">Net Kâr = Gelir − (Yakıt + HGS/OGS + Bakım + Diğer Giderler) · Karlılık % = Net Kâr / Gelir</p>
    </header>
    ${profitabilityFilterBar(vehicleFilter)}
    ${profitabilityKpiRow(summary)}
    <div class="profit-layout fade-in">
      <section class="panel profit-table-panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Araç Kârlılık Tablosu</h2>
            <p class="panel__desc">Gelir, operasyonel gider kalemleri, net kâr ve marj</p>
          </div>
        </header>
        <div class="panel__body">${profitabilityTable(rows)}</div>
      </section>
      ${profitabilityRankPanel(rankedRows || rows)}
    </div>
  </div>`;
}

module.exports = {
  profitabilityPage,
  profitabilityKpiRow,
  profitabilityRankPanel,
  profitabilityTable,
  profitabilityEmptyState,
  profitabilityFilterBar,
};
