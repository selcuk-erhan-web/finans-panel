const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { STATUS_LABELS, CONFIDENCE_LABELS } = require("../../services/reconciliationService");

function statusBadge(status) {
  const map = {
    matched: "pill pill--green",
    underpaid: "pill pill--red",
    overpaid: "pill pill--blue",
    unmatched: "pill pill--muted",
    low_confidence: "pill pill--amber",
  };
  const cls = map[status] || "pill pill--muted";
  const label = STATUS_LABELS[status] || status;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function confidenceBadge(level) {
  const map = {
    high: "pill pill--green",
    medium: "pill pill--blue",
    low: "pill pill--amber",
  };
  const cls = map[level] || "pill pill--muted";
  const label = CONFIDENCE_LABELS[level] || level;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function diffCell(diff, status) {
  const cls =
    status === "underpaid"
      ? "recon-diff recon-diff--neg"
      : status === "overpaid"
        ? "recon-diff recon-diff--pos"
        : "recon-diff";
  const prefix = diff > 0 ? "+" : "";
  return `<span class="${cls}">${prefix}${money(diff)}</span>`;
}

function reconciliationPageHtml({ summary, rows }) {
  const tableRows = rows.length
    ? rows
        .map(
          (r) => `<tr class="recon-row recon-row--${escapeHtml(r.status)}">
          <td>${escapeHtml(r.periodLabel || r.period || "—")}</td>
          <td>${escapeHtml(r.company || "—")}</td>
          <td>${
            r.plate
              ? `<a class="plate-link" href="/vehicle/${r.vehicleId}">${escapeHtml(r.plate)}</a>`
              : "—"
          }</td>
          <td>${money(r.expectedAmount)}</td>
          <td>${money(r.actualAmount)}</td>
          <td>${diffCell(r.difference, r.status)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${confidenceBadge(r.confidence)}</td>
          <td class="recon-note">${escapeHtml(r.note || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="9" class="data-table__empty">Karşılaştırılacak hakediş verisi yok. Önce <a href="/income/service#import-hakedis">Servis Gelirleri</a> üzerinden hakediş PDF içe aktarın veya gelir kaydı girin.</td></tr>`;

  return `<div class="dash page-enter dash--dense recon-hub">
    <header class="recon-hub__header fade-in">
      <p class="recon-hub__eyebrow">Gelir Doğrulama · Hakediş Kontrol</p>
      <h2 class="recon-hub__title">Hakediş Doğrulama Merkezi</h2>
      <p class="recon-hub__desc">Beklenen servis gelirleri ile hakediş PDF import tutarlarını karşılaştırın. Salt okunur analiz — kayıt oluşturmaz.</p>
      <div class="recon-hub__actions">
        <a href="/income/service#import-hakedis" class="btn btn--primary btn--sm">Hakediş PDF Yükle</a>
        <a href="/income/service" class="btn btn--ghost btn--sm">Servis Gelirleri</a>
      </div>
    </header>

    <div class="recon-kpi-row fade-in">
      <article class="recon-kpi"><span>Toplam Beklenen</span><strong>${money(summary.totalExpected)}</strong></article>
      <article class="recon-kpi"><span>Toplam Hakediş</span><strong>${money(summary.totalActual)}</strong></article>
      <article class="recon-kpi recon-kpi--diff"><span>Fark</span><strong class="${summary.totalDifference < 0 ? "recon-kpi__neg" : summary.totalDifference > 0 ? "recon-kpi__pos" : ""}">${money(summary.totalDifference)}</strong></article>
      <article class="recon-kpi recon-kpi--alert"><span>Eksik Tahsilat Sayısı</span><strong>${summary.underpaidCount.toLocaleString("tr-TR")}</strong></article>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">Doğrulama Listesi</h2>
          <p class="panel__desc">${rows.length} satır · tolerans ±${1} TL</p>
        </div>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table recon-table">
          <thead><tr>
            <th>Dönem</th>
            <th>Müşteri / Firma</th>
            <th>Plaka</th>
            <th>Beklenen</th>
            <th>Hakediş</th>
            <th>Fark</th>
            <th>Durum</th>
            <th>Güven</th>
            <th>Not</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  reconciliationPageHtml,
  statusBadge,
  confidenceBadge,
};
