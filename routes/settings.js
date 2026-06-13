const db = require("../lib/db");
const { INCOME_CATEGORIES, EXPENSE_CATEGORIES, VEHICLE_TARGET } = require("../lib/constants");
const authService = require("../services/authService");
const dataPrepService = require("../services/dataPrepService");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout, glassPanel, escapeHtml } = require("../lib/ui");

function registerSettings(app, port) {
  app.get("/settings", (req, res) => {
    const stats = dataPrepService.getStats();
    const users = authService.listUsers();

    const content = `
      <div class="dash page-enter">
        <p class="page-lead">Sistem · güvenlik · dışa aktarma · gerçek veri hazırlığı</p>
        ${glassPanel({
          title: "Gerçek Veri Hazırlığı",
          desc: "9 araçlık gerçek operasyon öncesi demo/test kayıtlarını güvenli şekilde temizleyin",
          className: "panel--danger-zone",
          body: `<div class="prep-stats">
            <div class="prep-stat"><span>Araç</span><strong>${stats.vehicles}</strong></div>
            <div class="prep-stat"><span>Gelir kaydı</span><strong>${stats.income}</strong></div>
            <div class="prep-stat"><span>Gider kaydı</span><strong>${stats.expense}</strong></div>
            <div class="prep-stat"><span>Ortak gider</span><strong>${stats.sharedExpense}</strong></div>
            <div class="prep-stat"><span>Yakıt kaydı</span><strong>${stats.fuel}</strong></div>
            <div class="prep-stat"><span>Bakım kaydı</span><strong>${stats.maintenance}</strong></div>
            <div class="prep-stat"><span>Eşleşmeyen plaka</span><strong>${stats.unmatchedPlates}</strong></div>
            <div class="prep-stat"><span>Import batch</span><strong>${stats.importBatches}</strong></div>
          </div>
          <p class="prep-warning">
            Temizlik önce <strong>data.db yedeği</strong> alır. Onay metni yazılmadan hiçbir kayıt silinmez.
            Araçlar varsayılan olarak korunur.
          </p>
          <form method="POST" action="/settings/purge-demo" class="prep-form" id="purgeDemoForm">
            <label class="prep-label">Onay metni — tam olarak yazın: <code>${dataPrepService.CONFIRM_DEMO}</code></label>
            <input type="text" name="confirm_phrase" class="prep-input" placeholder="${escapeHtml(dataPrepService.CONFIRM_DEMO)}" autocomplete="off" required />
            <label class="filter-check prep-check">
              <input type="checkbox" name="include_vehicles" value="1" id="includeVehiclesCheck"/>
              Araçları da temizle (ayrı onay gerekir)
            </label>
            <div class="prep-vehicle-confirm" id="vehicleConfirmBlock" hidden>
              <label class="prep-label">Araç temizliği onayı: <code>${dataPrepService.CONFIRM_VEHICLES}</code></label>
              <input type="text" name="vehicle_confirm_phrase" class="prep-input" placeholder="${escapeHtml(dataPrepService.CONFIRM_VEHICLES)}" autocomplete="off"/>
            </div>
            <button type="submit" class="btn btn--danger" onclick="return confirm('Demo/test verileri silinecek. Önce yedek alınır. Devam?')">
              Demo/Test Verilerini Temizle
            </button>
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
          </script>`,
        })}
        ${glassPanel({
          title: "Sistem özeti",
          body: `<div class="info-grid">
            <div class="info-item"><span>Veritabanı</span><strong>SQLite (korunur)</strong></div>
            <div class="info-item"><span>Araç</span><strong>${stats.vehicles} / ${VEHICLE_TARGET}</strong></div>
            <div class="info-item"><span>İşlem</span><strong>${stats.transactions}</strong></div>
            <div class="info-item"><span>Bakım / Yakıt</span><strong>${stats.maintenance} / ${stats.fuel}</strong></div>
            <div class="info-item"><span>Oturum</span><strong>${escapeHtml(req.user?.username || "—")}</strong></div>
            <div class="info-item"><span>Adres</span><strong>localhost:${port}</strong></div>
          </div>`,
        })}
        ${glassPanel({
          title: "Dışa aktarma",
          desc: "Tarih filtreli CSV / Excel / PDF",
          body: `<div class="export-actions">
            <a class="btn btn--ghost" href="/income/export">Gelir CSV</a>
            <a class="btn btn--ghost" href="/income/export?format=xlsx">Gelir Excel</a>
            <a class="btn btn--ghost" href="/expense/export">Gider CSV</a>
            <a class="btn btn--ghost" href="/expense/export?format=xlsx">Gider Excel</a>
            <a class="btn btn--primary" href="/export/fleet/pdf">PDF Filo Raporu</a>
            <a class="btn btn--ghost" href="/export/maintenance/xlsx">Bakım Excel</a>
            <a class="btn btn--ghost" href="/export/fuel/xlsx">Yakıt Excel</a>
          </div>`,
        })}
        ${glassPanel({
          title: "Şifre değiştir",
          body: `<form method="POST" action="/settings/password" class="form-grid" style="max-width:400px">
            <input type="password" name="password" placeholder="Yeni şifre" required minlength="4"/>
            <input type="password" name="password2" placeholder="Tekrar" required minlength="4"/>
            <button type="submit" class="btn btn--primary">Güncelle</button>
          </form>`,
        })}
        ${glassPanel({
          title: "Admin kullanıcılar",
          body: `<table class="data-table"><thead><tr><th>Kullanıcı</th><th>Rol</th></tr></thead><tbody>
            ${users.map((u) => `<tr><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.role)}</td></tr>`).join("")}
          </tbody></table>`,
        })}
        ${glassPanel({
          title: "Kategoriler",
          body: `<p class="page-lead"><strong>Gelir:</strong> ${INCOME_CATEGORIES.join(", ")}</p>
            <p class="page-lead"><strong>Gider:</strong> ${EXPENSE_CATEGORIES.join(", ")}</p>
            <p class="page-lead"><strong>Ortak gider:</strong> Araç seçilmeden kaydedilen giderler filo toplamına dahil edilir.</p>`,
        })}
      </div>`;

    renderLayout(res, "Ayarlar", content, "/settings", req, {
      pageTitle: "Ayarlar",
      breadcrumb: "Sistem / Ayarlar",
    });
  });

  app.post("/settings/purge-demo", (req, res) => {
    try {
      const includeVehicles = req.body.include_vehicles === "1";
      const result = dataPrepService.purgeDemoData({
        confirmPhrase: req.body.confirm_phrase,
        includeVehicles,
        vehicleConfirmPhrase: req.body.vehicle_confirm_phrase,
      });
      console.log("Demo temizlik yedeği:", result.backupPath);
      redirectWithFlash(res, "/settings", "demo_purged");
    } catch (e) {
      redirectWithFlash(res, "/settings?err=1&msg=" + encodeURIComponent(e.message), "demo_purge_failed");
    }
  });

  app.post("/settings/password", (req, res) => {
    const { password, password2 } = req.body;
    if (password !== password2 || !password) {
      return redirectWithFlash(res, "/settings?err=1&msg=" + encodeURIComponent("Şifreler eşleşmiyor"));
    }
    if (req.user?.uid) authService.changePassword(req.user.uid, password);
    redirectWithFlash(res, "/settings", "password_updated");
  });
}

module.exports = registerSettings;
