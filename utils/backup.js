const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const BACKUP_DIR = path.resolve(path.join(__dirname, "..", "backups"));

function resolveMainDbPath() {
  const db = require("../lib/db");
  return path.resolve(db.DB_PATH || db.name);
}

function assertBackupPathsSafe(sourcePath, destPath) {
  const source = path.resolve(sourcePath);
  const dest = path.resolve(destPath);
  const backupRoot = path.resolve(BACKUP_DIR);

  if (source === dest) {
    throw new Error("Yedek hedefi kaynak veritabanı ile aynı olamaz (data.db korunmalı).");
  }

  if (!dest.startsWith(`${backupRoot}${path.sep}`)) {
    throw new Error(`Yedek dosyası yalnızca ${backupRoot} dizinine yazılabilir.`);
  }

  const sourceDir = path.dirname(source);
  if (dest.startsWith(`${sourceDir}${path.sep}`) && path.basename(dest) === path.basename(source)) {
    throw new Error("Yedek hedefi data.db üzerine yazılamaz.");
  }
}

function backupDatabase() {
  const DB_PATH = resolveMainDbPath();

  if (!DB_PATH || !fs.existsSync(DB_PATH)) {
    throw new Error("Veritabanı dosyası bulunamadı (data.db).");
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const name = `data_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.db`;
  const dest = path.resolve(BACKUP_DIR, name);

  assertBackupPathsSafe(DB_PATH, dest);

  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }

  // Use a separate read-only connection so the main read-write handle is never touched.
  const reader = new Database(DB_PATH, {
    readonly: true,
    fileMustExist: true,
    timeout: 10000,
  });

  try {
    reader.prepare("VACUUM INTO ?").run(dest);
  } finally {
    reader.close();
  }

  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1) {
    throw new Error("Yedekleme doğrulanamadı.");
  }

  return dest;
}

module.exports = { backupDatabase, BACKUP_DIR };
