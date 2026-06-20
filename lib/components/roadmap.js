const { escapeHtml } = require("./escape");

function phaseStatusClass(status) {
  if (status === "planning") return "v11-phase--planning";
  if (status === "in_progress") return "v11-phase--active";
  if (status === "complete") return "v11-phase--complete";
  return "v11-phase--planned";
}

function roadmapPageHtml(roadmap) {
  const pillars = (roadmap.pillars || [])
    .map((pillar) => `<span class="v11-pillar-chip">${escapeHtml(pillar)}</span>`)
    .join("");

  const phaseRows = (roadmap.phases || []).length
    ? roadmap.phases
        .map(
          (phase) => `<article class="v11-phase-card ${phaseStatusClass(phase.status)}">
          <header class="v11-phase-card__head">
            <span class="v11-phase-card__id">${escapeHtml(phase.id || "—")}</span>
            <span class="v11-phase-card__status">${escapeHtml(phase.status || "planned")}</span>
          </header>
          <h3 class="v11-phase-card__title">${escapeHtml(phase.name || "—")}</h3>
          <p class="v11-phase-card__summary">${escapeHtml(phase.summary || "")}</p>
        </article>`
        )
        .join("")
    : `<p class="v11-roadmap-empty">Planlanan faz bulunmuyor.</p>`;

  const outOfScopeItems = (roadmap.out_of_scope || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<div class="dash page-enter dash--dense v11-roadmap-hub">
    <header class="v11-roadmap-hub__header fade-in">
      <p class="v11-roadmap-hub__eyebrow">FleetOS · v1.1 Planning</p>
      <h2 class="v11-roadmap-hub__title">FleetOS v1.1 Roadmap</h2>
      <p class="v11-roadmap-hub__desc">${escapeHtml(roadmap.codename || "Vehicle Intelligence & Operational Control")}</p>
    </header>

    <section class="v11-roadmap-status fade-in">
      <article class="v11-roadmap-status__hero">
        <span>Sürüm</span>
        <strong>${escapeHtml(roadmap.version || "1.1.0")}</strong>
        <em>${escapeHtml(roadmap.status || "planning")}</em>
      </article>
      <div class="v11-roadmap-status__grid">
        <article><span>Base Version</span><strong>${escapeHtml(roadmap.base_version || "1.0.1")}</strong></article>
        <article><span>Branch</span><strong>${escapeHtml(roadmap.branch || "v1.1-planning")}</strong></article>
        <article><span>Created</span><strong>${escapeHtml(roadmap.created_at || "—")}</strong></article>
        <article><span>Phases</span><strong>${(roadmap.phases || []).length}</strong></article>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Primary Goal</h2>
      </header>
      <div class="panel__body">
        <p class="v11-roadmap-goal">${escapeHtml(roadmap.primary_goal || "")}</p>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Pillars</h2>
        <p class="panel__desc">v1.1 strategic focus areas</p>
      </header>
      <div class="panel__body">
        <div class="v11-pillar-row">${pillars || '<span class="v11-roadmap-empty">Pillar tanımı yok.</span>'}</div>
      </div>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">Planned Phases</h2>
        <p class="panel__desc">V11-PLN-1 through PRD-2</p>
      </header>
      <div class="panel__body">
        <div class="v11-phase-list">${phaseRows}</div>
      </div>
    </section>

    <section class="panel fade-in v11-out-of-scope">
      <header class="panel__head">
        <h2 class="panel__title">Out of Scope</h2>
        <p class="panel__desc">Explicitly excluded from v1.1 — candidate for v1.2+</p>
      </header>
      <div class="panel__body">
        <ul class="v11-out-of-scope__list">${outOfScopeItems || "<li>Tanım yok.</li>"}</ul>
      </div>
    </section>
  </div>`;
}

module.exports = {
  roadmapPageHtml,
};
