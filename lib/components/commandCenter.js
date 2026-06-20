const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function commandHeader({ vehicleCount, fleetStatus, fuelRecordCount, maintenanceCount }) {
  const tone = fleetStatus.tone || "neutral";
  return `<header class="cmd-header cmd-toolbar fade-in">
    <div class="cmd-header__main">
      <p class="cmd-toolbar__eyebrow">Filo Operasyon Merkezi</p>
      <div class="cmd-toolbar__badges">
        <span class="cmd-ops-badge cmd-ops-badge--fleet">
          <span class="cmd-ops-badge__label">Aktif Araç</span>
          <strong>${vehicleCount}</strong>
        </span>
        <span class="cmd-ops-badge cmd-ops-badge--fuel">
          <span class="cmd-ops-badge__label">Yakıt Kaydı</span>
          <strong>${Number(fuelRecordCount).toLocaleString("tr-TR")}</strong>
        </span>
        <span class="cmd-ops-badge cmd-ops-badge--hgs">
          <span class="cmd-ops-badge__label">HGS Durumu</span>
          <strong>Hazırlık</strong>
        </span>
        <span class="cmd-ops-badge cmd-ops-badge--maint">
          <span class="cmd-ops-badge__label">Yaklaşan Bakım</span>
          <strong>${maintenanceCount}</strong>
        </span>
        <span class="cmd-header__status cmd-header__status--${tone}">${escapeHtml(fleetStatus.label)}</span>
      </div>
    </div>
    <div class="cmd-header__right">
      <div class="live-clock cmd-header__clock">
        <span class="live-clock__date" id="liveDate">—</span>
        <span class="live-clock__time" id="liveTime">—</span>
      </div>
      <div class="cmd-header__actions">
        <a href="/notifications" class="btn btn--sm btn--ghost cmd-notifications-badge" id="dashboardNotificationsBadge">
          Notifications (<span id="dashboardNotificationsCount">0</span>)
        </a>
        <a href="/maintenance-alerts" class="btn btn--sm btn--ghost cmd-maintenance-alerts-badge" id="dashboardMaintenanceAlertsBadge">
          Bakım Uyarıları (<span id="dashboardMaintenanceAlertsCount">0</span>)
        </a>
        <a href="/tire-alerts" class="btn btn--sm btn--ghost cmd-tire-alerts-badge" id="dashboardTireAlertsBadge">
          Lastik Uyarıları (<span id="dashboardTireAlertsCount">0</span>)
        </a>
        <a href="/income/service" class="btn btn--sm btn--primary btn--compact">+ Gelir</a>
        <a href="/expenses" class="btn btn--sm btn--ghost btn--compact">+ Gider</a>
        <a href="/fuel" class="btn btn--sm btn--ghost">Yakıt</a>
        <a href="/reports" class="btn btn--sm btn--ghost">Analiz</a>
      </div>
    </div>
  </header>`;
}

function executiveFinancialPanel({
  netProfit,
  netTone,
  servisIncome,
  turizmIncome,
  totalExpense,
  avgProfitPerVehicle,
  cashflow,
}) {
  const tone = netTone || (netProfit > 0 ? "profit" : netProfit < 0 ? "loss" : "neutral");
  const netClass =
    tone === "profit" ? "text-pos" : tone === "loss" ? "text-neg" : "text-neutral";
  const { cashflowDashboardCard } = require("./cashflow");
  return `<section class="cmd-kpi-row cmd-kpi-row--exec fade-in">
    <article class="cmd-kpi-card cmd-kpi-card--hero cmd-kpi-card--${tone}">
      <span class="cmd-kpi-card__label">Net Durum</span>
      <strong class="cmd-kpi-card__value ${netClass}">${money(netProfit)}</strong>
    </article>
    ${cashflow ? cashflowDashboardCard(cashflow) : ""}
    <article class="cmd-kpi-card cmd-kpi-card--servis">
      <span class="cmd-kpi-card__label">Servis Geliri</span>
      <strong class="cmd-kpi-card__value text-pos">${money(servisIncome)}</strong>
    </article>
    <article class="cmd-kpi-card cmd-kpi-card--turizm">
      <span class="cmd-kpi-card__label">Turizm Geliri</span>
      <strong class="cmd-kpi-card__value text-pos">${money(turizmIncome)}</strong>
    </article>
    <article class="cmd-kpi-card cmd-kpi-card--expense">
      <span class="cmd-kpi-card__label">Toplam Gider</span>
      <strong class="cmd-kpi-card__value text-neg">${money(totalExpense)}</strong>
    </article>
    <article class="cmd-kpi-card cmd-kpi-card--avg">
      <span class="cmd-kpi-card__label">Araç Başına Ort. Kâr</span>
      <strong class="cmd-kpi-card__value ${avgProfitPerVehicle >= 0 ? "text-pos" : avgProfitPerVehicle < 0 ? "text-neg" : ""}">${money(avgProfitPerVehicle || 0)}</strong>
    </article>
  </section>`;
}

function executiveProfitSummary({ profit }) {
  if (!profit) return commandInsightCompact({ mainAlert: "Kârlılık verisi yüklenemedi." });

  const { summary, mostProfitable, leastProfitable, executiveComment, hasData } = profit;
  const bestPlate = mostProfitable?.plate && mostProfitable.plate !== "—" ? mostProfitable.plate : "—";
  const bestNet =
    mostProfitable?.netProfit != null ? money(mostProfitable.netProfit) : "—";
  const worstPlate =
    leastProfitable?.plate && leastProfitable.plate !== "—" ? leastProfitable.plate : "—";
  const worstNet =
    leastProfitable?.netProfit != null ? money(leastProfitable.netProfit) : "—";
  const worstClass =
    leastProfitable?.netProfit != null && leastProfitable.netProfit < 0 ? "text-neg" : "";

  const comment =
    executiveComment ||
    (hasData
      ? "Yönetici özeti oluşturuluyor."
      : "Kârlılık analizi için araç bazlı gelir ve gider verisi gerekli.");

  return `<aside class="cmd-insight cmd-insight--compact cmd-insight--exec fade-in">
    <div class="cmd-insight__head">
      <span class="cmd-insight__badge">Executive Finans</span>
      <h3 class="cmd-insight__title">Özet</h3>
    </div>
    <div class="cmd-exec-metrics">
      <div class="cmd-exec-metric">
        <span>Toplam net kâr</span>
        <strong class="${summary.totalNet >= 0 ? "text-pos" : summary.totalNet < 0 ? "text-neg" : ""}">${money(summary.totalNet)}</strong>
      </div>
      <div class="cmd-exec-metric">
        <span>En kârlı araç</span>
        <strong class="text-pos">${escapeHtml(bestPlate)} <em>${escapeHtml(bestNet)}</em></strong>
      </div>
      <div class="cmd-exec-metric">
        <span>En zararlı araç</span>
        <strong class="${worstClass}">${escapeHtml(worstPlate)} <em>${escapeHtml(worstNet)}</em></strong>
      </div>
    </div>
    <p class="cmd-insight__alert">${escapeHtml(comment)}</p>
    <a href="/profitability" class="btn btn--ghost btn--sm cmd-insight__link">Detaylı Kârlılık Analizi →</a>
  </aside>`;
}

function vehicleProfitRankPanel({ profit }) {
  if (!profit?.hasData || !profit.top5?.length) {
    return `<section class="cmd-panel cmd-panel--rank cmd-panel--compact fade-in">
      <header class="cmd-panel__head">
        <div>
          <h3 class="cmd-panel__title">Araç Karlılık Sıralaması</h3>
          <p class="cmd-panel__desc">Net kâra göre ilk 5 araç</p>
        </div>
      </header>
      <div class="cmd-panel__body">
        <div class="empty empty--sm"><p>Kârlılık sıralaması için araç bazlı veri gerekli.</p></div>
      </div>
    </section>`;
  }

  const rows = profit.top5
    .map(
      (v) => `<tr>
        <td><code class="cmd-rank-plate">${escapeHtml(v.plate)}</code></td>
        <td class="text-pos">${money(v.income)}</td>
        <td class="text-neg">${money(v.totalExpense)}</td>
        <td class="${v.netProfit >= 0 ? "text-pos" : "text-neg"}"><strong>${money(v.netProfit)}</strong></td>
      </tr>`
    )
    .join("");

  return `<section class="cmd-panel cmd-panel--rank cmd-panel--compact fade-in">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Araç Karlılık Sıralaması</h3>
        <p class="cmd-panel__desc">Net kâra göre ilk 5 araç</p>
      </div>
      <a href="/profitability" class="btn btn--ghost btn--sm">Tümü →</a>
    </header>
    <div class="cmd-panel__body cmd-rank-wrap">
      <table class="cmd-rank-table">
        <thead>
          <tr><th>Plaka</th><th>Gelir</th><th>Gider</th><th>Net</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function commandInsightCompact({ mainAlert, insight1, insight2, fullText }) {
  const detailId = "cmdInsightDetail";
  return `<aside class="cmd-insight cmd-insight--compact fade-in">
    <div class="cmd-insight__head">
      <span class="cmd-insight__badge">AI Finans</span>
      <h3 class="cmd-insight__title">Özet</h3>
    </div>
    <p class="cmd-insight__alert">${escapeHtml(mainAlert)}</p>
    <ul class="cmd-insight__list">
      ${insight1 ? `<li>${escapeHtml(insight1)}</li>` : ""}
      ${insight2 ? `<li>${escapeHtml(insight2)}</li>` : ""}
    </ul>
    ${
      fullText
        ? `<details class="cmd-insight__details" id="${detailId}">
            <summary class="btn btn--ghost btn--sm">Detayları Gör</summary>
            <p class="cmd-insight__full">${escapeHtml(fullText)}</p>
          </details>`
        : ""
    }
  </aside>`;
}

function operationsCenter({ alerts, profitExpense }) {
  const fuel30 = alerts.fuel30;
  const hgs = alerts.hgs || { hasImport: false, latest: null };
  const hgsLatest = hgs.latest;
  const expenseOps = alerts.expenseOps || {};
  const breakdown = profitExpense || {};

  const fuelTotal = breakdown.fuel ?? fuel30?.totalCost ?? 0;
  const hgsTotal = breakdown.hgs ?? expenseOps.hgs?.total ?? 0;
  const maintTotal = breakdown.maintenance ?? expenseOps.bakim?.total ?? 0;
  const otherTotal = breakdown.other ?? expenseOps.other?.total ?? 0;

  const hgsValueHtml =
    hgs.hasImport && hgsLatest
      ? `<strong class="cmd-ops__value">${money(hgsTotal)}</strong>
        <span class="cmd-ops__sub cmd-ops__sub--hgs">${escapeHtml(hgsLatest.plate_normalized || hgsLatest.vehicle_plate || "—")} · son import ${Number(hgsLatest.passage_count || 0).toLocaleString("tr-TR")} geçiş</span>`
      : `<strong class="cmd-ops__value">${money(hgsTotal)}</strong>
        <span class="cmd-ops__sub cmd-ops__sub--hgs">Filo HGS/OGS gider toplamı</span>`;

  return `<section class="cmd-panel cmd-panel--ops fade-in">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Gider Operasyon Merkezi</h3>
        <p class="cmd-panel__desc">Operasyonel gider özeti · detay için Gider Yönetimi</p>
      </div>
      <a href="/expenses" class="btn btn--ghost btn--sm">Gider Yönetimi →</a>
    </header>
    <div class="cmd-panel__body cmd-ops cmd-ops--expense-hub">
      <div class="cmd-ops__stat cmd-ops__stat--fuel">
        <span class="cmd-ops__label">Yakıt</span>
        <strong class="cmd-ops__value cmd-ops__value--fuel">${money(fuelTotal)}</strong>
        <span class="cmd-ops__sub">Filo gider toplamı · ${Number(fuel30?.totalLiters || 0).toLocaleString("tr-TR")} L (30g)</span>
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--hgs">
        <span class="cmd-ops__label">HGS / OGS</span>
        ${hgsValueHtml}
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--maint">
        <span class="cmd-ops__label">Bakım &amp; Onarım</span>
        <strong class="cmd-ops__value">${money(maintTotal)}</strong>
        <span class="cmd-ops__sub">Filo bakım gider toplamı</span>
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--other">
        <span class="cmd-ops__label">Diğer Giderler</span>
        <strong class="cmd-ops__value">${money(otherTotal)}</strong>
        <span class="cmd-ops__sub">Sigorta, vergi, personel vb.</span>
      </div>
    </div>
  </section>`;
}

function financeTrendsPanel() {
  return `<section class="cmd-panel cmd-panel--chart fade-in">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Aylık Finansal Trend</h3>
        <p class="cmd-panel__desc">Son 6 ay gelir, gider ve nakit akışı</p>
      </div>
      <a href="/reports" class="btn btn--ghost btn--sm">Analizler</a>
    </header>
    <div class="cmd-panel__body cmd-chart-area">
      <div class="chart-wrap chart-wrap--command"><canvas id="monthlyChart"></canvas></div>
    </div>
  </section>`;
}

function financialMovementsPanel(transactions) {
  if (!transactions.length) {
    return `<section class="cmd-panel cmd-panel--movements fade-in">
      <header class="cmd-panel__head">
        <div>
          <h3 class="cmd-panel__title">Son Operasyonel Hareketler</h3>
          <p class="cmd-panel__desc">Gelir ve gider akışı</p>
        </div>
      </header>
      <div class="cmd-panel__body"><div class="empty empty--sm"><p>Henüz işlem yok</p></div></div>
    </section>`;
  }

  const rows = transactions
    .map((t) => {
      const inc = t.type === "income";
      const plate = t.plate || (t.vehicle_id ? "—" : "Ortak");
      return `<tr class="cmd-move-row">
        <td class="cmd-move-row__date">${escapeHtml(String(t.date || "").slice(0, 16))}</td>
        <td><span class="cmd-move-row__type cmd-move-row__type--${inc ? "in" : "out"}">${inc ? "Gelir" : "Gider"}</span></td>
        <td class="cmd-move-row__plate">${escapeHtml(plate)}</td>
        <td>${escapeHtml(t.category || "—")}</td>
        <td class="cmd-move-row__note">${escapeHtml(t.note || "—")}</td>
        <td class="${inc ? "text-pos" : "text-neg"}"><strong>${money(t.amount)}</strong></td>
      </tr>`;
    })
    .join("");

  return `<section class="cmd-panel cmd-panel--movements fade-in">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Son Operasyonel Hareketler</h3>
        <p class="cmd-panel__desc">Kurumsal işlem akışı — yalnızca bu alan kaydırılır</p>
      </div>
      <a href="/income/service" class="btn btn--ghost btn--sm">Tümü</a>
    </header>
    <div class="cmd-panel__body cmd-move-scroll">
      <table class="cmd-move-table">
        <colgroup>
          <col class="cmd-move-col cmd-move-col--date"/>
          <col class="cmd-move-col cmd-move-col--type"/>
          <col class="cmd-move-col cmd-move-col--plate"/>
          <col class="cmd-move-col cmd-move-col--cat"/>
          <col class="cmd-move-col cmd-move-col--note"/>
          <col class="cmd-move-col cmd-move-col--amt"/>
        </colgroup>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>İşlem</th>
            <th>Araç</th>
            <th>Kategori</th>
            <th>Açıklama</th>
            <th>Tutar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function splitInsightText(text) {
  const parts = String(text || "")
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const withDot = (s) => (s.endsWith(".") ? s : s + ".");
  return {
    mainAlert: parts[0] ? withDot(parts[0]) : "Filo verisi analiz ediliyor.",
    insight1: parts[1] ? withDot(parts[1]) : "",
    insight2: parts[2] ? withDot(parts[2]) : "",
    fullText: parts.slice(3).map(withDot).join(" "),
  };
}

module.exports = {
  commandHeader,
  executiveFinancialPanel,
  executiveProfitSummary,
  vehicleProfitRankPanel,
  commandInsightCompact,
  operationsCenter,
  financeTrendsPanel,
  financialMovementsPanel,
  splitInsightText,
};
