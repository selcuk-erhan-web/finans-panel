const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { typeBadge, statusPill, vehicleEmoji } = require("./fleet");

function welcomeBanner({ vehicleCount, target, totals, fleetStatus }) {
  const tone = fleetStatus.tone || "neutral";
  return `<section class="welcome fade-in" style="--delay:0ms">
    <div class="welcome__glow"></div>
    <div class="welcome__content">
      <div class="welcome__left">
        <p class="welcome__greet">Hoş geldiniz <span class="welcome__wave">👋</span></p>
        <h2 class="welcome__title">MISTUR FleetOS</h2>
        <p class="welcome__sub">
          <strong>${vehicleCount}</strong> / ${target} araç aktif ·
          Net <strong class="${totals.balance >= 0 ? "text-pos" : "text-neg"}">${money(totals.balance)}</strong>
        </p>
      </div>
      <div class="welcome__right">
        <div class="live-clock">
          <span class="live-clock__date" id="liveDate">—</span>
          <span class="live-clock__time" id="liveTime">—</span>
        </div>
        <div class="welcome__fleet">
          <span class="welcome__fleet-label">Filo durumu</span>
          <span class="welcome__tag welcome__tag--${tone}">${escapeHtml(fleetStatus.label)}</span>
        </div>
      </div>
    </div>
  </section>`;
}

function premiumInsight(text) {
  return `<aside class="insight insight--premium fade-in" style="--delay:120ms">
    <div class="insight__shine"></div>
    <div class="insight__head">
      <div class="insight__icon-wrap">✦</div>
      <div>
        <div class="insight__badge">AI Finans Özeti</div>
        <h3 class="insight__title">Finans Yorumu</h3>
      </div>
    </div>
    <p class="insight__text">${escapeHtml(text)}</p>
    <div class="insight__foot">
      <span class="insight__dot"></span>
      <span>Gerçek zamanlı filo analizi</span>
    </div>
  </aside>`;
}

function expenseTimeline(expenses, limit = 6) {
  if (!expenses.length) {
    return `<div class="empty empty--sm fade-in">
      <div class="empty__icon">📋</div>
      <p>Henüz gider kaydı yok</p>
    </div>`;
  }
  const items = expenses.slice(0, limit).map(
    (t, i) => `<div class="timeline__item fade-in" style="--delay:${i * 60}ms">
      <div class="timeline__track"><div class="timeline__dot"></div></div>
      <div class="timeline__body">
        <div class="timeline__top">
          <span class="timeline__cat">${escapeHtml(t.category || "Gider")}</span>
          <span class="timeline__amt">${money(t.amount)}</span>
        </div>
        <p class="timeline__note">${escapeHtml(t.note || "—")}</p>
        <time class="timeline__date">${escapeHtml(String(t.date || "").slice(0, 16))}</time>
      </div>
    </div>`
  );
  return `<div class="timeline">${items.join("")}</div>`;
}

function monthlyMiniCards(monthly) {
  const n = monthly.labels.length;
  const cards = monthly.labels.map((label, i) => {
    const inc = monthly.incomeData[i] || 0;
    const exp = monthly.expenseData[i] || 0;
    const net = inc - exp;
    const netCls = net >= 0 ? "pos" : "neg";
    return `<div class="mini-month fade-in" style="--delay:${i * 50}ms">
      <span class="mini-month__label">${escapeHtml(label)}</span>
      <div class="mini-month__row"><span>Gelir</span><strong class="text-pos">${money(inc)}</strong></div>
      <div class="mini-month__row"><span>Gider</span><strong class="text-neg">${money(exp)}</strong></div>
      <div class="mini-month__net mini-month__net--${netCls}">${money(net)}</div>
    </div>`;
  });
  return `<div class="mini-month-grid">${cards.join("")}</div>`;
}

function expenseRatioBars(ratios) {
  if (!ratios.some((r) => r.amount > 0)) {
    return `<div class="empty empty--sm"><p>Oran analizi için gider kaydı gerekli</p></div>`;
  }
  return `<div class="ratio-list">${ratios
    .map(
      (r) => `<div class="ratio-item fade-in">
        <div class="ratio-item__head">
          <span class="ratio-item__icon">${r.icon}</span>
          <span class="ratio-item__name">${escapeHtml(r.name)}</span>
          <span class="ratio-item__pct">${r.pct}%</span>
        </div>
        <div class="progress"><div class="progress__bar progress__bar--${r.key}" style="width:${r.pct}%"></div></div>
        <span class="ratio-item__amt">${money(r.amount)}</span>
      </div>`
    )
    .join("")}</div>`;
}

function categoryCardGrid(expenseByCat) {
  const entries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return `<div class="empty"><div class="empty__icon">📊</div><h3>Kategori verisi yok</h3><p>Gider ekledikçe dağılım oluşur.</p></div>`;
  }
  const max = entries[0][1] || 1;
  const colors = ["indigo", "rose", "emerald", "amber", "violet", "cyan"];
  return `<div class="cat-card-grid">${entries
    .map(([name, amt], i) => {
      const pct = Math.round((amt / max) * 100);
      const c = colors[i % colors.length];
      return `<article class="cat-card cat-card--${c} fade-in" style="--delay:${i * 40}ms">
        <div class="cat-card__top">
          <span class="cat-card__name">${escapeHtml(name)}</span>
          <span class="cat-card__amt">${money(amt)}</span>
        </div>
        <div class="progress"><div class="progress__bar progress__bar--${c}" style="width:${pct}%"></div></div>
      </article>`;
    })
    .join("")}</div>`;
}

function vehicleRankCards(summaries, limit = 6) {
  if (!summaries.length) {
    return `<div class="empty empty--sm"><p>Sıralama için araç verisi yok</p></div>`;
  }
  return `<div class="rank-grid">${summaries
    .slice(0, limit)
    .map((v, i) => {
      const rank = i + 1;
      const state =
        v.income === 0 && v.expense === 0 ? "flat" : v.net >= 0 ? "up" : "down";
      return `<a href="/vehicle/${v.id}" class="rank-card rank-card--${state} fade-in" style="--delay:${i * 50}ms">
        <span class="rank-card__n">#${rank}</span>
        <div class="rank-card__body">
          <span class="rank-card__plate">${escapeHtml(v.plate)}</span>
          ${typeBadge(v.type)}
        </div>
        <span class="rank-card__net">${v.income === 0 && v.expense === 0 ? "—" : money(v.net)}</span>
        ${statusPill(v)}
      </a>`;
    })
    .join("")}</div>`;
}

function vehicleHeroLarge(v, summary) {
  const emoji = vehicleEmoji(v.type);
  const kmStr = v.km != null ? Number(v.km).toLocaleString("tr-TR") + " km" : "—";
  const s = summary;
  const state =
    s.income === 0 && s.expense === 0 ? "flat" : s.net >= 0 ? "up" : "down";

  return `<section class="vehicle-hero vehicle-hero--large vehicle-hero--${state} fade-in">
    <div class="vehicle-hero__bg"></div>
    <div class="vehicle-hero__icon">${emoji}</div>
    <div class="vehicle-hero__main">
      <h1 class="vehicle-hero__plate">${escapeHtml(v.plate)}</h1>
      <p class="vehicle-hero__meta">${escapeHtml(v.brand || "")} ${escapeHtml(v.model || "")} · ${escapeHtml(v.year || "—")} · ${kmStr}</p>
      <div class="vehicle-hero__badges">
        ${typeBadge(v.type)}
        ${statusPill(summary)}
      </div>
    </div>
    <div class="vehicle-hero__actions">
      <a href="/vehicle/edit/${v.id}" class="btn btn--ghost">Düzenle</a>
      <a href="/income?vehicle_id=${v.id}" class="btn btn--primary">+ Gelir</a>
      <a href="/expense?vehicle_id=${v.id}" class="btn btn--ghost">+ Gider</a>
      <a href="/vehicles" class="btn btn--ghost">← Filo</a>
    </div>
  </section>`;
}

function transactionTimeline(transactions) {
  if (!transactions.length) {
    return `<div class="empty empty--sm"><p>Henüz işlem yok</p></div>`;
  }
  return `<div class="timeline timeline--mixed">${transactions
    .map((t, i) => {
      const inc = t.type === "income";
      return `<div class="timeline__item fade-in" style="--delay:${i * 40}ms">
        <div class="timeline__track"><div class="timeline__dot timeline__dot--${inc ? "in" : "out"}"></div></div>
        <div class="timeline__body">
          <div class="timeline__top">
            <span class="timeline__cat">${escapeHtml(t.plate || "—")} · ${escapeHtml(t.category || (inc ? "Gelir" : "Gider"))}</span>
            <span class="timeline__amt ${inc ? "text-pos" : "text-neg"}">${inc ? "+" : "-"}${Number(t.amount || 0).toLocaleString("tr-TR")} TL</span>
          </div>
          <p class="timeline__note">${escapeHtml(t.note || "—")}</p>
          <time class="timeline__date">${escapeHtml(String(t.date || "").slice(0, 16))}</time>
        </div>
      </div>`;
    })
    .join("")}</div>`;
}

function taskList(items, emptyText = "Bugün görev yok") {
  if (!items.length) return `<div class="empty empty--sm"><p>${emptyText}</p></div>`;
  return `<ul class="task-list">${items
    .map(
      (m) =>
        `<li class="task-list__item task-list__item--${m.status || "pending"}">
          <strong>${escapeHtml(m.plate || "—")}</strong>
          <span>${escapeHtml(m.type_label || m.title || "")}</span>
          <em>${escapeHtml(m.due_date || "")}</em>
        </li>`
    )
    .join("")}</ul>`;
}

function rankListMini(summaries) {
  if (!summaries.length) return `<div class="empty empty--sm"><p>Araç verisi yok</p></div>`;
  return `<div class="rank-mini">${summaries
    .map((v, i) => {
      const state =
        v.income === 0 && v.expense === 0 ? "flat" : v.net >= 0 ? "up" : "down";
      return `<a href="/vehicle/${v.id}" class="rank-mini__row rank-mini__row--${state}">
        <span class="rank-mini__n">#${i + 1}</span>
        <span class="rank-mini__plate">${escapeHtml(v.plate)}</span>
        <span class="rank-mini__net">${v.income === 0 && v.expense === 0 ? "—" : Number(v.net).toLocaleString("tr-TR") + " TL"}</span>
      </a>`;
    })
    .join("")}</div>`;
}

module.exports = {
  vehicleEmoji,
  welcomeBanner,
  transactionTimeline,
  taskList,
  rankListMini,
  premiumInsight,
  expenseTimeline,
  monthlyMiniCards,
  expenseRatioBars,
  categoryCardGrid,
  vehicleRankCards,
  vehicleHeroLarge,
};
