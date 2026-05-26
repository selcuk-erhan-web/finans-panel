const db = require("../lib/db");
const { INCOME_CATEGORIES, EXPENSE_CATEGORIES, VEHICLE_TARGET } = require("../lib/constants");
const { pageHeader, renderLayout } = require("../lib/ui");

function registerSettings(app, port) {
  app.get("/settings", (req, res) => {
    const vehicleCount = db.prepare("SELECT COUNT(*) as c FROM vehicles").get().c;
    const txCount = db.prepare("SELECT COUNT(*) as c FROM transactions").get().c;

    const content = `
      ${pageHeader("Ayarlar", "Sistem ve dışa aktarma")}
      <div class="card">
        <h2>Sistem</h2>
        <table>
          <tr><th>Veritabanı</th><td>SQLite (data.db) — kayıtlar korunur</td></tr>
          <tr><th>Araç</th><td>${vehicleCount} / ${VEHICLE_TARGET}</td></tr>
          <tr><th>İşlem</th><td>${txCount}</td></tr>
          <tr><th>Telegram</th><td>Devre dışı</td></tr>
          <tr><th>Adres</th><td>http://localhost:${port}</td></tr>
        </table>
      </div>
      <div class="card">
        <h2>Dışa Aktarma (Excel hazırlığı)</h2>
        <p class="muted">Gelir ve gider listelerinden CSV indirebilirsiniz. Excel’de doğrudan açılır (UTF-8 BOM).</p>
        <p class="actions" style="margin-top:16px">
          <a class="btn btn-export" href="/income/export">📥 Gelirleri İndir</a>
          <a class="btn btn-export" href="/expense/export">📥 Giderleri İndir</a>
        </p>
      </div>
      <div class="card">
        <h2>Kategoriler</h2>
        <p class="muted"><strong>Gelir:</strong> ${INCOME_CATEGORIES.join(", ")}</p>
        <p class="muted" style="margin-top:8px"><strong>Gider:</strong> ${EXPENSE_CATEGORIES.join(", ")}</p>
      </div>`;

    renderLayout(res, "Ayarlar", content, "/settings", req);
  });
}

module.exports = registerSettings;
