const crypto = require("crypto");

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, KEY_LEN, SCRYPT_OPTS);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(plain, stored) {
  if (!stored || !plain) return false;
  const parts = String(stored).split(":");
  if (parts[0] !== "scrypt" || parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(String(plain), salt, KEY_LEN, SCRYPT_OPTS);
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
