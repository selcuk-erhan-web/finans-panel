const { escapeHtml } = require("./escape");

function settingsTabsHtml(activeTab) {
  const tabs = [
    { id: "system", label: "Sistem" },
    { id: "security", label: "Güvenlik" },
    { id: "data", label: "Veri Yönetimi" },
    { id: "export", label: "Dışa Aktarma" },
  ];
  return `<nav class="settings-tabs" aria-label="Ayarlar sekmeleri">
    ${tabs
      .map(
        (t) =>
          `<a href="/settings?tab=${t.id}" class="settings-tab ${activeTab === t.id ? "is-active" : ""}">${escapeHtml(t.label)}</a>`
      )
      .join("")}
  </nav>`;
}

function settingsPageHtml({ activeTab, stats, users, port, username, dataPrepService, INCOME_CATEGORIES, EXPENSE_CATEGORIES, VEHICLE_TARGET }) {
  const tab = activeTab || "system";

  const systemPanel = `<section class="settings-panel">
    <h3 class="settings-panel__title">Sistem özeti</h3>
    <div class="info-grid info-grid--compact">
      <div class="info-item"><span>Veritabanı</span><strong>SQLite</strong></div>
      <div class="info-item"><span>Araç</span><strong>${stats.vehicles} / ${VEHICLE_TARGET}</strong></div>
      <div class="info-item"><span>İşlem</span><strong>${stats.transactions}</strong></div>
      <div class="info-item"><span>Bakım / Yakıt</span><strong>${stats.maintenance} / ${stats.fuel}</strong></div>
      <div class="info-item"><span>Oturum</span><strong>${escapeHtml(username || "—")}</strong></div>
      <div class="info-item"><span>Adres</span><strong>localhost:${port}</strong></div>
    </div>
    <h4 class="settings-panel__subtitle">Kategoriler</h4>
    <p class="settings-panel__text"><strong>Gelir:</strong> ${INCOME_CATEGORIES.join(", ")}</p>
    <p class="settings-panel__text"><strong>Gider:</strong> ${EXPENSE_CATEGORIES.join(", ")}</p>
  </section>`;

  const securityPanel = `<section class="settings-panel">
    <h3 class="settings-panel__title">Şifre değiştir</h3>
    <form method="POST" action="/settings/password" class="form-grid settings-form">
      <input type="password" name="password" placeholder="Yeni şifre" required minlength="4"/>
      <input type="password" name="password2" placeholder="Tekrar" required minlength="4"/>
      <button type="submit" class="btn btn--primary">Güncelle</button>
    </form>
    <h4 class="settings-panel__subtitle">Admin kullanıcılar</h4>
    <div class="table-wrap">
      <table class="data-table data-table--compact"><thead><tr><th>Kullanıcı</th><th>Rol</th></tr></thead><tbody>
        ${users.map((u) => `<tr><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.role)}</td></tr>`).join("")}
      </tbody></table>
    </div>
  </section>`;

  const dataPanel = `<section class="settings-panel panel--danger-zone">
    <h3 class="settings-panel__title">Gerçek veri hazırlığı</h3>
    <p class="settings-panel__text">Demo/test kayıtlarını temizlemeden önce otomatik yedek alınır.</p>
    <div class="prep-stats prep-stats--compact">
      <div class="prep-stat"><span>Araç</span><strong>${stats.vehicles}</strong></div>
      <div class="prep-stat"><span>Gelir</span><strong>${stats.income}</strong></div>
      <div class="prep-stat"><span>Gider</span><strong>${stats.expense}</strong></div>
      <div class="prep-stat"><span>Yakıt</span><strong>${stats.fuel}</strong></div>
      <div class="prep-stat"><span>Bakım</span><strong>${stats.maintenance}</strong></div>
      <div class="prep-stat"><span>Import</span><strong>${stats.importBatches}</strong></div>
    </div>
    <form method="POST" action="/settings/purge-demo" class="prep-form" id="purgeDemoForm">
      <label class="prep-label">Onay: <code>${dataPrepService.CONFIRM_DEMO}</code></label>
      <input type="text" name="confirm_phrase" class="prep-input" placeholder="${escapeHtml(dataPrepService.CONFIRM_DEMO)}" autocomplete="off" required />
      <label class="filter-check prep-check">
        <input type="checkbox" name="include_vehicles" value="1" id="includeVehiclesCheck"/> Araçları da temizle
      </label>
      <div class="prep-vehicle-confirm" id="vehicleConfirmBlock" hidden>
        <label class="prep-label">Araç onayı: <code>${dataPrepService.CONFIRM_VEHICLES}</code></label>
        <input type="text" name="vehicle_confirm_phrase" class="prep-input" placeholder="${escapeHtml(dataPrepService.CONFIRM_VEHICLES)}" autocomplete="off"/>
      </div>
      <button type="submit" class="btn btn--danger" onclick="return confirm('Demo verileri silinecek. Devam?')">Demo Verilerini Temizle</button>
    </form>
    <script>
      (function(){
        var cb = document.getElementById('includeVehiclesCheck');
        var block = document.getElementById('vehicleConfirmBlock');
        var input = block && block.querySelector('input');
        if (!cb || !block) return;
        cb.addEventListener('change', function(){
          block.hidden = !cb.checked;
          if (input) input.required = cb.checked;
        });
      })();
    </script>
  </section>`;

  const exportPanel = `<section class="settings-panel">
    <h3 class="settings-panel__title">Dışa aktarma</h3>
    <p class="settings-panel__text">Tarih filtreli CSV, Excel ve PDF raporları.</p>
    <div class="export-actions export-actions--grid">
      <a class="btn btn--ghost" href="/income/export">Gelir CSV</a>
      <a class="btn btn--ghost" href="/income/export?format=xlsx">Gelir Excel</a>
      <a class="btn btn--ghost" href="/expense/export">Gider CSV</a>
      <a class="btn btn--ghost" href="/expense/export?format=xlsx">Gider Excel</a>
      <a class="btn btn--primary" href="/export/fleet/pdf">PDF Filo Raporu</a>
      <a class="btn btn--ghost" href="/export/maintenance/xlsx">Bakım Excel</a>
      <a class="btn btn--ghost" href="/export/fuel/xlsx">Yakıt Excel</a>
    </div>
  </section>`;

  const panels = {
    system: systemPanel,
    security: securityPanel,
    data: dataPanel,
    export: exportPanel,
  };

  return `<div class="dash page-enter dash--dense settings-hub">
    <header class="settings-hub__header">
      <h2 class="settings-hub__title">Ayarlar</h2>
      <p class="settings-hub__desc">Sistem, güvenlik, veri yönetimi ve dışa aktarma</p>
    </header>
    ${settingsTabsHtml(tab)}
    <div class="settings-panel-wrap">${panels[tab] || panels.system}</div>
  </div>`;
}

module.exports = { settingsPageHtml, settingsTabsHtml };
