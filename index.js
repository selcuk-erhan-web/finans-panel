const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const cron = require("node-cron");

// TOKENINI BURAYA YAPIŞTIR
const token = "8610203796:AAEorm73zD4pZ0-nyWSPZ6l-QvZMC9zoETU";

const bot = new TelegramBot(token, { polling: true });

// Veritabanı oluştur
const db = new sqlite3.Database('./data.db');

db.run(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  amount INTEGER,
  note TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
bot.onText(/\/rapor/, (msg) => {

  db.all("SELECT * FROM transactions", [], (err, rows) => {

    if (err) {
      return bot.sendMessage(msg.chat.id, "Hata oluştu");
    }

    let income = 0;
    let expense = 0;

    rows.forEach(r => {
      if (r.type === "income") income += r.amount;
      if (r.type === "expense") expense += r.amount;
    });

    const balance = income - expense;

    bot.sendMessage(
      msg.chat.id,
      `📊 RAPOR\n\nGelir: ${income} TL\nGider: ${expense} TL\nBakiye: ${balance} TL`
    );

  });

});
bot.on("message", (msg) => {
console.log(msg.chat.id);
  const text = msg.text;

  if (!text) return;

  // GELIR
  if (text.startsWith("+")) {

    const parts = text.split(" ");

    const amount = parseInt(parts[1]);

    const note = parts.slice(2).join(" ");

    db.run(
      "INSERT INTO transactions (type, amount, note) VALUES (?, ?, ?)",
      ["income", amount, note]
    );

    bot.sendMessage(
      msg.chat.id,
      `✅ Gelir kaydedildi: ${amount}`
    );
  }

  // GIDER
  else if (text.startsWith("-")) {

    const parts = text.split(" ");

    const amount = parseInt(parts[1]);

    const note = parts.slice(2).join(" ");

    db.run(
      "INSERT INTO transactions (type, amount, note) VALUES (?, ?, ?)",
      ["expense", amount, note]
    );

    bot.sendMessage(
      msg.chat.id,
      `❌ Gider kaydedildi: ${amount}`
    );
  }

  // YARDIM
  else {

    bot.sendMessage(
      msg.chat.id,
      "Kullanım:\n+ 5000 ödeme\n- 2000 yakıt"
    );
  }

});cron.schedule("0 9 * * *", () => {

  db.all("SELECT * FROM transactions", [], (err, rows) => {

    if (err) return;

    let income = 0;
    let expense = 0;

    rows.forEach(r => {
      if (r.type === "income") income += r.amount;
      if (r.type === "expense") expense += r.amount;
    });

    const balance = income - expense;

    // KENDİ CHAT ID'Nİ BURAYA YAZACAKSIN
    const chatId = "2127529337";

    bot.sendMessage(
      chatId,
      `📊 Günlük Rapor\n\nGelir: ${income} TL\nGider: ${expense} TL\nBakiye: ${balance} TL`
    );

  });

});