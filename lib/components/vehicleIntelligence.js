const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatDateDisplay } = require("../../utils/date");
const { formatPlateDisplay } = require("../../utils/plate");
const { renderModuleTabs } = require("./moduleTabs");
const { executiveKpi, executiveKpiGrid, executiveHubHeader } = require("./executiveDesign");
const { buildVehicleDecisionInsights, vehicleDecisionCardsHtml } = require("./executiveIntelligence");

function statusBadge(label, tone) {
  return `<span class="vi-badge vi-badge--${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function complianceBadge(status) {
  const map = {
    active: ["Aktif", "ok"],
    warning: ["Uyarı", "warn"],
    critical: ["Kritik", "crit"],
    expired: ["Süresi Geçmiş", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[status] || map.unknown;
  return statusBadge(label, tone);
}

function maintenanceBadge(status) {
  const map = {
    ok: ["Uygun", "ok"],
    upcoming: ["Yaklaşan", "info"],
    due: ["Vadesi Geldi", "warn"],
    overdue: ["Gecikmiş", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[status] || map.unknown;
  return statusBadge(label, tone);
}

function tireBadge(status) {
  const map = {
    ready: ["Hazır", "ok"],
    attention: ["Dikkat", "warn"],
    mismatch: ["Uyumsuz", "crit"],
    unknown: ["Bilinmiyor", "muted"],
  };
  const [label, tone] = map[status] || map.unknown;
  return statusBadge(label, tone);
}

function signalBadges(signals, max = 3) {
  const items = (signals || []).slice(0, max);
  if (!items.length) return `<span class="vi-signal vi-signal--muted">Sinyal yok</span>`;
  return items
    .map(
      (s) =>
        `<span class="vi-signal vi-signal--${escapeHtml(s.level || "info")}" title="${escapeHtml(s.message || "")}">${escapeHtml(s.message || "")}</span>`
    )
    .join("");
}

function vehicleIntelligencePageHtml(payload, path = "/vehicle-intelligence") {
  const summary = payload.summary || {};
  const vehicles = payload.vehicles || [];

  const rows = vehicles.length
    ? vehicles
        .map((row) => {
          const vid = row.vehicle_id || row.vehicle?.id;
          return `<tr>
          <td><a class="plate-link" href="/vehicle/${escapeHtml(vid)}">${escapeHtml(formatPlateDisplay(row.plate) || row.plate || "—")}</a></td>
          <td>${complianceBadge(row.compliance?.status)}</td>
          <td>${maintenanceBadge(row.maintenance?.status)}</td>
          <td>${tireBadge(row.tire?.seasonal_status)}</td>
          <td>${money(row.finance?.total_income || 0)}</td>
          <td>${money(row.finance?.total_expense || 0)}</td>
          <td class="${row.finance?.net_profit < 0 ? "vi-net--neg" : row.finance?.net_profit > 0 ? "vi-net--pos" : ""}">${money(row.finance?.net_profit || 0)}</td>
          <td>${formatDateDisplay(row.audit?.latest_activity_date)}</td>
          <td class="vi-signals-cell">${signalBadges(row.signals, 3)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="data-table__empty executive-table__empty">FleetOS bu alan için veri bekliyor.<span class="data-table__empty-hint">Araç envanteri ve işlem kayıtları oluşturulduğunda zekâ tablosu otomatik dolacaktır.</span></td></tr>`;

  const kpiRow = executiveKpiGrid(
    [
      executiveKpi({ label: "Toplam Araç", value: Number(summary.total_vehicles || 0).toLocaleString("tr-TR"), tone: "neutral" }),
      executiveKpi({
        label: "Kritik Araç",
        value: Number(summary.vehicles_with_critical_signals || 0).toLocaleString("tr-TR"),
        tone: "danger",
      }),
      executiveKpi({
        label: "Uyarılı Araç",
        value: Number(summary.vehicles_with_warning_signals || 0).toLocaleString("tr-TR"),
        tone: "warning",
      }),
      executiveKpi({
        label: "Kârlı Araç",
        value: Number(summary.vehicles_profitable || 0).toLocaleString("tr-TR"),
        tone: "success",
      }),
      executiveKpi({
        label: "Zararlı Araç",
        value: Number(summary.vehicles_unprofitable || 0).toLocaleString("tr-TR"),
        tone: "danger",
      }),
      executiveKpi({ label: "Toplam Gelir", value: money(summary.total_income || 0), tone: "info" }),
      executiveKpi({ label: "Toplam Gider", value: money(summary.total_expense || 0), tone: "neutral" }),
      executiveKpi({ label: "Net Kâr", value: money(summary.net_profit || 0), tone: "info" }),
    ].join("")
  );

  return `<div class="dash page-enter dash--executive executive-hub vi-hub">
    ${executiveHubHeader({
      eyebrow: "Filo · Araç Zekâsı",
      description: "Uygunluk, bakım, lastik, denetim ve finans verilerinin araç bazlı birleşik görünümü.",
      tabsHtml: renderModuleTabs("vehicleIntelligence", path),
    })}

    ${kpiRow}

    ${vehicleDecisionCardsHtml(buildVehicleDecisionInsights(vehicles, summary))}

    <section class="panel executive-panel executive-panel--table fade-in">
      <header class="panel__head executive-panel__head">
        <h2 class="panel__title executive-panel__title">Filo Zekâsı Tablosu</h2>
        <p class="panel__desc executive-panel__subtitle">Kritik sinyaller önce; net kâr ve plaka sıralaması uygulanır.</p>
      </header>
      <div class="panel__body executive-panel__body">
        <div class="table-wrap executive-table-wrap">
          <table class="data-table data-table--compact executive-table vi-table">
            <thead>
              <tr>
                <th>Araç</th>
                <th>Uygunluk</th>
                <th>Bakım</th>
                <th>Lastik</th>
                <th>Gelir</th>
                <th>Gider</th>
                <th>Net</th>
                <th>Son Aktivite</th>
                <th>Sinyaller</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>
  </div>`;
}

function vehicleIntelligenceSummaryHtml(intelligence) {
  if (!intelligence) {
    return `<section class="panel fade-in vi-summary-panel">
      <header class="panel__head">
        <h2 class="panel__title">Araç Zekâsı Özeti</h2>
      </header>
      <div class="panel__body">
        <p class="vi-summary-empty">Araç zekâsı özeti üretilemedi.</p>
      </div>
    </section>`;
  }

  const signals = signalBadges(intelligence.signals, 3);

  return `<section class="panel fade-in vi-summary-panel">
    <header class="panel__head">
      <h2 class="panel__title">Araç Zekâsı Özeti</h2>
      <a href="/vehicle-intelligence" class="btn btn--ghost btn--sm">Araç Zekâsı →</a>
    </header>
    <div class="panel__body">
      <div class="vi-summary-grid">
        <article><span>Uygunluk</span>${complianceBadge(intelligence.compliance?.status)}</article>
        <article><span>Bakım</span>${maintenanceBadge(intelligence.maintenance?.status)}</article>
        <article><span>Lastik</span>${tireBadge(intelligence.tire?.seasonal_status)}</article>
        <article><span>Net Kâr</span><strong class="${intelligence.finance?.net_profit < 0 ? "vi-net--neg" : intelligence.finance?.net_profit > 0 ? "vi-net--pos" : ""}">${money(intelligence.finance?.net_profit || 0)}</strong></article>
      </div>
      <div class="vi-summary-signals">${signals}</div>
    </div>
  </section>`;
}

module.exports = {
  vehicleIntelligencePageHtml,
  vehicleIntelligenceSummaryHtml,
  complianceBadge,
  maintenanceBadge,
  tireBadge,
  signalBadges,
};
