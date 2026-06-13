const { renderLayout, glassPanel, escapeHtml } = require("../lib/components");

function registerHgs(app) {
  app.get("/hgs", (req, res) => {
    const content = `
      <div class="dash page-enter">
        <section class="hgs-placeholder fade-in">
          <div class="hgs-placeholder__icon" aria-hidden="true">🛣</div>
          <h2>HGS Yönetimi</h2>
          <p class="hgs-placeholder__lead">
            HGS geçiş kayıtları ve PDF rapor entegrasyonu bu aşamada hazırlanıyor.
            Öncelik yakıt import stabilizasyonu ve veri güvenliğindedir.
          </p>
          ${glassPanel({
            title: "Planlanan özellikler",
            body: `<ul class="hgs-placeholder__list">
              <li>HGS PDF / Excel rapor içe aktarma</li>
              <li>Plaka bazlı geçiş eşleştirme</li>
              <li>Otomatik gider kaydı oluşturma</li>
              <li>Audit log entegrasyonu</li>
            </ul>
            <p class="hgs-placeholder__note">${escapeHtml("Bu sayfa placeholder olarak hazırlanmıştır — işlev henüz aktif değildir.")}</p>
          `})}
        </section>
      </div>`;

    renderLayout(res, "HGS Yönetimi", content, "/hgs", req, {
      pageTitle: "HGS Yönetimi",
      breadcrumb: "Operasyon / HGS (Hazırlık)",
    });
  });
}

module.exports = registerHgs;
