const { escapeHtml } = require("./escape");
const { money } = require("../finance");

const SEVERITY_META = {
  critical: { label: "Kritik", icon: "⚠", tone: "critical" },
  warning: { label: "Uyarı", icon: "!", tone: "warning" },
  info: { label: "Bilgi", icon: "i", tone: "info" },
};

function alertCardHtml(alert) {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
  const href = alert.vehicleId ? `/vehicle/${alert.vehicleId}` : "/alerts";
  return `<article class="corp-alert corp-alert--${meta.tone}">
    <div class="corp-alert__icon" aria-hidden="true">${meta.icon}</div>
    <div class="corp-alert__body">
      <div class="corp-alert__head">
        <strong class="corp-alert__title">${escapeHtml(alert.title)}</strong>
        <span class="corp-alert__badge">${escapeHtml(meta.label)}</span>
      </div>
      <p class="corp-alert__plate">${escapeHtml(alert.plate || "—")}</p>
      <p class="corp-alert__message">${escapeHtml(alert.message || "")}</p>
      ${alert.amount != null ? `<p class="corp-alert__meta">${money(alert.amount)}</p>` : ""}
      ${alert.deltaPercent != null ? `<p class="corp-alert__meta">+%${Number(alert.deltaPercent).toLocaleString("tr-TR")}</p>` : ""}
      ${alert.count != null ? `<p class="corp-alert__meta">${Number(alert.count)} kayıt</p>` : ""}
    </div>
    <a href="${href}" class="corp-alert__link">Detay →</a>
  </article>`;
}

function alertSectionHtml(title, desc, alerts, emptyText) {
  const body = alerts.length
    ? `<div class="corp-alert-grid">${alerts.map(alertCardHtml).join("")}</div>`
    : `<div class="corp-alert-empty">${escapeHtml(emptyText)}</div>`;
  return `<section class="panel corp-alert-section fade-in">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">${escapeHtml(title)}</h2>
        <p class="panel__desc">${escapeHtml(desc)} · ${alerts.length} uyarı</p>
      </div>
    </header>
    <div class="panel__body">${body}</div>
  </section>`;
}

function alertsPageHtml(summary) {
  const { byType, total, critical, warning, info } = summary;
  return `<div class="dash page-enter alerts-hub">
    <header class="alerts-hub__header fade-in">
      <p class="alerts-hub__eyebrow">Filo Operasyonu · Uyarı Motoru</p>
      <h2 class="alerts-hub__title">Kurumsal Uyarılar</h2>
      <p class="alerts-hub__desc">Zarar, yakıt/HGS anomalileri ve bakım risklerini tek ekranda izleyin.</p>
    </header>

    <div class="corp-alert-summary-row fade-in">
      <article class="corp-alert-kpi corp-alert-kpi--critical">
        <span>Kritik</span><strong>${critical.toLocaleString("tr-TR")}</strong>
      </article>
      <article class="corp-alert-kpi corp-alert-kpi--warning">
        <span>Uyarı</span><strong>${warning.toLocaleString("tr-TR")}</strong>
      </article>
      <article class="corp-alert-kpi corp-alert-kpi--info">
        <span>Bilgi</span><strong>${info.toLocaleString("tr-TR")}</strong>
      </article>
      <article class="corp-alert-kpi corp-alert-kpi--total">
        <span>Toplam Uyarı</span><strong>${total.toLocaleString("tr-TR")}</strong>
      </article>
    </div>

    ${alertSectionHtml(
      "Kritik Uyarılar",
      "Zarar eden araçlar",
      byType.LOSS_VEHICLE,
      "Zarar eden araç bulunmuyor."
    )}
    ${alertSectionHtml(
      "Yakıt Anomalileri",
      "Son 3 ay ortalamasına göre %30+ artış",
      byType.FUEL_ANOMALY,
      "Yakıt anomalisi tespit edilmedi."
    )}
    ${alertSectionHtml(
      "HGS Anomalileri",
      "Son 3 ay ortalamasına göre %50+ artış",
      byType.HGS_ANOMALY,
      "HGS anomalisi tespit edilmedi."
    )}
    ${alertSectionHtml(
      "Bakım Riskleri",
      "Son 90 günde 4+ bakım kaydı",
      byType.MAINTENANCE_RISK,
      "Bakım riski tespit edilmedi."
    )}
  </div>`;
}

function dashboardAlertsPanel(summary) {
  const { total, critical, preview } = summary;
  if (!total) {
    return `<section class="cmd-panel cmd-panel--alerts fade-in">
      <header class="cmd-panel__head">
        <div>
          <h3 class="cmd-panel__title">Kurumsal Uyarılar</h3>
          <p class="cmd-panel__desc">Aktif uyarı yok</p>
        </div>
        <a href="/alerts" class="btn btn--ghost btn--sm">Tümü →</a>
      </header>
      <div class="panel__body"><p class="corp-alert-empty">Şu an kritik veya operasyonel uyarı bulunmuyor.</p></div>
    </section>`;
  }

  const items = preview
    .map(
      (a) => `<li class="corp-alert-preview corp-alert-preview--${a.severity}">
        <span class="corp-alert-preview__type">${escapeHtml(a.title)}</span>
        <strong>${escapeHtml(a.plate || "—")}</strong>
        <em>${escapeHtml(a.message || "")}</em>
      </li>`
    )
    .join("");

  return `<section class="cmd-panel cmd-panel--alerts fade-in">
    <header class="cmd-panel__head">
      <div>
        <h3 class="cmd-panel__title">Kurumsal Uyarılar</h3>
        <p class="cmd-panel__desc">${critical} kritik · ${total} toplam</p>
      </div>
      <a href="/alerts" class="btn btn--ghost btn--sm">Tümü →</a>
    </header>
    <div class="panel__body">
      <ul class="corp-alert-preview-list">${items}</ul>
    </div>
  </section>`;
}

module.exports = {
  alertsPageHtml,
  dashboardAlertsPanel,
  alertCardHtml,
};
