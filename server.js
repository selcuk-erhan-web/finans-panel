const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 3000;

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
  note TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

app.post("/add", (req, res) => {
  const { type, amount, note } = req.body;

  db.prepare("INSERT INTO transactions (type, amount, note) VALUES (?, ?, ?)")
    .run(type, Number(amount), note);

  res.redirect("/");
});

app.get("/delete/:id", (req, res) => {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
  res.redirect("/");
});

app.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();

  let income = 0;
  let expense = 0;

  rows.forEach(r => {
    if (r.type === "income") income += r.amount;
    if (r.type === "expense") expense += r.amount;
  });

  let tableRows = "";

  rows.forEach(r => {
    tableRows += `
      <tr>
        <td>${r.id}</td>
        <td>${r.type === "income" ? "Gelir" : "Gider"}</td>
        <td>${r.amount} TL</td>
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
      table { width:100%; border-collapse:collapse; }
      th, td { padding:10px; border-bottom:1px solid #ddd; }
      input, select, button { padding:10px; margin:5px; }
      .pie { width:240px; height:240px; margin:auto; }
      .line { height:260px; }
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
        <h2>Bakiye: ${income - expense} TL</h2>
      </div>

      <div class="card">
        <h3>Günlük Grafik</h3>
        <div class="line"><canvas id="line"></canvas></div>
      </div>
    </div>

    <div class="card">
      <h3>Yeni Kayıt Ekle</h3>
      <form method="POST" action="/add">
        <select name="type">
          <option value="income">Gelir</option>
          <option value="expense">Gider</option>
        </select>
        <input name="amount" placeholder="Tutar" required />
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

app.listen(port, () => {
  console.log(`Panel çalışıyor: ${port}`);
});