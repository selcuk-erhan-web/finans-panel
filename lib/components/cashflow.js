const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatDateDisplay } = require("../../utils/date");
const { OBLIGATION_GROUP_LABELS } = require("../../services/cashflowService");

function cashToneClass(value) {
  if (value > 0) return "text-pos";
  if (value < 0) return "text-neg";
  return "";
}

function receivablesTable(items) {
  const rows = items.length
    ? items
        .map(
          (r) => `<tr>
          <td>${escapeHtml(r.customer)}</td>
          <td><strong>${money(r.amount)}</strong></td>
          <td>${escapeHtml(r.status)}</td>
          <td>${formatDateDisplay(r.expectedDate)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">30 gün içinde beklenen tahsilat yok.</td></tr>`;

  return `<table class="data-table cashflow-table">
    <thead><tr><th>Müşteri</th><th>Tutar</th><th>Durum</th><th>Beklenen Tarih</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function obligationGroupTable(title, items) {
  if (!items.length) {
    return `<section class="cashflow-group">
      <h3 class="cashflow-group__title">${escapeHtml(title)}</h3>
      <p class="cashflow-group__empty">Kayıt yok.</p>
    </section>`;
  }

  const rows = items
    .map(
      (r) => `<tr class="${r.infoOnly ? "cashflow-row--info" : ""}">
      <td>${escapeHtml(r.title)}</td>
      <td>${r.infoOnly ? "—" : `<strong>${money(r.amount)}</strong>`}</td>
      <td>${formatDateDisplay(r.dueDate)}</td>
      <td>${escapeHtml(r.status)}</td>
    </tr>`
    )
    .join("");

  return `<section class="cashflow-group">
    <h3 class="cashflow-group__title">${escapeHtml(title)}</h3>
    <div class="table-wrap">
      <table class="data-table cashflow-table">
        <thead><tr><th>Açıklama</th><th>Tutar</th><th>Vade</th><th>Durum</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function timelineList(events) {
  if (!events.length) {
    return `<p class="cashflow-timeline-empty">30 günlük nakit takviminde hareket yok.</p>`;
  }

  return `<ol class="cashflow-timeline">
    ${events
      .map((ev) => {
        const sign = ev.direction === "in" ? "+" : ev.infoOnly ? "" : "−";
        const amountText = ev.infoOnly ? escapeHtml(ev.detail) : `${sign}${money(Math.abs(ev.amount))} ${escapeHtml(ev.label)}`;
        const tone =
          ev.direction === "in" ? "cashflow-timeline__item--in" : ev.infoOnly ? "cashflow-timeline__item--info" : "cashflow-timeline__item--out";
        return `<li class="cashflow-timeline__item ${tone}">
          <span class="cashflow-timeline__date">${escapeHtml(ev.dateLabel)}</span>
          <strong class="cashflow-timeline__amount">${amountText}</strong>
          ${ev.infoOnly ? "" : `<span class="cashflow-timeline__detail">${escapeHtml(ev.detail || "")}</span>`}
        </li>`;
      })
      .join("")}
  </ol>`;
}

function cashflowDashboardCard(card) {
  if (!card) return "";
  const tone = card.tone || "neutral";
  const cls = cashToneClass(card.netExpectedCash);
  const prefix = card.netExpectedCash > 0 ? "+" : "";
  return `<article class="cmd-kpi-card cmd-kpi-card--cashflow cmd-kpi-card--${tone}">
    <span class="cmd-kpi-card__label">Beklenen Nakit</span>
    <strong class="cmd-kpi-card__value ${cls}">${prefix}${money(card.netExpectedCash)}</strong>
    <span class="cmd-kpi-card__sub">30 gün · <a href="/cashflow" class="cashflow-card-link">Detay →</a></span>
  </article>`;
}

function cashflowPageHtml({ summary, receivables, obligations, timeline }) {
  const netClass = cashToneClass(summary.netExpectedCash);
  const netPrefix = summary.netExpectedCash > 0 ? "+" : "";

  return `<div class="dash page-enter cashflow-hub">
    <header class="cashflow-hub__header fade-in">
      <p class="cashflow-hub__eyebrow">Filo Finans · Nakit Planlama</p>
      <h2 class="cashflow-hub__title">Nakit Akışı ve Yükümlülük Merkezi</h2>
      <p class="cashflow-hub__desc">Önümüzdeki ${summary.windowDays} günde beklenen tahsilatlar, yaklaşan yükümlülükler ve net nakit pozisyonu · salt okunur analiz</p>
    </header>

    <div class="cashflow-kpi-row fade-in">
      <article class="cashflow-kpi cashflow-kpi--in">
        <span>Toplam Beklenen Tahsilat</span>
        <strong class="text-pos">+${money(summary.totalExpectedReceivables)}</strong>
      </article>
      <article class="cashflow-kpi cashflow-kpi--out">
        <span>Toplam Beklenen Gider</span>
        <strong class="text-neg">−${money(summary.totalUpcomingObligations)}</strong>
      </article>
      <article class="cashflow-kpi cashflow-kpi--net">
        <span>Net Beklenen Nakit</span>
        <strong class="${netClass}">${netPrefix}${money(summary.netExpectedCash)}</strong>
      </article>
    </div>

    <div class="grid2 fade-in">
      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Beklenen Tahsilatlar</h2>
            <p class="panel__desc">Hakediş doğrulama (eşleşen/eksik/fazla) + gelir kayıtları · ${receivables.items.length} kalem</p>
          </div>
        </header>
        <div class="panel__body table-wrap">${receivablesTable(receivables.items)}</div>
      </section>

      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">30 Günlük Takvim</h2>
            <p class="panel__desc">Bugünden itibaren sıralı nakit hareketleri</p>
          </div>
        </header>
        <div class="panel__body">${timelineList(timeline)}</div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Yaklaşan Yükümlülükler</h2>
          <p class="panel__desc">SGK, Muhtasar, maaş, taşeron ve bilgi amaçlı evrak takibi</p>
        </div>
      </header>
      <div class="panel__body cashflow-obligation-grid">
        ${obligationGroupTable(OBLIGATION_GROUP_LABELS.sgk, obligations.groups.sgk)}
        ${obligationGroupTable(OBLIGATION_GROUP_LABELS.muhtasar, obligations.groups.muhtasar)}
        ${obligationGroupTable(OBLIGATION_GROUP_LABELS.personnel, obligations.groups.personnel)}
        ${obligationGroupTable(OBLIGATION_GROUP_LABELS.subcontractor, obligations.groups.subcontractor)}
        ${obligationGroupTable(`${OBLIGATION_GROUP_LABELS.document} (bilgi)`, obligations.groups.document)}
      </div>
    </section>
  </div>`;
}

module.exports = {
  cashflowPageHtml,
  cashflowDashboardCard,
  receivablesTable,
  timelineList,
};
