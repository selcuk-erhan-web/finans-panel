const crypto = require("crypto");

const COOKIE_NAME = "mistur_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.SESSION_SECRET || "mistur-fleet-dev-secret-change-in-prod";
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign(token) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function createSession(user) {
  return sign({
    uid: user.id,
    username: user.username,
    role: user.role || "admin",
    exp: Date.now() + MAX_AGE_MS,
  });
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(rest.join("="));
  });
  return out;
}

function getSessionFromReq(req) {
  const cookies = parseCookies(req.headers.cookie);
  return unsign(cookies[COOKIE_NAME]);
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(MAX_AGE_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

module.exports = {
  COOKIE_NAME,
  createSession,
  getSessionFromReq,
  setSessionCookie,
  clearSessionCookie,
};
