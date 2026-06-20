const { escapeHtml } = require("./escape");
const { severityBadge, coverageBadge } = require("./releaseCandidate");

function productionReleasePageHtml(data) {
  const metadata = data.metadata || {};
  const inventory = data.inventory || {};
  const counts = inventory.counts || {};
  const certification = data.certification || {};
  const rc = data.release_candidate || {};
  const readinessClass = metadata.production_ready ? "prd1-status--ready" : "prd1-status--pending";

  const moduleRows = (inventory.modules || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.phases || "—")}</td>
        <td>${row.ready ? '<span class="prd1-badge prd1-badge--covered">Hazır</span>' : '<span class="prd1-badge prd1-badge--missing">Bekliyor</span>'}</td>
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

  const analyticsRows = (inventory.analytics_pages || [])
    .map(
      (row) => `<tr>
        <td><a href="${escapeHtml(row.path)}">${escapeHtml(row.label)}</a></td>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.module)}</td>
      </tr>`
    )
    .join("");

  const pageRows = (inventory.pages || [])
    .filter((row) => row.module !== "system" || row.path === "/production" || row.path === "/release")
    .map(
      (row) => `<tr>
        <td><a href="${escapeHtml(row.path)}">${escapeHtml(row.label)}</a></td>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.module)}</td>
      </tr>`
    )
    .join("");

  const issueRows = (data.known_issues || []).length
    ? data.known_issues
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.id || "—")}</td>
          <td>${severityBadge(row.severity).replace(/rc1-badge/g, "prd1-badge")}</td>
          <td>${escapeHtml(row.module || "—")}</td>
          <td>${escapeHtml(row.title || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="data-table__empty">Bilinen sorun kaydı yok.</td></tr>`;

  const notes = data.release_notes || {};
  const notesExcerpt = (notes.excerpt || "")
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<div class="dash page-enter dash--dense prd1-hub">
    <header class="prd1-hub__header fade-in">
      <p class="prd1-hub__eyebrow">FleetOS · Production Release</p>
      <h2 class="prd1-hub__title">FleetOS v1.0.0</h2>
      <p class="prd1-hub__desc">Production readiness, frozen platform inventory, certification status, and operational release documentation.</p>
    </header>

    <section class="prd1-status fade-in ${readinessClass}">
      <article class="prd1-status__hero">
        <span>Sürüm</span>
        <strong>${escapeHtml(metadata.version || "1.0.0")}</strong>
        <em>${escapeHtml(metadata.support_level || "stable")} · ${metadata.production_ready ? "Production Ready" : "Not Ready"}</em>
      </article>
      <div class="prd1-status__grid">
        <article><span>Durum</span><strong>${escapeHtml(metadata.status || "production")}</strong></article>
        <article><span>Production Ready</span><strong>${metadata.production_ready ? "Evet" : "Hayır"}</strong></article>
        <article><span>Support Level</span><strong>${escapeHtml(metadata.support_level || "stable")}</strong></article>
        <article><span>Certified</span><strong>${certification.certified ? "Evet" : "Hayır"}</strong></article>
        <article><span>Bilinen Sorun</span><strong>${Number(counts.known_issues || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Release Candidate</span><strong>${escapeHtml(metadata.release_candidate || "1.0.0-rc1")}</strong></article>
        <article><span>Tarih</span><strong>${escapeHtml(metadata.release_date || "—")}</strong></article>
        <article><span>Commit</span><strong>${escapeHtml(String(metadata.release_commit || "—").slice(0, 7))}</strong></article>
      </div>
    </section>

    <section class="panel fade-in prd1-rc-ref">
      <header class="panel__head">
        <h2 class="panel__title">Release Candidate Referansı</h2>
        <p class="panel__desc">${escapeHtml(rc.release_name || "FleetOS RC-1")} · ${escapeHtml(rc.version || "1.0.0-rc1")}</p>
      </header>
      <div class="panel__body prd1-rc-ref__body">
        <p>RC-1 doğrulaması tamamlandı. Ayrıntılı aday envanteri için <a href="${escapeHtml(rc.path || "/release")}">Release Candidate</a> sayfasına bakın.</p>
        <p>RC durumu: <strong>${rc.release_ready ? "Release Ready" : "Pending"}</strong></p>
      </div>
    </section>

    <div class="grid2 prd1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Platform Envanteri</h2>
          <p class="panel__desc">${counts.modules || 0} modül · ${counts.pages || 0} sayfa</p>
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
          <h2 class="panel__title">Dashboard Envanteri</h2>
          <p class="panel__desc">${counts.dashboard_widgets || 0} executive widget</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Widget</th><th>ID</th><th>Modül</th></tr></thead>
            <tbody>${widgetRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="grid2 prd1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Analitik Envanteri</h2>
          <p class="panel__desc">${counts.analytics_pages || 0} analytics sayfası</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Sayfa</th><th>Path</th><th>Modül</th></tr></thead>
            <tbody>${analyticsRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Sayfa Özeti</h2>
          <p class="panel__desc">Operasyonel modül sayfaları</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Sayfa</th><th>Path</th><th>Modül</th></tr></thead>
            <tbody>${pageRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bilinen Sorunlar Özeti</h2>
        <p class="panel__desc">${counts.known_issues || 0} documented limitation · data/release/known-issues.json</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>ID</th><th>Önem</th><th>Modül</th><th>Başlık</th></tr></thead>
          <tbody>${issueRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Release Notes Özeti</h2>
        <p class="panel__desc">${escapeHtml(notes.path || "data/release/v1-release-notes.md")}</p>
      </header>
      <div class="panel__body prd1-notes">
        ${notesExcerpt || "<p>Production release notes bulunamadı.</p>"}
      </div>
    </section>
  </div>`;
}

module.exports = {
  productionReleasePageHtml,
};
