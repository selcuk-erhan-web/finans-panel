const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatPlateDisplay } = require("../../utils/plate");
const { formatDateDisplay } = require("../../utils/date");
const { chartOpts } = require("../charts");
const { metricCard, metricGrid, kpiValueHtml } = require("./kpi");
const { typeBadge, statusPill, vehicleEmoji } = require("./fleet");
const { transactionTimeline } = require("./saas");
const { glassPanel, modernTable } = require("./table");
const {
  maintenanceHistorySummaryHtml,
  maintenanceHistoryRowsHtml,
} = require("./maintenanceCenter");
const { vehicleSchedulePreviewHtml } = require("./maintenanceSchedule");
const { tireStatusSectionHtml } = require("./tireCenter");
const { tireChangeHistorySectionHtml } = require("./tireHistory");
const { tireSeasonalStatusSectionHtml } = require("./tireSeasonalSchedule");
const { vehicleIntelligenceSummaryHtml } = require("./vehicleIntelligence");
const { vehicleHealthSummaryHtml } = require("./vehicleHealth");
const { vehicleTimelinePreviewHtml } = require("./vehicleTimeline");
const { vehicleProfitRiskSummaryHtml } = require("./vehicleProfitRisk");

function chartBoot(scripts) {
  const code = scripts.filter(Boolean).join("\n");
  return code ? `<script>${code}</script>` : "";
}

function vehicleEmptyBlock({ title, hint, actionHref, actionLabel }) {
  return `<div class="vc-empty">
    <p class="vc-empty__title">${escapeHtml(title)}</p>
    <p class="vc-empty__hint">${escapeHtml(hint || "Araç bazlı veri geldikçe analiz üretilecektir")}</p>
    ${actionHref ? `<a href="${actionHref}" class="btn btn--ghost btn--sm">${escapeHtml(actionLabel || "Kayıt Ekle")}</a>` : ""}
  </div>`;
}

function vehicleHeaderHtml(bundle) {
  const { vehicle, summary } = bundle;
  const km = vehicle.current_km ?? vehicle.km;
  const kmStr =
    km != null && Number(km) > 0 ? `${Number(km).toLocaleString("tr-TR")} km` : "—";
  const meta = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || "—";
  const state =
    summary.income === 0 && summary.expense === 0 ? "flat" : summary.net >= 0 ? "up" : "down";

  return `<section class="vehicle-hero vehicle-hero--large vehicle-hero--${state} vc-header fade-in">
    <div class="vehicle-hero__bg"></div>
    <div class="vehicle-hero__icon">${vehicleEmoji(vehicle.type)}</div>
    <div class="vehicle-hero__main">
      <p class="vc-header__eyebrow">Araç Merkezi V2</p>
      <h1 class="vehicle-hero__plate">${escapeHtml(formatPlateDisplay(vehicle.plate) || vehicle.plate)}</h1>
      <p class="vehicle-hero__meta">${escapeHtml(meta)}</p>
      <div class="vc-header__facts">
        <span class="vc-header__fact"><em>Tip</em>${typeBadge(vehicle.type)}</span>
        <span class="vc-header__fact"><em>KM</em><strong>${kmStr}</strong></span>
        <span class="vc-header__fact"><em>Durum</em>${statusPill(summary)}</span>
      </div>
    </div>
    <div class="vehicle-hero__actions">
      <a href="/vehicle/edit/${vehicle.id}" class="btn btn--ghost btn--sm">Düzenle</a>
      <a href="/income/service?vehicle_id=${vehicle.id}" class="btn btn--primary btn--sm">+ Gelir</a>
      <a href="/expenses?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">+ Gider</a>
      <a href="/vehicles" class="btn btn--ghost btn--sm">← Filo</a>
    </div>
  </section>`;
}

function financialKpiHtml(bundle) {
  const { profit, incomeBySlug } = bundle;
  const netTone = profit.netProfit > 0 ? "profit" : profit.netProfit < 0 ? "loss" : "neutral";

  const row1 = metricGrid(
    [
      metricCard({ label: "Toplam Gelir", amount: profit.income, tone: "income", icon: "↑" }),
      metricCard({ label: "Servis Geliri", amount: incomeBySlug.service, tone: "income", icon: "🚐" }),
      metricCard({ label: "Turizm Geliri", amount: incomeBySlug.tourism, tone: "income", icon: "🚙" }),
      metricCard({ label: "Diğer Gelir", amount: incomeBySlug.other, tone: "income", icon: "📋" }),
    ],
    "4"
  );

  const row2 = metricGrid(
    [
      metricCard({ label: "Toplam Gider", amount: profit.totalExpense, tone: "expense", icon: "↓" }),
      metricCard({ label: "Yakıt", amount: profit.fuel, tone: "fleet", icon: "⛽" }),
      metricCard({ label: "HGS / OGS", amount: profit.hgs, tone: "fleet", icon: "🛣" }),
      metricCard({ label: "Bakım", amount: profit.maintenance, tone: "fleet", icon: "🔧" }),
    ],
    "4"
  );

  const row3 = metricGrid(
    [
      metricCard({ label: "Personel Payı", amount: profit.personnel, tone: "expense", icon: "👤" }),
      metricCard({ label: "SGK / Muhtasar Payı", amount: profit.payrollAllocated, tone: "expense", icon: "📑" }),
      metricCard({ label: "Taşeron Payı", amount: profit.subcontractor, tone: "expense", icon: "🤝" }),
      metricCard({
        label: "Net Kâr",
        amount: profit.netProfit,
        tone: netTone,
        icon: "◆",
        desc:
          profit.income || profit.totalExpense
            ? profit.netProfit >= 0
              ? "Kârlı araç"
              : "Zararda"
            : undefined,
      }),
    ],
    "4"
  );

  return `<section class="vc-section">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Finansal KPI</h2>
      <p class="vc-section__desc">Kârlılık motoru · araç bazlı gelir ve gider dağılımı</p>
    </header>
    ${row1}
    ${row2}
    ${row3}
  </section>`;
}

function analysisSectionHtml(bundle) {
  const { monthly, profit, incomeBySlug, benchmarks, vehicle } = bundle;
  const grandIncome = incomeBySlug.service + incomeBySlug.tourism + incomeBySlug.other;
  const expenseTotal = profit.totalExpense;
  const margin =
    profit.profitMargin != null
      ? `${Number(profit.profitMargin).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : "—";

  const incomeDistRows = [
    ["Servis", incomeBySlug.service],
    ["Turizm", incomeBySlug.tourism],
    ["Diğer", incomeBySlug.other],
  ]
    .filter(([, amt]) => amt > 0)
    .map(([label, amt]) => {
      const pct = grandIncome > 0 ? Math.round((amt / grandIncome) * 100) : 0;
      return `<tr><td>${escapeHtml(label)}</td><td class="text-pos"><strong>${money(amt)}</strong></td><td>${pct}%</td></tr>`;
    });

  const expenseDistRows = [
    ["Yakıt", profit.fuel],
    ["HGS / OGS", profit.hgs],
    ["Bakım", profit.maintenance],
    ["Personel", profit.personnel],
    ["SGK / Muhtasar", profit.payrollAllocated],
    ["Taşeron", profit.subcontractor],
    ["Diğer", profit.other],
  ]
    .filter(([, amt]) => amt > 0)
    .map(([label, amt]) => {
      const pct = expenseTotal > 0 ? Math.round((amt / expenseTotal) * 100) : 0;
      return `<tr><td>${escapeHtml(label)}</td><td class="text-neg"><strong>${money(amt)}</strong></td><td>${pct}%</td></tr>`;
    });

  const trendChart = monthly.incomeData.some((v) => v > 0) || monthly.expenseData.some((v) => v > 0)
    ? `<div class="chart-wrap chart-wrap--modern"><canvas id="vcMonthlyChart"></canvas></div>`
    : vehicleEmptyBlock({
        title: "Henüz gelir veya gider kaydı yok",
        hint: "İlk kaydı oluşturun · Araç bazlı veri geldikçe analiz üretilecektir",
        actionHref: `/income/service?vehicle_id=${vehicle.id}`,
        actionLabel: "Gelir Ekle",
      });

  const profitStatus =
    profit.income > 0 || profit.totalExpense > 0
      ? `<div class="vc-profit-status vc-profit-status--${profit.netProfit >= 0 ? "up" : "down"}">
        <span class="vc-profit-status__label">Net kârlılık</span>
        <strong class="vc-profit-status__value">${money(profit.netProfit)}</strong>
        <span class="vc-profit-status__meta">Marj: ${margin} · Filo ort. net: ${money(benchmarks.avgNetProfit)}</span>
      </div>`
      : vehicleEmptyBlock({
          title: "Henüz gelir kaydı yok",
          hint: "Henüz gider kaydı yok · Araç bazlı veri geldikçe analiz üretilecektir",
        });

  const avgCostPanel = `<div class="vc-benchmark">
    <div class="vc-benchmark__item">
      <span>Bu araç toplam gider</span>
      <strong>${kpiValueHtml(profit.totalExpense)}</strong>
    </div>
    <div class="vc-benchmark__item">
      <span>Filo ortalama gider / araç</span>
      <strong>${kpiValueHtml(benchmarks.avgExpense)}</strong>
    </div>
    <div class="vc-benchmark__item">
      <span>Filo ortalama net kâr</span>
      <strong>${kpiValueHtml(benchmarks.avgNetProfit)}</strong>
    </div>
  </div>`;

  return `<section class="vc-section">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Analiz</h2>
      <p class="vc-section__desc">6 aylık trend · gelir/gider dağılımı · kârlılık karşılaştırması</p>
    </header>
    <div class="vc-analysis-grid">
      ${glassPanel({
        title: "6 Aylık Gelir-Gider Trendi",
        body: trendChart,
      })}
      <div class="vc-analysis-side">
        ${glassPanel({ title: "Net Kârlılık Durumu", body: profitStatus })}
        ${glassPanel({ title: "Araç Başına Maliyet Karşılaştırması", body: avgCostPanel })}
      </div>
    </div>
    <div class="grid2 vc-dist-grid">
      ${glassPanel({
        title: "Gelir Dağılımı",
        body: modernTable(
          ["Kategori", "Tutar", "%"],
          incomeDistRows,
          { text: "Henüz gelir kaydı yok" }
        ),
      })}
      ${glassPanel({
        title: "Gider Dağılımı",
        body: modernTable(
          ["Kalem", "Tutar", "%"],
          expenseDistRows,
          { text: "Henüz gider kaydı yok" }
        ),
      })}
    </div>
  </section>`;
}

function maintenanceHistorySectionHtml(bundle) {
  const { vehicle, maintenanceHistory, maintenanceSchedule } = bundle;
  const { records, summary } = maintenanceHistory;
  const historyLimit = 8;
  const hasMore = records.length > historyLimit;

  return `<section class="vc-section" id="bakim-gecmisi">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Bakım Geçmişi</h2>
      <p class="vc-section__desc">Servis hafızası · tarih, KM, maliyet ve tedarikçi</p>
    </header>
    <div class="vc-maintenance-stack">
      ${vehicleSchedulePreviewHtml({ vehicle, schedulePreview: maintenanceSchedule })}
      <div class="vc-maintenance-stack__history">
        ${maintenanceHistorySummaryHtml(summary)}
        ${glassPanel({
          title: "Bakım Kayıtları",
          action: `<a href="/maintenance?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">${hasMore ? "Tüm geçmiş →" : "Bakım Merkezi →"}</a>`,
          body: `<div class="table-wrap mnt-history-table-wrap">
            <table class="data-table data-table--compact">
              <thead><tr>
                <th>Tarih</th><th>KM</th><th>Tür</th><th>Maliyet</th><th>Servis</th><th>Açıklama</th>
              </tr></thead>
              <tbody>${maintenanceHistoryRowsHtml(records, { limit: historyLimit })}</tbody>
            </table>
          </div>`,
        })}
      </div>
    </div>
  </section>`;
}

function operationsSectionHtml(bundle) {
  const { vehicle, recentTransactions, fuelStats, hgsRecords, maintenance, upcomingMaintenance, documents, alerts } =
    bundle;

  const alertsBody = alerts.length
    ? `<ul class="vc-alert-list">${alerts
        .map(
          (a) => `<li class="vc-alert-item vc-alert-item--${escapeHtml(a.severity)}">
            <strong>${escapeHtml(a.title)}</strong>
            <span>${escapeHtml(a.message || "")}</span>
          </li>`
        )
        .join("")}</ul>`
    : vehicleEmptyBlock({
        title: "Bu araç için aktif uyarı yok",
        hint: "Operasyonel riskler burada listelenir",
      });

  const fuelRows = fuelStats.recent.slice(0, 6).map(
    (f) => `<tr>
      <td>${Number(f.liter).toLocaleString("tr-TR")} L</td>
      <td>${money(f.total_amount)}</td>
      <td>${escapeHtml(f.fuel_date || "—")}</td>
    </tr>`
  );

  const hgsRows = hgsRecords.map(
    (h) => `<tr>
      <td>${money(h.amount)}</td>
      <td>${escapeHtml(h.note || "HGS / OGS")}</td>
      <td>${formatDateDisplay(h.date)}</td>
    </tr>`
  );

  const maintRows = maintenance.slice(0, 6).map(
    (m) => `<tr>
      <td>${escapeHtml(m.type_label)}</td>
      <td>${m.amount ? money(m.amount) : "—"}</td>
      <td>${escapeHtml(m.service_date || "—")}</td>
    </tr>`
  );

  const upcomingMaintRows = upcomingMaintenance.map(
    (m) => `<tr>
      <td>${escapeHtml(m.type_label)}</td>
      <td>${escapeHtml(m.next_service_date || "—")}</td>
      <td><span class="pill pill--${m.status === "overdue" ? "red" : "amber"}">${escapeHtml(m.status)}</span></td>
    </tr>`
  );

  const docRows = documents.map(
    (d) => `<tr>
      <td>${escapeHtml(d.type_label)}</td>
      <td>${formatDateDisplay(d.expiry_date)}</td>
      <td><span class="pill pill--amber">${escapeHtml(d.status_label || d.status)}</span></td>
    </tr>`
  );

  return `<section class="vc-section">
    <header class="vc-section__head">
      <h2 class="vc-section__title">Operasyon</h2>
      <p class="vc-section__desc">Son hareketler · yakıt · HGS · bakım · evrak · uyarılar</p>
    </header>

    ${glassPanel({
      title: "Son İşlemler",
      desc: "Gelir ve gider timeline",
      body: recentTransactions.length
        ? transactionTimeline(recentTransactions.map((t) => ({ ...t, plate: vehicle.plate })))
        : vehicleEmptyBlock({
            title: "Henüz işlem kaydı yok",
            hint: "İlk gelir veya gider kaydını oluşturun",
            actionHref: `/income/service?vehicle_id=${vehicle.id}`,
            actionLabel: "Gelir Ekle",
          }),
    })}

    <div class="grid2">
      ${glassPanel({
        title: "Son Yakıt Kayıtları",
        action: `<a href="/fuel?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Tümü →</a>`,
        body: modernTable(
          ["Litre", "Tutar", "Tarih"],
          fuelRows,
          { text: "Henüz yakıt kaydı yok" }
        ),
      })}
      ${glassPanel({
        title: "Son HGS Kayıtları",
        action: `<a href="/hgs" class="btn btn--ghost btn--sm">HGS Modülü →</a>`,
        body: modernTable(
          ["Tutar", "Açıklama", "Tarih"],
          hgsRows,
          { text: "Henüz HGS gideri yok" }
        ),
      })}
    </div>

    <div class="grid2">
      ${glassPanel({
        title: "Son Bakım Kayıtları",
        action: `<a href="#bakim-gecmisi" class="btn btn--ghost btn--sm">Bakım Geçmişi →</a>`,
        body: modernTable(
          ["Tür", "Tutar", "Tarih"],
          maintRows,
          { text: "Bu araç için bakım kaydı bulunmuyor." }
        ),
      })}
      ${glassPanel({
        title: "Yaklaşan Bakım",
        body: modernTable(
          ["Tür", "Sonraki Tarih", "Durum"],
          upcomingMaintRows,
          { text: "Yaklaşan bakım yok" }
        ),
      })}
    </div>

    <div class="grid2">
      ${glassPanel({
        title: "Yaklaşan Evraklar",
        action: `<a href="/documents?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Evrak Takibi →</a>`,
        body: modernTable(
          ["Tür", "Bitiş", "Durum"],
          docRows,
          { text: "Yaklaşan evrak yok" }
        ),
      })}
      ${glassPanel({
        title: "Araç Uyarıları",
        action: `<a href="/alerts" class="btn btn--ghost btn--sm">Tüm Uyarılar →</a>`,
        body: alertsBody,
      })}
    </div>
  </section>`;
}

function vehicleCenterPageHtml(bundle) {
  const chartScript = chartBoot([
    bundle.monthly.incomeData.some((v) => v > 0) || bundle.monthly.expenseData.some((v) => v > 0)
      ? `new Chart(document.getElementById("vcMonthlyChart"),{
          type:"bar",
          data:{labels:${JSON.stringify(bundle.monthly.labels)},datasets:[
            {label:"Gelir",data:${JSON.stringify(bundle.monthly.incomeData)},backgroundColor:"rgba(16,185,129,0.85)",borderRadius:8},
            {label:"Gider",data:${JSON.stringify(bundle.monthly.expenseData)},backgroundColor:"rgba(244,63,94,0.85)",borderRadius:8}
          ]},
          options:${chartOpts()}
        });`
      : "",
  ]);

  return `<div class="dash page-enter dash--dense vehicle-center">
    ${vehicleHeaderHtml(bundle)}
    ${vehicleIntelligenceSummaryHtml(bundle.intelligence)}
    ${vehicleHealthSummaryHtml(bundle.health)}
    ${vehicleTimelinePreviewHtml(bundle.timeline)}
    ${vehicleProfitRiskSummaryHtml(bundle.profitRisk)}
    ${financialKpiHtml(bundle)}
    ${analysisSectionHtml(bundle)}
    ${maintenanceHistorySectionHtml(bundle)}
    ${tireStatusSectionHtml(bundle)}
    ${tireChangeHistorySectionHtml(bundle)}
    ${tireSeasonalStatusSectionHtml(bundle)}
    ${operationsSectionHtml(bundle)}
  </div>
  ${chartScript}`;
}

module.exports = { vehicleCenterPageHtml, vehicleEmptyBlock, vehicleIntelligenceSummaryHtml };
