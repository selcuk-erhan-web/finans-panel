const { escapeHtml } = require("./escape");
const { severityBadge, coverageBadge } = require("./releaseCandidate");

function phaseBadge(complete) {
  return complete
    ? '<span class="rc1-badge rc1-badge--covered">Tamamlandı</span>'
    : '<span class="rc1-badge rc1-badge--missing">Bekliyor</span>';
}

function v11ReleaseCandidatePageHtml(payload) {
  const release = payload.release || {};
  const inventory = payload.inventory || {};
  const knownIssues = payload.known_issues || [];
  const readiness = payload.readiness || {};
  const summary = payload.summary || {};
  const counts = inventory.counts || {};
  const notes = payload.release_notes || inventory.release_notes || {};
  const readinessClass = readiness.release_ready ? "rc1-status--ready" : "rc1-status--pending";

  const phaseRows = (inventory.vehicle_intelligence_phases || [])
    .map(
      (row) => `<tr>
        <td><code>${escapeHtml(row.id)}</code></td>
        <td>${escapeHtml(row.name || "—")}</td>
        <td>${phaseBadge(row.complete)}</td>
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

  const widgetRows = (inventory.dashboard_widgets || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td><code>${escapeHtml(row.id)}</code></td>
        <td>${escapeHtml(row.module)}</td>
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

  const apiRows = (inventory.vehicle_intelligence_apis || [])
    .map(
      (row) => `<tr>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.phase || "—")}</td>
      </tr>`
    )
    .join("");

  const auditRows = Object.entries(inventory.audit_coverage || {})
    .map(
      ([key, value]) => `<tr>
        <td>${escapeHtml(key.replace(/_/g, " "))}</td>
        <td>${coverageBadge(value)}</td>
      </tr>`
    )
    .join("");

  const issueRows = knownIssues.length
    ? knownIssues
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.id || "—")}</td>
          <td>${severityBadge(row.severity)}</td>
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

  return `<div class="dash page-enter dash--dense rc1-hub v11rc-hub">
    <header class="rc1-hub__header fade-in">
      <p class="rc1-hub__eyebrow">FleetOS · v1.1 Release Candidate</p>
      <h2 class="rc1-hub__title">FleetOS v1.1 Release Candidate</h2>
      <p class="rc1-hub__desc">Vehicle Intelligence programı release readiness, envanter ve bilinen sınırlamalar.</p>
      <div class="v11rc-hub__links">
        <a href="/roadmap/v1.1" class="btn btn--ghost btn--sm">v1.1 Roadmap →</a>
        <a href="/executive-vehicle-dashboard" class="btn btn--ghost btn--sm">Yönetici Araç Zekâsı →</a>
      </div>
    </header>

    <section class="rc1-status fade-in ${readinessClass}">
      <article class="rc1-status__hero">
        <span>Sürüm</span>
        <strong>${escapeHtml(release.version || "1.1.0-rc2")}</strong>
        <em>${escapeHtml(release.release_name || "FleetOS Vehicle Intelligence RC-2")}</em>
      </article>
      <div class="rc1-status__grid">
        <article><span>Durum</span><strong>${escapeHtml(release.status || "release_candidate")}</strong></article>
        <article><span>Release Ready</span><strong>${readiness.release_ready ? "Evet" : "Hayır"}</strong></article>
        <article><span>Branch</span><strong>${escapeHtml(release.branch || "v1.1-planning")}</strong></article>
        <article><span>Tarih</span><strong>${escapeHtml(release.release_date || "—")}</strong></article>
        <article><span>Taban Sürüm</span><strong>${escapeHtml(release.base_version || "1.0.1")}</strong></article>
        <article><span>STB-2</span><strong>${release.stabilization_complete ? "Tamamlandı" : "Bekliyor"}</strong></article>
        <article><span>VI Programı</span><strong>${release.vehicle_intelligence_complete ? "Tamamlandı" : "Bekliyor"}</strong></article>
        <article><span>Bilinen Sorun</span><strong>${Number(knownIssues.length).toLocaleString("tr-TR")}</strong></article>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Vehicle Intelligence Özeti</h2>
        <p class="panel__desc">${summary.vehicle_intelligence_phases_complete || 0} faz tamamlandı</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Faz</th><th>Ad</th><th>Durum</th></tr></thead>
          <tbody>${phaseRows || `<tr><td colspan="3" class="data-table__empty">Faz verisi yok.</td></tr>`}</tbody>
        </table>
      </div>
    </section>

    <div class="grid2 rc1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Envanter Özeti</h2>
          <p class="panel__desc">v1.1 + v1.0.1 platform</p>
        </header>
        <div class="panel__body v11rc-summary-grid">
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
          <p class="panel__desc">RC-2 release gate</p>
        </header>
        <div class="panel__body v11rc-readiness">
          <p><strong>Release Ready:</strong> ${readiness.release_ready ? "Evet" : "Hayır"}</p>
          <p><strong>Test Durumu:</strong> ${readiness.tests_passed ? "Geçti" : "Bekliyor"}</p>
          <p><strong>STB-2:</strong> ${readiness.stabilization_complete ? "Tamamlandı" : "Bekliyor"}</p>
          <p><strong>VI Programı:</strong> ${readiness.vehicle_intelligence_complete ? "Tamamlandı" : "Bekliyor"}</p>
          <div class="v11rc-blockers">
            <span>Blokerler</span>
            <ul>${blockerList}</ul>
          </div>
        </div>
      </section>
    </div>

    <div class="grid2 rc1-grid">
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
          <h2 class="panel__title">VI API'ler</h2>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Endpoint</th><th>Faz</th></tr></thead>
            <tbody>${apiRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="grid2 rc1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Modül Envanteri</h2>
          <p class="panel__desc">${counts.modules || 0} modül</p>
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
          <p class="panel__desc">${counts.dashboard_widgets || 0} widget</p>
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
        <h2 class="panel__title">Audit Kapsam Özeti</h2>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Alan</th><th>Durum</th></tr></thead>
          <tbody>${auditRows}</tbody>
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
        <h2 class="panel__title">Release Notes Özeti</h2>
        <p class="panel__desc">${escapeHtml(notes.path || "data/release/v11-rc2-release-notes.md")}</p>
      </header>
      <div class="panel__body rc1-notes">
        ${notesExcerpt || "<p>Release notes bulunamadı.</p>"}
      </div>
    </section>
  </div>`;
}

module.exports = {
  v11ReleaseCandidatePageHtml,
};
