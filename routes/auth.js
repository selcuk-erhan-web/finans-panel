const authService = require("../services/authService");
const { setSessionCookie, clearSessionCookie } = require("../utils/session");
const { escapeHtml } = require("../lib/components/escape");

function registerAuth(app) {
  app.get("/login", (req, res) => {
    const next = req.query.next || "/";
    const err = req.query.err;
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Giriş · MISTUR FleetOS</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/css/main.css?v=fleetos-8"/>
</head>
<body class="login-page">
  <div class="login-card fade-in">
    <div class="login-card__brand">
      <div class="sidebar__logo">M</div>
      <div>
        <div class="sidebar__name">MISTUR</div>
        <div class="sidebar__tag">Akıllı Filo Operasyon Platformu</div>
      </div>
    </div>
    <h1>MISTUR FleetOS</h1>
    <p class="login-card__sub">Akıllı filo operasyon platformuna giriş yapın</p>
    ${err ? `<div class="login-error">${escapeHtml(err)}</div>` : ""}
    <form method="POST" action="/login" class="login-form">
      <input type="hidden" name="next" value="${escapeHtml(next)}"/>
      <label>Kullanıcı adı</label>
      <input name="username" required autocomplete="username" placeholder="admin"/>
      <label>Şifre</label>
      <input name="password" type="password" required autocomplete="current-password" placeholder="••••••••"/>
      <button type="submit" class="btn btn--primary full">Giriş Yap</button>
    </form>
    <p class="login-hint">Varsayılan: admin / 1234 (ilk kurulum)</p>
  </div>
  <script src="/js/main.js?v=fleetos-8"></script>
</body>
</html>`);
  });

  app.post("/login", (req, res) => {
    const { username, password, next } = req.body;
    const user = authService.authenticate(username, password);
    if (!user) {
      return res.redirect(
        "/login?err=" + encodeURIComponent("Hatalı kullanıcı adı veya şifre") + "&next=" + encodeURIComponent(next || "/")
      );
    }
    setSessionCookie(res, authService.createSessionToken(user));
    res.redirect(next && next.startsWith("/") ? next : "/");
  });

  app.get("/logout", (req, res) => {
    clearSessionCookie(res);
    res.redirect("/login");
  });
}

module.exports = registerAuth;
