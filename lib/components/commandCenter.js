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
        <a href="/income/service" class="btn btn--sm btn--primary btn--compact">+ Gelir</a>
        <a href="/expenses" class="btn btn--sm btn--ghost btn--compact">+ Gider</a>
        <a href="/fuel" class="btn btn--sm btn--ghost">Yakıt</a>
        <a href="/reports" class="btn btn--sm btn--ghost">Analiz</a>
      </div>
    </div>
  </header>`;
}

function executiveFinancialPanel({ totals, netTone, servisIncome, turizmIncome }) {
  return `<section class="cmd-kpi-row fade-in">
    <article class="cmd-kpi-card cmd-kpi-card--hero cmd-kpi-card--${netTone}">
      <span class="cmd-kpi-card__label">Net Durum</span>
      <strong class="cmd-kpi-card__value ${netTone === "profit" ? "text-pos" : "text-neg"}">${money(totals.balance)}</strong>
    </article>
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
      <strong class="cmd-kpi-card__value text-neg">${money(totals.expense)}</strong>
    </article>
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

function operationsCenter({ alerts }) {
  const fuel30 = alerts.fuel30;
  const hgs = alerts.hgs || { hasImport: false, latest: null };
  const hgsLatest = hgs.latest;
  const expenseOps = alerts.expenseOps || {};
  const upcomingCount = alerts.upcomingCount || 0;
  const nextMaint = alerts.upcoming?.[0];

  const hgsValueHtml =
    hgs.hasImport && hgsLatest
      ? `<strong class="cmd-ops__value">${money(hgsLatest.passage_total || 0)}</strong>
        <span class="cmd-ops__sub cmd-ops__sub--hgs">${escapeHtml(hgsLatest.plate_normalized || hgsLatest.vehicle_plate || "—")} · ${Number(hgsLatest.passage_count || 0).toLocaleString("tr-TR")} geçiş</span>`
      : `<strong class="cmd-ops__placeholder">PDF Import hazır</strong>
        <span class="cmd-ops__sub cmd-ops__sub--hgs">İş Bankası HGS PDF içe aktarma aktif</span>`;

  const maintValueHtml =
    upcomingCount > 0
      ? `<strong class="cmd-ops__value">${upcomingCount}</strong>
        <span class="cmd-ops__sub">${escapeHtml(nextMaint?.description || nextMaint?.type || "Yaklaşan bakım")}${nextMaint?.next_service_date ? ` · ${escapeHtml(nextMaint.next_service_date)}` : ""}</span>`
      : `<strong class="cmd-ops__placeholder">Planlı bakım yok</strong>
        <span class="cmd-ops__sub">Bakım takvimi güncel</span>`;

  const otherTotal = expenseOps.other?.total || 0;
  const otherCount = expenseOps.other?.count || 0;

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
        <strong class="cmd-ops__value cmd-ops__value--fuel">${money(fuel30.totalCost)}</strong>
        <span class="cmd-ops__sub">Son 30 gün · ${Number(fuel30.totalLiters).toLocaleString("tr-TR")} L</span>
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--hgs">
        <span class="cmd-ops__label">HGS / OGS</span>
        ${hgsValueHtml}
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--maint">
        <span class="cmd-ops__label">Bakım &amp; Onarım</span>
        ${maintValueHtml}
      </div>
      <div class="cmd-ops__stat cmd-ops__stat--other">
        <span class="cmd-ops__label">Diğer Giderler</span>
        <strong class="cmd-ops__value">${money(otherTotal)}</strong>
        <span class="cmd-ops__sub">Son 30 gün · ${Number(otherCount).toLocaleString("tr-TR")} kayıt</span>
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
  commandInsightCompact,
  operationsCenter,
  financeTrendsPanel,
  financialMovementsPanel,
  splitInsightText,
};
