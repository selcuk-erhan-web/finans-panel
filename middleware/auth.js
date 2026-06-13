const { getSessionFromReq } = require("../utils/session");

function isPublic(path) {
  if (path === "/login") return true;
  if (path.startsWith("/css/") || path.startsWith("/js/")) return true;
  return false;
}

function requireAuth(req, res, next) {
  if (isPublic(req.path)) return next();
  const session = getSessionFromReq(req);
  if (session) {
    req.user = session;
    return next();
  }
  return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl || "/"));
}

module.exports = { requireAuth, isPublic };
