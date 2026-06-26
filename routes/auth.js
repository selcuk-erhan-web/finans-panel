const authService = require("../services/authService");
const { setSessionCookie, clearSessionCookie } = require("../utils/session");
const { renderExecutiveLoginPage } = require("../lib/components/loginPage");

function registerAuth(app) {
  app.get("/login", (req, res) => {
    const next = req.query.next || "/";
    const err = req.query.err;
    res.send(
      renderExecutiveLoginPage({
        next,
        err,
      })
    );
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
