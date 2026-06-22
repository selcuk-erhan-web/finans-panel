const { escapeHtml } = require("./escape");
const { severityBadge } = require("./releaseCandidate");

function phaseBadge(complete) {
  return complete
    ? '<span class="prd1-badge prd1-badge--covered">Sertifikalı</span>'
    : '<span class="prd1-badge prd1-badge--missing">Bekliyor</span>';
}

function v11ProductionReleasePageHtml(payload) {
  const production = payload.production || {};
  const certification = payload.certification || {};
  const inventory = payload.inventory || {};
  const knownIssues = payload.known_issues || [];
  const readiness = payload.readiness || {};
  const counts = inventory.counts || {};
  const notes = payload.release_notes || inventory.release_notes || {};
  const readinessClass = readiness.production_ready ? "prd1-status--ready" : "prd1-status--pending";

  const phaseRows = (inventory.certification_phases || [])
    .map(
      (row) => `<tr>
        <td><code>${escapeHtml(row.id)}</code></td>
        <td>${escapeHtml(row.name || "—")}</td>
        <td>${phaseBadge(row.complete)}</td>
      </tr>`
    )
    .join("");

  const moduleRows = (inventory.modules || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.phases || "—")}</td>
        <td>${row.ready ? phaseBadge(true) : phaseBadge(false)}</td>
      </tr>`
    )
    .join("");

  const widgetRows = (inventory.dashboard_widgets || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td><code>${escapeHtml(row.id)}</code></td>
        <td>${escapeHtml(row.module)}</td>
      </tr>`
    )
    .join("");

  const viPageRows = (inventory.vehicle_intelligence_pages || [])
    .map(
      (row) => `<tr>
        <td><a href="${escapeHtml(row.path)}">${escapeHtml(row.label)}</a></td>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.phase || "—")}</td>
      </tr>`
    )
    .join("");

  const issueRows = knownIssues.length
    ? knownIssues
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.id || "—")}</td>
          <td>${severityBadge(row.severity).replace(/rc1-badge/g, "prd1-badge")}</td>
          <td>${escapeHtml(row.module || "—")}</td>
          <td>${escapeHtml(row.title || "—")}</td>
          <td>${escapeHtml(row.planned_version || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Bilinen sorun kaydı yok.</td></tr>`;

  const blockerList = (readiness.blockers || []).length
    ? readiness.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Bloker yok</li>";

  const notesExcerpt = (notes.excerpt || "")
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<div class="dash page-enter dash--dense prd1-hub v11prd-hub">
    <header class="prd1-hub__header fade-in">
      <p class="prd1-hub__eyebrow">FleetOS · v1.1 Production Release</p>
      <h2 class="prd1-hub__title">FleetOS v1.1 Production Release</h2>
      <p class="prd1-hub__desc">Vehicle Intelligence programı production sertifikasyonu, dondurulmuş envanter ve readiness raporu.</p>
      <div class="v11prd-hub__links">
        <a href="/release/v1.1" class="btn btn--ghost btn--sm">v1.1 Release Candidate →</a>
        <a href="/executive-vehicle-dashboard" class="btn btn--ghost btn--sm">Yönetici Araç Zekâsı →</a>
      </div>
    </header>

    <section class="prd1-status fade-in ${readinessClass}">
      <article class="prd1-status__hero">
        <span>Sürüm</span>
        <strong>${escapeHtml(production.version || "1.1.0")}</strong>
        <em>${escapeHtml(production.release_name || "FleetOS Vehicle Intelligence")}</em>
      </article>
      <div class="prd1-status__grid">
        <article><span>Durum</span><strong>${escapeHtml(production.status || "production")}</strong></article>
        <article><span>Support Level</span><strong>${escapeHtml(readiness.support_level || production.support_level || "stable")}</strong></article>
        <article><span>Production Ready</span><strong>${readiness.production_ready ? "Evet" : "Hayır"}</strong></article>
        <article><span>Certified</span><strong>${readiness.certified ? "Evet" : "Hayır"}</strong></article>
        <article><span>Release Candidate</span><strong>${escapeHtml(production.release_candidate || "1.1.0-rc2")}</strong></article>
        <article><span>Tarih</span><strong>${escapeHtml(production.release_date || certification.certification_date || "—")}</strong></article>
        <article><span>Branch</span><strong>${escapeHtml(production.branch || "v1.1-planning")}</strong></article>
        <article><span>Bilinen Sorun</span><strong>${Number(knownIssues.length).toLocaleString("tr-TR")}</strong></article>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Vehicle Intelligence Sertifikasyonu</h2>
        <p class="panel__desc">${counts.certification_phases || 0} faz sertifikalı</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Faz</th><th>Ad</th><th>Durum</th></tr></thead>
          <tbody>${phaseRows || `<tr><td colspan="3" class="data-table__empty">Faz verisi yok.</td></tr>`}</tbody>
        </table>
      </div>
    </section>

    <div class="grid2 prd1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Production Envanteri</h2>
          <p class="panel__desc">Dondurulmuş v1.1.0 snapshot</p>
        </header>
        <div class="panel__body v11prd-summary-grid">
          <article><span>Modül</span><strong>${Number(counts.modules || 0).toLocaleString("tr-TR")}</strong></article>
          <article><span>Sayfa</span><strong>${Number(counts.pages || 0).toLocaleString("tr-TR")}</strong></article>
          <article><span>API</span><strong>${Number(counts.apis || 0).toLocaleString("tr-TR")}</strong></article>
          <article><span>Widget</span><strong>${Number(counts.dashboard_widgets || 0).toLocaleString("tr-TR")}</strong></article>
          <article><span>VI Sayfa</span><strong>${Number(counts.vehicle_intelligence_pages || 0).toLocaleString("tr-TR")}</strong></article>
          <article><span>VI API</span><strong>${Number(counts.vehicle_intelligence_apis || 0).toLocaleString("tr-TR")}</strong></article>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Readiness Özeti</h2>
          <p class="panel__desc">PRD-2 production gate</p>
        </header>
        <div class="panel__body v11prd-readiness">
          <p><strong>Production Ready:</strong> ${readiness.production_ready ? "Evet" : "Hayır"}</p>
          <p><strong>Certified:</strong> ${readiness.certified ? "Evet" : "Hayır"}</p>
          <p><strong>Test Durumu:</strong> ${readiness.tests_passed ? "Geçti" : "Bekliyor"}</p>
          <p><strong>Sertifikasyon Tarihi:</strong> ${escapeHtml(certification.certification_date || "—")}</p>
          <div class="v11prd-blockers">
            <span>Blokerler</span>
            <ul>${blockerList}</ul>
          </div>
        </div>
      </section>
    </div>

    <div class="grid2 prd1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Modül Envanteri</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Modül</th><th>Fazlar</th><th>Durum</th></tr></thead>
            <tbody>${moduleRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Dashboard Widget Envanteri</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Widget</th><th>ID</th><th>Modül</th></tr></thead>
            <tbody>${widgetRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">VI Sayfaları</h2>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Sayfa</th><th>Path</th><th>Faz</th></tr></thead>
          <tbody>${viPageRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bilinen Sorunlar</h2>
        <p class="panel__desc">${knownIssues.length} kayıtlı sınırlama</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>ID</th><th>Önem</th><th>Modül</th><th>Başlık</th><th>Plan</th></tr></thead>
          <tbody>${issueRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Production Release Notes</h2>
        <p class="panel__desc">${escapeHtml(notes.path || "data/release/v11-production-release-notes.md")}</p>
      </header>
      <div class="panel__body prd1-notes">
        ${notesExcerpt || "<p>Production release notes bulunamadı.</p>"}
      </div>
    </section>
  </div>`;
}

module.exports = {
  v11ProductionReleasePageHtml,
};
