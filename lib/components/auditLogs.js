const { escapeHtml } = require("./escape");
const { MODULE_LABELS, ACTION_LABELS, VALID_MODULES, VALID_ACTIONS } = require("../../services/auditLogService");

const MODULE_OPTIONS = [
  ["", "Tüm Modüller"],
  ...[...VALID_MODULES].sort().map((key) => [key, MODULE_LABELS[key] || key]),
];

const ACTION_OPTIONS = [
  ["", "Tüm İşlemler"],
  ...[...VALID_ACTIONS].sort().map((key) => [key, ACTION_LABELS[key] || key]),
];

const CHANGE_TYPE_LABELS = {
  added: "Eklendi",
  removed: "Kaldırıldı",
  modified: "Değişti",
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("tr-TR");
}

function metadataPreview(row) {
  const count = row.change_count || row.metadata?.changes?.length || 0;
  if (count > 0) {
    return `<span class="audit-change-hint">${count} alan değişti</span>`;
  }
  const metadata = row.metadata;
  const metadataRaw = row.metadata_raw;
  if (metadata && typeof metadata === "object") {
    try {
      const text = JSON.stringify(metadata, null, 0);
      if (text.length <= 120) return escapeHtml(text);
      return `<span title="${escapeHtml(text)}">${escapeHtml(text.slice(0, 117))}…</span>`;
    } catch {
      return "Detay";
    }
  }
  if (metadataRaw) {
    const text = String(metadataRaw);
    if (text.length <= 120) return escapeHtml(text);
    return `<span title="${escapeHtml(text)}">${escapeHtml(text.slice(0, 117))}…</span>`;
  }
  return "—";
}

function renderFormattedChangeItem(change) {
  const badge = CHANGE_TYPE_LABELS[change.change_type] || change.change_type;
  const importanceClass =
    change.importance && change.importance !== "normal"
      ? `audit-importance-${change.importance}`
      : "";

  const oldPart =
    change.change_type !== "added"
      ? `<span class="audit-diff-old">${escapeHtml(change.old_display || "—")}</span>`
      : "";
  const arrow =
    change.change_type === "modified"
      ? `<span class="audit-diff-arrow">→</span>`
      : "";
  const newPart =
    change.change_type !== "removed"
      ? `<span class="audit-diff-new">${escapeHtml(change.new_display || "—")}</span>`
      : "";

  return `<li class="audit-diff-card ${importanceClass}">
    <div class="audit-diff-field">
      <span class="audit-diff-field-label">${escapeHtml(change.label || change.field)}</span>
      <span class="audit-diff-badge audit-diff-badge--${escapeHtml(change.change_type)}">${escapeHtml(badge)}</span>
    </div>
    <div class="audit-diff-values">
      ${oldPart}
      ${arrow}
      ${newPart}
    </div>
  </li>`;
}

function renderFormattedChangeGroups(row) {
  const groups = row.change_groups || [];
  const flat = row.formatted_changes || [];

  if (!groups.length && !flat.length) {
    return `<p class="audit-change-empty">Değişim detayı bulunmuyor.</p>`;
  }

  if (groups.length) {
    return groups
      .map(
        (group) => `<section class="audit-diff-group">
        <h4 class="audit-diff-group__title">${escapeHtml(group.group)}</h4>
        <ul class="audit-diff-list">
          ${(group.changes || []).map(renderFormattedChangeItem).join("")}
        </ul>
      </section>`
      )
      .join("");
  }

  return `<ul class="audit-diff-list">${flat.map(renderFormattedChangeItem).join("")}</ul>`;
}

function renderChangeDetails(row) {
  const count = row.change_count || row.metadata?.changes?.length || 0;
  if (!count) {
    if (row.action === "update") {
      return `<div class="audit-change-panel">${renderFormattedChangeGroups(row)}</div>`;
    }
    return "";
  }

  return `<details class="audit-change-details">
    <summary>Değişiklikler (${count})</summary>
    <div class="audit-change-panel audit-diff-panel">${renderFormattedChangeGroups(row)}</div>
  </details>`;
}

function entityAuditHistoryLink({ module, entity_type, entity_id, label = "İşlem Geçmişi" }) {
  if (!module || !entity_type || !entity_id) return "";
  const qs = new URLSearchParams({
    module: String(module),
    entity_type: String(entity_type),
    entity_id: String(entity_id),
  }).toString();
  return `<a href="/audit-logs?${qs}" class="btn btn--ghost btn--sm">${escapeHtml(label)}</a>`;
}

function auditLogsPageHtml({ summary, records, filters }) {
  const actionTotals = summary?.by_action || {};
  const createCount = actionTotals.create || 0;
  const updateCount = actionTotals.update || 0;
  const deleteCount = actionTotals.delete || 0;
  const importCount = actionTotals.import || 0;

  const moduleOptions = MODULE_OPTIONS.map(
    ([value, label]) =>
      `<option value="${escapeHtml(value)}" ${filters.module === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");

  const actionOptions = ACTION_OPTIONS.map(
    ([value, label]) =>
      `<option value="${escapeHtml(value)}" ${filters.action === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");

  const rows = (records || []).length
    ? records
        .map(
          (row) => `<tr class="aud1-row aud1-row--${escapeHtml(row.action || "system")}">
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          <td><span class="aud1-badge aud1-badge--module">${escapeHtml(row.module_label || row.module || "—")}</span></td>
          <td>${escapeHtml(row.entity_type || "—")}</td>
          <td>${escapeHtml(row.entity_id || "—")}</td>
          <td><span class="aud1-badge aud1-badge--${escapeHtml(row.action || "system")}">${escapeHtml(row.action_label || row.action || "—")}</span></td>
          <td>${escapeHtml(row.actor_name || "—")}</td>
          <td>${escapeHtml(row.summary || "—")}</td>
          <td class="aud1-meta">${metadataPreview(row)}</td>
        </tr>
        <tr class="aud1-row aud1-row--detail">
          <td colspan="8">${renderChangeDetails(row)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="data-table__empty">İşlem geçmişi bulunmuyor.</td></tr>`;

  const entityFilterNote =
    filters.entity_id && filters.entity_type
      ? `<p class="aud1-hub__entity-filter">Varlık geçmişi: <strong>${escapeHtml(filters.entity_type)} #${escapeHtml(filters.entity_id)}</strong></p>`
      : "";

  return `<div class="dash page-enter dash--dense aud1-hub">
    <header class="aud1-hub__header fade-in">
      <p class="aud1-hub__eyebrow">FleetOS · Audit Foundation</p>
      <h2 class="aud1-hub__title">İşlem Geçmişi</h2>
      <p class="aud1-hub__desc">Alan bazlı değişimler — formatlanmış önce/sonra görünümü ile.</p>
      ${entityFilterNote}
    </header>

    <section class="aud1-summary-row fade-in">
      <article class="aud1-summary-card"><span>Toplam İşlem</span><strong>${Number(summary?.total || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="aud1-summary-card aud1-summary-card--today"><span>Bugünkü İşlem</span><strong>${Number(summary?.today || 0).toLocaleString("tr-TR")}</strong></article>
      <article class="aud1-summary-card aud1-summary-card--create"><span>Oluşturma</span><strong>${Number(createCount).toLocaleString("tr-TR")}</strong></article>
      <article class="aud1-summary-card aud1-summary-card--update"><span>Güncelleme</span><strong>${Number(updateCount).toLocaleString("tr-TR")}</strong></article>
      <article class="aud1-summary-card aud1-summary-card--delete"><span>Silme</span><strong>${Number(deleteCount).toLocaleString("tr-TR")}</strong></article>
      <article class="aud1-summary-card aud1-summary-card--import"><span>Import</span><strong>${Number(importCount).toLocaleString("tr-TR")}</strong></article>
    </section>

    <section class="panel fade-in aud1-filters">
      <header class="panel__head">
        <h2 class="panel__title">Filtreler</h2>
      </header>
      <form class="aud1-filter-form" method="GET" action="/audit-logs">
        <label>Modül
          <select name="module">${moduleOptions}</select>
        </label>
        <label>İşlem
          <select name="action">${actionOptions}</select>
        </label>
        <label>Başlangıç
          <input type="date" name="date_from" value="${escapeHtml(filters.date_from || "")}">
        </label>
        <label>Bitiş
          <input type="date" name="date_to" value="${escapeHtml(filters.date_to || "")}">
        </label>
        <label>Limit
          <input type="number" name="limit" min="1" max="500" value="${escapeHtml(String(filters.limit || "50"))}">
        </label>
        <input type="hidden" name="entity_type" value="${escapeHtml(filters.entity_type || "")}">
        <input type="hidden" name="entity_id" value="${escapeHtml(filters.entity_id || "")}">
        <div class="aud1-filter-actions">
          <button type="submit" class="btn btn--primary btn--sm">Uygula</button>
          <a href="/audit-logs" class="btn btn--ghost btn--sm">Sıfırla</a>
        </div>
      </form>
    </section>

    <section class="panel fade-in">
      <header class="panel__head">
        <h2 class="panel__title">İşlem Listesi</h2>
        <p class="panel__desc">Tarih · Modül · Varlık · İşlem · Kullanıcı · Özet · Formatlanmış değişimler</p>
      </header>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Modül</th>
              <th>Varlık Türü</th>
              <th>Varlık ID</th>
              <th>İşlem</th>
              <th>Kullanıcı</th>
              <th>Özet</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

module.exports = {
  auditLogsPageHtml,
  entityAuditHistoryLink,
  renderChangeDetails,
  renderFormattedChangeGroups,
};
