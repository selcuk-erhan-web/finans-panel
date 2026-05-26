const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "data.db"));

function runMigrations() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT,
      brand TEXT,
      model TEXT,
      year TEXT,
      km INTEGER,
      type TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      type TEXT,
      category TEXT,
      amount INTEGER,
      note TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  [
    "ALTER TABLE vehicles ADD COLUMN type TEXT",
    "ALTER TABLE vehicles ADD COLUMN km INTEGER",
    "ALTER TABLE vehicles ADD COLUMN brand TEXT",
    "ALTER TABLE vehicles ADD COLUMN model TEXT",
    "ALTER TABLE vehicles ADD COLUMN year TEXT",
    "ALTER TABLE transactions ADD COLUMN vehicle_id INTEGER",
    "ALTER TABLE transactions ADD COLUMN category TEXT",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });
}

runMigrations();

module.exports = db;
