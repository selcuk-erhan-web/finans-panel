const express = require("express");
const Database = require("better-sqlite3");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

const username = "admin";
const password = "1234";

const token = "8610203796:AAEorm73zD4pZ0-nyWSPZ6l-QvZMC9zoETU";

const bot = new TelegramBot(token, { polling: true });

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
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT,
  brand TEXT,
  model TEXT,
  year TEXT,
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

try {
  db.prepare("ALTER TABLE vehicles ADD COLUMN type TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE transactions ADD COLUMN vehicle_id INTEGER").run();
} catch (e) {}

app.post("/vehicle/add", (req, res) => {
  const { plate, brand, model, year, type } = req.body;

  db.prepare(`
    INSERT INTO vehicles (plate, brand, model, year, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(plate, brand, model, year, type);

  res.redirect("/");
});

app.post("/transaction/add", (req, res) => {
  const { vehicle_id, type, category, amount, note } = req.body;

  db.prepare(`
    INSERT INTO transactions
    (vehicle_id, type, category, amount, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(vehicle_id, type, category, Number(amount), note);

  res.redirect("/");
});

app.get("/", (req, res) => {

  const vehicles = db.prepare(`
    SELECT * FROM vehicles ORDER BY id DESC
  `).all();

  const transactions = db.prepare(`
    SELECT t.*, v.plate
    FROM transactions t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    ORDER BY t.date DESC
  `).all();

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(t => {
    if (t.type === "income") totalIncome += t.amount;
    if (t.type === "expense") totalExpense += t.amount;
  });

  const balance = totalIncome - totalExpense;

  let vehicleRows = "";

  vehicles.forEach(vehicle => {

    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      if (t.vehicle_id == vehicle.id) {
        if (t.type === "income") income += t.amount;
        if (t.type === "expense") expense += t.amount;
      }
    });

    vehicleRows += `
      <tr>
        <td>${vehicle.plate}</td>
        <td>${vehicle.type || "-"}</td>
        <td>${income} TL</td>
        <td>${expense} TL</td>
        <td>${income - expense} TL</td>
      </tr>
    `;
  });

  let transactionRows = "";

  transactions.forEach(t => {
    transactionRows += `
      <tr>
        <td>${t.plate || "-"}</td>
        <td>${t.type === "income" ? "Gelir" : "Gider"}</td>
        <td>${t.category}</td>
        <td>${t.amount} TL</td>
        <td>${t.note}</td>
      </tr>
    `;
  });

  let vehicleOptions = "";

  vehicles.forEach(v => {
    vehicleOptions += `
      <option value="${v.id}">
        ${v.plate} - ${v.type || ""}
      </option>
    `;
  });

  res.send(`
  <html>
  <head>
    <title>Araç Finans Paneli</title>

    <style>

      *{
        margin:0;
        padding:0;
        box-sizing:border-box;
        font-family:Arial;
      }

      body{
        background:#f3f4f6;
        display:flex;
      }

      .sidebar{
        width:240px;
        background:#111827;
        min-height:100vh;
        color:white;
        padding:25px;
      }

      .sidebar h2{
        margin-bottom:30px;
      }

      .menu a{
        display:block;
        color:white;
        text-decoration:none;
        padding:12px;
        border-radius:8px;
        margin-bottom:10px;
        background:#1f2937;
      }

      .menu a:hover{
        background:#374151;
      }

      .main{
        flex:1;
        padding:30px;
      }

      .cards{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:20px;
        margin-bottom:25px;
      }

      .card{
        background:white;
        padding:25px;
        border-radius:14px;
        box-shadow:0 2px 8px rgba(0,0,0,0.05);
      }

      .card h3{
        margin-bottom:10px;
        color:#6b7280;
      }

      .card h1{
        font-size:28px;
      }

      .grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:20px;
        margin-bottom:20px;
      }

      table{
        width:100%;
        border-collapse:collapse;
      }

      th,td{
        padding:12px;
        border-bottom:1px solid #e5e7eb;
        text-align:left;
      }

      input,select,button{
        width:100%;
        padding:12px;
        margin-top:10px;
        border:1px solid #d1d5db;
        border-radius:8px;
      }

      button{
        background:#2563eb;
        color:white;
        border:none;
        cursor:pointer;
      }

      button:hover{
        background:#1d4ed8;
      }

    </style>

  </head>

  <body>

    <div class="sidebar">

      <h2>🚗 Finans Paneli</h2>

      <div class="menu">
        <a href="/">🏠 Ana Sayfa</a>
        <a href="/">🚗 Araçlar</a>
        <a href="/">💰 Gelirler</a>
        <a href="/">💸 Giderler</a>
        <a href="/">📊 Analizler</a>
      </div>

    </div>

    <div class="main">

      <div class="cards">

        <div class="card">
          <h3>Toplam Gelir</h3>
          <h1>${totalIncome} TL</h1>
        </div>

        <div class="card">
          <h3>Toplam Gider</h3>
          <h1>${totalExpense} TL</h1>
        </div>

        <div class="card">
          <h3>Net Kâr</h3>
          <h1>${balance} TL</h1>
        </div>

        <div class="card">
          <h3>Araç Sayısı</h3>
          <h1>${vehicles.length}</h1>
        </div>

      </div>

      <div class="grid">

        <div class="card">

          <h2>🚗 Araç Ekle</h2>

          <form method="POST" action="/vehicle/add">

            <input name="plate" placeholder="Plaka" required />

            <input name="brand" placeholder="Marka" required />

            <input name="model" placeholder="Model" required />

            <input name="year" placeholder="Yıl" required />

            <select name="type">
              <option value="Servis">Servis</option>
              <option value="Turizm">Turizm</option>
            </select>

            <button type="submit">Araç Ekle</button>

          </form>

        </div>

        <div class="card">

          <h2>💰 Gelir / Gider Ekle</h2>

          <form method="POST" action="/transaction/add">

            <select name="vehicle_id">
              ${vehicleOptions}
            </select>

            <select name="type">
              <option value="income">Gelir</option>
              <option value="expense">Gider</option>
            </select>

            <select name="category">
              <option value="Servis Geliri">Servis Geliri</option>
              <option value="Turizm Geliri">Turizm Geliri</option>
              <option value="Yakıt">Yakıt</option>
              <option value="Bakım">Bakım</option>
              <option value="Sigorta">Sigorta</option>
              <option value="Lastik">Lastik</option>
              <option value="Ceza">Ceza</option>
              <option value="Diğer">Diğer</option>
            </select>

            <input name="amount" placeholder="Tutar" required />

            <input name="note" placeholder="Açıklama" required />

            <button type="submit">Kayıt Ekle</button>

          </form>

        </div>

      </div>

      <div class="card" style="margin-bottom:20px;">

        <h2 style="margin-bottom:15px;">🚘 Araç Finans Özeti</h2>

        <table>

          <tr>
            <th>Plaka</th>
            <th>Tip</th>
            <th>Gelir</th>
            <th>Gider</th>
            <th>Net</th>
          </tr>

          ${vehicleRows}

        </table>

      </div>

      <div class="card">

        <h2 style="margin-bottom:15px;">📋 Son İşlemler</h2>

        <table>

          <tr>
            <th>Araç</th>
            <th>Tip</th>
            <th>Kategori</th>
            <th>Tutar</th>
            <th>Açıklama</th>
          </tr>

          ${transactionRows}

        </table>

      </div>

    </div>

  </body>

  </html>
  `);

});

bot.on("message", (msg) => {

  const text = msg.text;

  if (!text) return;

  bot.sendMessage(
    msg.chat.id,
    "Panel aktif çalışıyor ✅"
  );

});

app.listen(port, () => {
  console.log("Panel çalışıyor:", port);
});