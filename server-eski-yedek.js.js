const express = require("express");
const Database = require("better-sqlite3");
const TelegramBot = require("node-telegram-bot-api");
const app = express();
const port = process.env.PORT || 3000;
const token = "8610203796:AAEorm73zD4pZ0-nyWSPZ6l-QvZMC9zoETU";
const bot = new TelegramBot(token, { polling: true });
app.use(express.urlencoded({ extended: true }));

const username = "admin";
const password = "1234";

app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).send("Giriş gerekli");
  }

  const encoded = auth.split(" ")[1];
  const decoded = Buffer.from(encoded, "base64").toString();
  const [user, pass] = decoded.split(":");

  if (user === username && pass === password) return next();

  res.setHeader("WWW-Authenticate", "Basic");
  return res.status(401).send("Hatalı giriş");
});

const db = new Database("./data.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  amount INTEGER,
  category TEXT,
  note TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN category TEXT").run();
} catch (e) {}

db.prepare(`
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT,
  brand TEXT,
  model TEXT,
  year TEXT,
  km INTEGER,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

app.post("/add", (req, res) => {
  const { type, amount, category, note } = req.body;

  db.prepare(
    "INSERT INTO transactions (type, amount, category, note) VALUES (?, ?, ?, ?)"
  ).run(type, Number(amount), category, note);

  res.redirect("/");
});

app.get("/delete/:id", (req, res) => {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
  res.redirect("/");
});

app.post("/vehicle/add", (req, res) => {
  const { plate, brand, model, year, km } = req.body;

  db.prepare(
    "INSERT INTO vehicles (plate, brand, model, year, km) VALUES (?, ?, ?, ?, ?)"
  ).run(plate, brand, model, year, Number(km));

  res.redirect("/");
});

app.get("/vehicle/delete/:id", (req, res) => {
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
  res.redirect("/");
});

app.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
  const vehicles = db.prepare("SELECT * FROM vehicles ORDER BY id DESC").all();

  let income = 0;
  let expense = 0;

  rows.forEach((r) => {
    if (r.type === "income") income += r.amount;
    if (r.type === "expense") expense += r.amount;
  });

  const balance = income - expense;

  let aiComment = "";

  if (income === 0 && expense === 0) {
    aiComment = "Henüz yeterli veri yok. Gelir ve gider girdikçe yorum yapabilirim.";
  } else if (income > expense) {
    aiComment = `Şirket şu an artıda görünüyor. Toplam gelir ${income} TL, toplam gider ${expense} TL. Net bakiye ${balance} TL.`;
  } else if (expense > income) {
    aiComment = `Dikkat: Giderler gelirden yüksek. Toplam gelir ${income} TL, toplam gider ${expense} TL. Açık ${expense - income} TL.`;
  } else {
    aiComment = "Gelir ve gider eşit görünüyor. Kasa şu an dengede.";
  }

  const categoryTotals = {};

  rows.forEach((r) => {
    const category = r.category || "Belirsiz";
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += r.amount;
  });

  let categoryRows = "";

  Object.entries(categoryTotals).forEach(([category, total]) => {
    categoryRows += `
      <tr>
        <td>${category}</td>
        <td>${total} TL</td>
      </tr>
    `;
  });

  let vehicleRows = "";

  vehicles.forEach((v) => {
    vehicleRows += `
      <tr>
        <td>${v.id}</td>
        <td>${v.plate}</td>
        <td>${v.brand}</td>
        <td>${v.model}</td>
        <td>${v.year}</td>
        <td>${v.km} km</td>
        <td>
          <a href="/vehicle/delete/${v.id}" onclick="return confirm('Araç silinsin mi?')">Sil</a>
        </td>
      </tr>
    `;
  });

  let tableRows = "";

  rows.forEach((r) => {
    tableRows += `
      <tr>
        <td>${r.id}</td>
        <td>${r.type === "income" ? "Gelir" : "Gider"}</td>
        <td>${r.amount} TL</td>
        <td>${r.category || "-"}</td>
        <td>${r.note}</td>
        <td>${r.date}</td>
        <td>
          <a href="/delete/${r.id}" onclick="return confirm('Silinsin mi?')">Sil</a>
        </td>
      </tr>
    `;
  });

  res.send(`
  <html>
  <head>
    <title>Finans Paneli</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body { font-family: Arial; background:#eef1f5; padding:25px; }
      .card { background:white; padding:20px; margin-bottom:20px; border-radius:14px; }
      .top { display:grid; grid-template-columns:1fr 1fr 2fr; gap:20px; }
      .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
      table { width:100%; border-collapse:collapse; }
      th, td { padding:10px; border-bottom:1px solid #ddd; text-align:left; }
      input, select, button { padding:10px; margin:5px; }
      button { background:#0d6efd; color:white; border:none; border-radius:6px; cursor:pointer; }
      .pie { width:240px; height:240px; margin:auto; }
      .line { height:260px; }
      a { color:#2563eb; font-weight:bold; }
      .good { color:#15803d; }
      .bad { color:#dc2626; }
      .ai { font-size:18px; font-weight:bold; line-height:1.5; }
    </style>
  </head>
  <body>
    <h1>📊 Finans Paneli</h1>

    <div class="top">
      <div class="card">
        <h3>Pasta Grafik</h3>
        <div class="pie"><canvas id="pie"></canvas></div>
      </div>

      <div class="card">
        <h3>Özet</h3>
        <h2>Gelir: ${income} TL</h2>
        <h2>Gider: ${expense} TL</h2>
        <h2 class="${balance >= 0 ? "good" : "bad"}">Bakiye: ${balance} TL</h2>
      </div>

      <div class="card">
        <h3>Günlük Grafik</h3>
        <div class="line"><canvas id="line"></canvas></div>
      </div>
    </div>

    <div class="card">
      <h3>🤖 AI Finans Yorumu</h3>
      <p class="ai">${aiComment}</p>
    </div>

    <div class="grid2">
      <div class="card">
        <h3>📂 Kategori Özeti</h3>
        <table>
          <tr>
            <th>Kategori</th>
            <th>Toplam</th>
          </tr>
          ${categoryRows}
        </table>
      </div>

      <div class="card">
        <h3>🚗 Araç Kayıt</h3>
        <form method="POST" action="/vehicle/add">
          <input name="plate" placeholder="Plaka" required />
          <input name="brand" placeholder="Marka" required />
          <input name="model" placeholder="Model" required />
          <input name="year" placeholder="Yıl" required />
          <input name="km" placeholder="KM" required />
          <button type="submit">Araç Ekle</button>
        </form>
      </div>
    </div>

    <div class="card">
      <h3>🚘 Araç Listesi</h3>
      <table>
        <tr>
          <th>ID</th>
          <th>Plaka</th>
          <th>Marka</th>
          <th>Model</th>
          <th>Yıl</th>
          <th>KM</th>
          <th>İşlem</th>
        </tr>
        ${vehicleRows}
      </table>
    </div>

    <div class="card">
      <h3>Yeni Kayıt Ekle</h3>
      <form method="POST" action="/add">
        <select name="type">
          <option value="income">Gelir</option>
          <option value="expense">Gider</option>
        </select>

        <input name="amount" placeholder="Tutar" required />

        <select name="category" required>
          <option value="Müşteri Ödeme">Müşteri Ödeme</option>
          <option value="Yakıt">Yakıt</option>
          <option value="Personel">Personel</option>
          <option value="Bakım">Bakım</option>
          <option value="Sigorta">Sigorta</option>
          <option value="Araç Gideri">Araç Gideri</option>
          <option value="Diğer">Diğer</option>
        </select>

        <input name="note" placeholder="Açıklama" required />

        <button type="submit">Ekle</button>
      </form>
    </div>

    <div class="card">
      <h3>İşlem Listesi</h3>
      <table>
        <tr>
          <th>ID</th>
          <th>Tip</th>
          <th>Tutar</th>
          <th>Kategori</th>
          <th>Açıklama</th>
          <th>Tarih</th>
          <th>İşlem</th>
        </tr>
        ${tableRows}
      </table>
    </div>

    <script>
      new Chart(document.getElementById('pie'), {
        type: 'pie',
        data: {
          labels: ['Gelir', 'Gider'],
          datasets: [{ data: [${income}, ${expense}] }]
        },
        options: { responsive:true, maintainAspectRatio:false }
      });

      new Chart(document.getElementById('line'), {
        type: 'line',
        data: {
          labels: ['Toplam'],
          datasets: [
            { label:'Gelir', data:[${income}] },
            { label:'Gider', data:[${expense}] }
          ]
        },
        options: { responsive:true, maintainAspectRatio:false }
      });
    </script>
  </body>
  </html>
  `);
});
bot.on("message", (msg) => {
  const text = msg.text;

  if (!text) return;

  const parts = text.split(" ");

  if (parts.length < 4) {
    bot.sendMessage(
      msg.chat.id,
      "Kullanım:\n+ 5000 Yakıt Shell\n- 3000 Bakım Yağ değişimi"
    );
    return;
  }

  const symbol = parts[0];
  const amount = Number(parts[1]);
  const category = parts[2];
  const note = parts.slice(3).join(" ");

  let type = "";

  if (symbol === "+") type = "income";
  else if (symbol === "-") type = "expense";
  else {
    bot.sendMessage(msg.chat.id, "Mesaj + veya - ile başlamalı");
    return;
  }

  db.prepare(
    "INSERT INTO transactions (type, amount, category, note) VALUES (?, ?, ?, ?)"
  ).run(type, amount, category, note);

  bot.sendMessage(
    msg.chat.id,
    `✅ Kayıt eklendi\nTip: ${type}\nTutar: ${amount} TL\nKategori: ${category}`
  );
});
app.listen(port, () => {
  console.log(`Panel çalışıyor: ${port}`);
});