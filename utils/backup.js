const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data.db");
const BACKUP_DIR = path.join(__dirname, "..", "backups");

function backupDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error("Veritabanı dosyası bulunamadı (data.db).");
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const name = `data_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.db`;
  const dest = path.join(BACKUP_DIR, name);
  fs.copyFileSync(DB_PATH, dest);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1) {
    throw new Error("Yedekleme doğrulanamadı.");
  }
  return dest;
}

module.exports = { backupDatabase, BACKUP_DIR, DB_PATH };
