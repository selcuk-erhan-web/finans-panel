const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { chartOpts } = require("../charts");
const { kpiValueHtml, metricCard, metricGrid } = require("./kpi");
const { receivablesTable } = require("./cashflow");
const { formatDateDisplay } = require("../../utils/date");

function chartBoot(scripts) {
  const code = scripts.filter(Boolean).join("\n");
  return code ? `<script>${code}</script>` : "";
}

const MODULE_LINKS = [
  { href: "/income/service", label: "Servis Gelirleri", tone: "service" },
  { href: "/income/tourism", label: "Turizm Gelirleri", tone: "tourism" },
  { href: "/income/other", label: "Diğer Gelirler", tone: "other" },
  { href: "/reconciliation", label: "Hakediş Kontrol", tone: "reconcile" },
];

function recentIncomeTable(rows) {
  if (!rows.length) {
    return `<div class="income-hub-empty">
      <p class="income-hub-empty__title">Henüz gelir hareketi bulunmuyor</p>
      <p class="income-hub-empty__hint">İlk kaydı oluşturun · Veri geldikçe analiz üretilecektir</p>
      <a href="/income/service" class="btn btn--primary btn--sm">Servis Geliri Ekle</a>
    </div>`;
  }

  const body = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.plate || "—")}</td>
        <td>${escapeHtml(r.category || "—")}</td>
        <td><strong>${money(r.amount)}</strong></td>
        <td>${escapeHtml(r.note || "—")}</td>
        <td>${formatDateDisplay(r.date)}</td>
        <td class="data-table__actions">
          <a href="/income/edit/${r.id}" class="btn btn--sm btn--ghost">Düzenle</a>
        </td>
      </tr>`
    )
    .join("");

  return `<div class="table-wrap">
    <table class="data-table data-table--compact">
      <thead><tr><th>Araç</th><th>Kategori</th><th>Tutar</th><th>Açıklama</th><th>Tarih</th><th></th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function distributionBars(totals, grandTotal) {
  const items = [
    { key: "service", label: "Servis", tone: "service", amount: totals.service },
    { key: "tourism", label: "Turizm", tone: "tourism", amount: totals.tourism },
    { key: "other", label: "Diğer", tone: "other", amount: totals.other },
  ];

  if (!grandTotal) {
    return `<div class="income-hub-empty income-hub-empty--compact">
      <p class="income-hub-empty__title">Henüz veri bulunmuyor</p>
      <p class="income-hub-empty__hint">İlk kaydı oluşturun · Veri geldikçe analiz üretilecektir</p>
    </div>`;
  }

  return `<div class="income-dist">
    ${items
      .map((item) => {
        const pct = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0;
        return `<div class="income-dist__row income-dist__row--${item.tone}">
          <div class="income-dist__head">
            <span>${escapeHtml(item.label)}</span>
            <strong>${money(item.amount)} · %${pct}</strong>
          </div>
          <div class="progress"><div class="progress__bar progress__bar--${item.tone}" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("")}
  </div>`;
}

function incomeHubPageHtml(bundle) {
  const { totals, grandTotal, monthly, recent, receivables } = bundle;
  const moduleLinks = MODULE_LINKS.map(
    (m) => `<a href="${m.href}" class="income-hub-link income-hub-link--${m.tone}">${escapeHtml(m.label)} →</a>`
  ).join("");

  const kpiCards = metricGrid(
    [
      metricCard({
        label: "Toplam Servis Geliri",
        amount: totals.service,
        tone: "income",
        icon: "🚐",
        desc: totals.service ? "Servis hat gelirleri" : undefined,
      }),
      metricCard({
        label: "Toplam Turizm Geliri",
        amount: totals.tourism,
        tone: "income",
        icon: "🚙",
        desc: totals.tourism ? "Turizm operasyon gelirleri" : undefined,
      }),
      metricCard({
        label: "Toplam Diğer Gelir",
        amount: totals.other,
        tone: "income",
        icon: "📋",
        desc: totals.other ? "Diğer gelir kategorileri" : undefined,
      }),
      metricCard({
        label: "Beklenen Tahsilat",
        amount: receivables.total,
        tone: "profit",
        icon: "◆",
        desc: receivables.total ? `30 gün · ${receivables.items.length} kalem` : undefined,
        hint: receivables.total ? undefined : "Hakediş ve gelir kayıtlarından",
      }),
    ],
    "4"
  );

  const chartScript = chartBoot([
    `new Chart(document.getElementById("incomeTrendChart"),{
      type:"line",
      data:{labels:${JSON.stringify(monthly.labels)},datasets:[{
        label:"Gelir",
        data:${JSON.stringify(monthly.incomeData)},
        borderColor:"#10b981",
        backgroundColor:"rgba(16,185,129,0.15)",
        fill:true,
        tension:0.35,
        pointRadius:4,
        pointHoverRadius:6
      }]},
      options:${chartOpts({ plugins: { legend: { display: false } } })}
    });`,
    grandTotal
      ? `new Chart(document.getElementById("incomeDistChart"),{
      type:"doughnut",
      data:{
        labels:["Servis","Turizm","Diğer"],
        datasets:[{
          data:[${totals.service},${totals.tourism},${totals.other}],
          backgroundColor:["#6366f1","#10b981","#f59e0b"],
          borderWidth:0
        }]
      },
      options:{plugins:{legend:{position:"bottom",labels:{usePointStyle:true,padding:14,font:{size:11,weight:"600"}}}},cutout:"62%"}
    });`
      : "",
  ]);

  const receivablesBody =
    receivables.items.length > 0
      ? receivablesTable(receivables.items.slice(0, 6))
      : `<div class="income-hub-empty income-hub-empty--compact">
          <p class="income-hub-empty__title">30 gün içinde beklenen tahsilat yok</p>
          <p class="income-hub-empty__hint">Hakediş PDF içe aktarın veya gelir kaydı girin</p>
          <a href="/cashflow" class="btn btn--ghost btn--sm">Nakit Akışı →</a>
        </div>`;

  return `<div class="dash page-enter dash--dense income-hub income-hub--dashboard">
    <header class="income-hub__header">
      <p class="income-hub__eyebrow">Finans · Gelir Yönetimi</p>
      <h2 class="income-hub__title">Gelir Yönetimi Merkezi</h2>
      <p class="income-hub__desc">Tüm gelir akışlarının özeti — detay kayıtlar alt modüllerde yönetilir.</p>
      <div class="income-hub__links">${moduleLinks}</div>
    </header>

    ${kpiCards}

    <div class="income-hub-mid grid2">
      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Aylık Gelir Trendi</h2>
            <p class="panel__desc">Son 6 ay · tüm gelir kategorileri</p>
          </div>
        </header>
        <div class="panel__body">
          ${
            monthly.incomeData.some((v) => v > 0)
              ? `<div class="chart-wrap chart-wrap--modern"><canvas id="incomeTrendChart"></canvas></div>`
              : `<div class="income-hub-empty income-hub-empty--compact">
                  <p class="income-hub-empty__title">Henüz veri bulunmuyor</p>
                  <p class="income-hub-empty__hint">İlk kaydı oluşturun · Veri geldikçe analiz üretilecektir</p>
                </div>`
          }
        </div>
      </section>

      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Gelir Dağılımı</h2>
            <p class="panel__desc">Kategori bazlı pay · toplam ${grandTotal ? money(grandTotal) : "—"}</p>
          </div>
        </header>
        <div class="panel__body income-hub-dist-body">
          ${
            grandTotal
              ? `<div class="income-hub-dist-split">
                  <div class="chart-wrap chart-wrap--donut"><canvas id="incomeDistChart"></canvas></div>
                  ${distributionBars(totals, grandTotal)}
                </div>`
              : distributionBars(totals, grandTotal)
          }
        </div>
      </section>
    </div>

    <div class="income-hub-mid grid2">
      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Son Gelir Hareketleri</h2>
            <p class="panel__desc">En son ${recent.length} kayıt</p>
          </div>
          <a href="/income/service" class="btn btn--ghost btn--sm">Tümü →</a>
        </header>
        <div class="panel__body">${recentIncomeTable(recent)}</div>
      </section>

      <section class="panel">
        <header class="panel__head">
          <div>
            <h2 class="panel__title">Beklenen Tahsilatlar</h2>
            <p class="panel__desc">30 gün · ${receivables.total ? money(receivables.total) : "tahsilat beklenmiyor"}</p>
          </div>
          <a href="/cashflow" class="btn btn--ghost btn--sm">Nakit Akışı →</a>
        </header>
        <div class="panel__body">${receivablesBody}</div>
      </section>
    </div>
  </div>
  ${chartScript}`;
}

module.exports = { incomeHubPageHtml, MODULE_LINKS };
