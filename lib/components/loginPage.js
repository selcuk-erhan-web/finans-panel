const { escapeHtml } = require("./escape");
const LAYOUT_VERSION = require("../layout-version");

const LOGIN_FLEET_SHOWCASE = [
  { plate: "16 SYV 16", src: "/images/vehicles/vito-clean.png", label: "Vito" },
  { plate: "16 LR 005", src: "/images/vehicles/bus-clean.png", label: "Otobüs" },
  { plate: "16 LA 005", src: "/images/vehicles/sprinter-clean.png", label: "Sprinter" },
];

const LOGIN_FEATURES = [
  {
    title: "Gelir & Gider Takibi",
    desc: "Filo kârlılığını anlık izleyin",
    accent: "#ef4444",
  },
  {
    title: "Bakım Yönetimi",
    desc: "Planlı bakım ve servis takibi",
    accent: "#f97316",
  },
  {
    title: "Uygunluk & Risk Kontrolü",
    desc: "Evrak ve risk sinyalleri tek ekranda",
    accent: "#8b5cf6",
  },
  {
    title: "Operasyonel İzleme",
    desc: "Yakıt, HGS ve operasyon görünürlüğü",
    accent: "#22c55e",
  },
];

function loginFleetShowcaseHtml() {
  const items = LOGIN_FLEET_SHOWCASE.map(
    (item) => `<figure class="login-hero__showcase-item">
      <div class="login-hero__showcase-thumb">
        <img
          src="${escapeHtml(item.src)}"
          alt="${escapeHtml(item.plate)}"
          class="login-hero__showcase-img"
          loading="lazy"
          onerror="this.hidden=true;this.nextElementSibling.hidden=false"
        />
        <span class="login-hero__showcase-fallback" hidden aria-hidden="true">🚐</span>
      </div>
      <figcaption class="login-hero__showcase-plate">${escapeHtml(item.plate)}</figcaption>
    </figure>`
  ).join("");

  return `<div class="login-hero__showcase" aria-label="Mistur filo araç görünümü">
    <p class="login-hero__showcase-label">Mistur filosundan seçili araç görünümü</p>
    <div class="login-hero__showcase-row">${items}</div>
  </div>`;
}

function loginFeatureCardsHtml() {
  return LOGIN_FEATURES.map(
    (item) => `<article class="login-hero__feature">
      <span class="login-hero__feature-line" style="background:${item.accent}"></span>
      <div>
        <strong class="login-hero__feature-title">${escapeHtml(item.title)}</strong>
        <p class="login-hero__feature-desc">${escapeHtml(item.desc)}</p>
      </div>
    </article>`
  ).join("");
}

function renderExecutiveLoginPage({ next = "/", err = "" } = {}) {
  const errorHtml = err
    ? `<div class="login-error" role="alert">${escapeHtml(err)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr" data-layout="${LAYOUT_VERSION}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Giriş · MISTUR FleetOS</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/css/main.css?v=${LAYOUT_VERSION}"/>
</head>
<body class="login-page login-page--executive">
  <div class="login-shell">
    <aside class="login-hero" aria-label="MISTUR FleetOS platform tanıtımı">
      <div class="login-hero__lines" aria-hidden="true">
        <span class="login-hero__line login-hero__line--red"></span>
        <span class="login-hero__line login-hero__line--orange"></span>
        <span class="login-hero__line login-hero__line--purple"></span>
        <span class="login-hero__line login-hero__line--green"></span>
      </div>
      <div class="login-hero__inner">
        <div class="login-hero__brand">
          <img
            src="/images/mistur-fleetos-logo.png"
            alt="MISTUR FleetOS"
            class="login-hero__logo"
          />
          <p class="login-hero__slogan">Executive Fleet Management Platform</p>
        </div>
        <p class="login-hero__desc">
          Gelir, gider, bakım, uygunluk ve operasyon yönetimini tek merkezden yönetin.
        </p>
        ${loginFleetShowcaseHtml()}
        <div class="login-hero__features">${loginFeatureCardsHtml()}</div>
      </div>
    </aside>

    <main class="login-panel">
      <div class="login-card login-card--executive fade-in">
        <header class="login-card__head">
          <h2 class="login-card__title">Sisteme Giriş Yapın</h2>
          <p class="login-card__sub">Devam etmek için bilgilerinizi giriniz.</p>
        </header>
        ${errorHtml}
        <form method="POST" action="/login" class="login-form login-form--executive" id="loginForm">
          <input type="hidden" name="next" value="${escapeHtml(next)}"/>
          <label class="login-form__label" for="loginUsername">Kullanıcı Adı</label>
          <input
            id="loginUsername"
            name="username"
            required
            autocomplete="username"
            placeholder="admin"
            class="login-form__input"
          />
          <label class="login-form__label" for="loginPassword">Şifre</label>
          <div class="login-form__password-wrap">
            <input
              id="loginPassword"
              name="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="login-form__input login-form__input--password"
            />
            <button type="button" class="login-form__toggle" id="loginPasswordToggle" aria-label="Şifreyi göster">
              Göster
            </button>
          </div>
          <div class="login-form__options">
            <label class="login-form__remember">
              <input type="checkbox" id="loginRemember"/>
              <span>Beni Hatırla</span>
            </label>
            <a href="#" class="login-form__forgot" onclick="return false;">Şifremi Unuttum</a>
          </div>
          <button type="submit" class="btn btn--primary login-form__submit login-form__submit--premium">Giriş Yap</button>
        </form>
        <div class="login-secure">
          <span class="login-secure__icon" aria-hidden="true">🔒</span>
          <div>
            <strong class="login-secure__title">Güvenli Bağlantı</strong>
            <p class="login-secure__text">Verileriniz SSL ile korunmaktadır.</p>
          </div>
        </div>
        <p class="login-hint login-hint--dev">Varsayılan: admin / 1234 (ilk kurulum)</p>
        <footer class="login-card__footer">
          <span>v1.0.0</span>
          <span>© Mistur FleetOS</span>
        </footer>
      </div>
    </main>
  </div>
  <script>
    (function () {
      var input = document.getElementById("loginPassword");
      var toggle = document.getElementById("loginPasswordToggle");
      if (!input || !toggle) return;
      toggle.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        toggle.textContent = show ? "Gizle" : "Göster";
        toggle.setAttribute("aria-label", show ? "Şifreyi gizle" : "Şifreyi göster");
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  renderExecutiveLoginPage,
  LOGIN_FEATURES,
  LOGIN_FLEET_SHOWCASE,
};
