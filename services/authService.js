const db = require("../lib/db");
const { verifyPassword, hashPassword } = require("../utils/password");
const { createSession } = require("../utils/session");

function findByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function authenticate(username, password) {
  const user = findByUsername(username?.trim());
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

function createSessionToken(user) {
  return createSession(user);
}

function listUsers() {
  return db.prepare("SELECT id, username, role, created_at FROM users ORDER BY id").all();
}

function createUser(username, password, role = "admin") {
  db.prepare(
    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`
  ).run(username.trim(), hashPassword(password), role);
}

function changePassword(userId, newPassword) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPassword(newPassword),
    userId
  );
}

module.exports = {
  authenticate,
  createSessionToken,
  findByUsername,
  listUsers,
  createUser,
  changePassword,
};
