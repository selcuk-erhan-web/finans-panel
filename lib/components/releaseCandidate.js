const { escapeHtml } = require("./escape");

function coverageBadge(status) {
  const map = {
    covered: "rc1-badge rc1-badge--covered",
    partial: "rc1-badge rc1-badge--partial",
    not_covered: "rc1-badge rc1-badge--missing",
  };
  const labels = {
    covered: "Kapsandı",
    partial: "Kısmi",
    not_covered: "Kapsanmıyor",
  };
  const cls = map[status] || "rc1-badge";
  const label = labels[status] || status;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function severityBadge(severity) {
  const map = {
    low: "rc1-badge rc1-badge--low",
    medium: "rc1-badge rc1-badge--medium",
    high: "rc1-badge rc1-badge--high",
  };
  const cls = map[severity] || "rc1-badge";
  return `<span class="${cls}">${escapeHtml(severity || "low")}</span>`;
}

function releaseCandidatePageHtml(inventory) {
  const metadata = inventory.metadata || {};
  const counts = inventory.counts || {};
  const readinessClass = metadata.release_ready ? "rc1-status--ready" : "rc1-status--pending";

  const moduleRows = (inventory.modules || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.phases || "—")}</td>
        <td>${row.ready ? '<span class="rc1-badge rc1-badge--covered">Hazır</span>' : '<span class="rc1-badge rc1-badge--missing">Bekliyor</span>'}</td>
      </tr>`
    )
    .join("");

  const pageRows = (inventory.pages || [])
    .map(
      (row) => `<tr>
        <td><a href="${escapeHtml(row.path)}">${escapeHtml(row.label)}</a></td>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.module)}</td>
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

  const apiRows = (inventory.apis || [])
    .map(
      (row) => `<tr>
        <td><code>${escapeHtml(row.path)}</code></td>
        <td>${escapeHtml(row.module)}</td>
        <td>${escapeHtml(row.kind || "—")}</td>
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

  const issueRows = (inventory.known_issues || []).length
    ? inventory.known_issues
        .map(
          (row) => `<tr>
          <td>${escapeHtml(row.id || "—")}</td>
          <td>${severityBadge(row.severity)}</td>
          <td>${escapeHtml(row.module || "—")}</td>
          <td>${escapeHtml(row.title || "—")}</td>
          <td>${escapeHtml(row.status || "known")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="data-table__empty">Bilinen sorun kaydı yok.</td></tr>`;

  const notes = inventory.release_notes || {};
  const notesExcerpt = (notes.excerpt || "")
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<div class="dash page-enter dash--dense rc1-hub">
    <header class="rc1-hub__header fade-in">
      <p class="rc1-hub__eyebrow">FleetOS · Release Candidate</p>
      <h2 class="rc1-hub__title">FleetOS RC-1</h2>
      <p class="rc1-hub__desc">Release readiness, platform inventory, and documented limitations for the first formal candidate build.</p>
    </header>

    <section class="rc1-status fade-in ${readinessClass}">
      <article class="rc1-status__hero">
        <span>Sürüm</span>
        <strong>${escapeHtml(metadata.version || "1.0.0-rc1")}</strong>
        <em>${escapeHtml(metadata.release_name || "FleetOS RC-1")}</em>
      </article>
      <div class="rc1-status__grid">
        <article><span>Durum</span><strong>${escapeHtml(metadata.status || "release_candidate")}</strong></article>
        <article><span>Release Ready</span><strong>${metadata.release_ready ? "Evet" : "Hayır"}</strong></article>
        <article><span>STB-1</span><strong>${metadata.stabilization_complete ? "Tamamlandı" : "Bekliyor"}</strong></article>
        <article><span>Bilinen Sorun</span><strong>${Number(counts.known_issues || 0).toLocaleString("tr-TR")}</strong></article>
        <article><span>Branch</span><strong>${escapeHtml(metadata.branch || "panel-refactor")}</strong></article>
        <article><span>Commit</span><strong>${escapeHtml(String(metadata.base_commit || "—").slice(0, 7))}</strong></article>
        <article><span>Tarih</span><strong>${escapeHtml(metadata.release_date || "—")}</strong></article>
        <article><span>Modül</span><strong>${Number(counts.modules || 0).toLocaleString("tr-TR")}</strong></article>
      </div>
    </section>

    <div class="grid2 rc1-grid">
      <section class="panel fade-in">
        <header class="panel__head">
          <h2 class="panel__title">Modül Envanteri</h2>
          <p class="panel__desc">${counts.modules || 0} ana modül</p>
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

    <div class="grid2 rc1-grid">
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
          <h2 class="panel__title">Audit Kapsam Özeti</h2>
          <p class="panel__desc">STB-1 coverage review</p>
        </header>
        <div class="panel__body table-wrap">
          <table class="data-table data-table--compact">
            <thead><tr><th>Alan</th><th>Durum</th></tr></thead>
            <tbody>${auditRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Sayfa Envanteri</h2>
        <p class="panel__desc">${counts.pages || 0} RC modül sayfası</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Sayfa</th><th>Path</th><th>Modül</th></tr></thead>
          <tbody>${pageRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">API Envanteri</h2>
        <p class="panel__desc">${counts.apis || 0} release API endpoint</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Endpoint</th><th>Modül</th><th>Tür</th></tr></thead>
          <tbody>${apiRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Bilinen Sorunlar</h2>
        <p class="panel__desc">${counts.known_issues || 0} documented limitation</p>
      </header>
      <div class="panel__body table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>ID</th><th>Önem</th><th>Modül</th><th>Başlık</th><th>Durum</th></tr></thead>
          <tbody>${issueRows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Release Notes Özeti</h2>
        <p class="panel__desc">${escapeHtml(notes.path || "data/release/rc1-release-notes.md")}</p>
      </header>
      <div class="panel__body rc1-notes">
        ${notesExcerpt || "<p>Release notes bulunamadı.</p>"}
      </div>
    </section>
  </div>`;
}

module.exports = {
  releaseCandidatePageHtml,
};
