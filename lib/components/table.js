const { escapeHtml } = require("./escape");
const { money } = require("../finance");

function modernTable(headers, rows, empty = null) {
  if (!rows.length) {
    return `<div class="empty empty--sm">
      <p>${empty?.text || "Henüz kayıt yok"}</p>
    </div>`;
  }
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  return `<div class="table-scroller">
    <table class="data-table">
      <thead><tr>${th}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  </div>`;
}

function expenseRow(t) {
  return `<tr>
    <td><span class="data-table__plate">${escapeHtml(t.plate || "—")}</span></td>
    <td><span class="pill pill--muted">${escapeHtml(t.category || "—")}</span></td>
    <td class="text-neg"><strong>${money(t.amount)}</strong></td>
    <td class="data-table__note">${escapeHtml(t.note || "—")}</td>
    <td class="data-table__date">${escapeHtml(String(t.date || "").slice(0, 10))}</td>
  </tr>`;
}

function transactionRow(t, editPath, deleteHref) {
  const cls = t.type === "income" ? "text-pos" : "text-neg";
  const plateLabel = t.plate || (t.vehicle_id ? "—" : "Ortak Gider");
  return `<tr>
    <td>${escapeHtml(plateLabel)}</td>
    <td>${escapeHtml(t.category || "—")}</td>
    <td class="${cls}"><strong>${money(t.amount)}</strong></td>
    <td>${escapeHtml(t.note || "—")}</td>
    <td>${escapeHtml(String(t.date || "").slice(0, 16))}</td>
    <td class="data-table__actions">
      <a href="${editPath}" class="btn btn--sm btn--ghost">Düzenle</a>
      <a href="${deleteHref}" class="btn btn--sm btn--danger" onclick="return confirm('Silinsin mi?')">Sil</a>
    </td>
  </tr>`;
}

function glassPanel({ title, desc, body, action = "", className = "" }) {
  const extra = className ? ` ${className}` : "";
  return `<section class="panel${extra}">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">${escapeHtml(title)}</h2>
        ${desc ? `<p class="panel__desc">${escapeHtml(desc)}</p>` : ""}
      </div>
      ${action}
    </header>
    <div class="panel__body">${body}</div>
  </section>`;
}

function insightPanel(text) {
  const { premiumInsight } = require("./saas");
  return premiumInsight(text);
}

function emptyState({ icon = "📭", title, desc, action = "" }) {
  return `<div class="empty empty--rich fade-in">
    <div class="empty__ring">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(desc)}</p>
    ${action ? `<div class="empty__action">${action}</div>` : ""}
  </div>`;
}

module.exports = {
  modernTable,
  expenseRow,
  transactionRow,
  glassPanel,
  insightPanel,
  emptyState,
};
