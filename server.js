const express = require("express");
const Database = require("better-sqlite3");
const db = new Database("./data.db");

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


app.post("/add", (req, res) => {
  const { type, amount, note } = req.body;

  db.run(
    "INSERT INTO transactions (type, amount, note) VALUES (?, ?, ?)",
    [type, amount, note],
    () => res.redirect("/")
  );
});

app.get("/delete/:id", (req, res) => {
  db.run("DELETE FROM transactions WHERE id = ?", [req.params.id], () => {
    res.redirect("/");
  });
});

app.get("/edit/:id", (req, res) => {
  db.get("SELECT * FROM transactions WHERE id = ?", [req.params.id], (err, item) => {
    if (err || !item) return res.send("Kayıt bulunamadı");

    res.send(`
      <html>
      <head>
        <title>Kayıt Düzenle</title>
        <style>
          body { font-family: Arial; background:#f3f4f6; padding:30px; }
          .card { background:white; padding:25px; border-radius:14px; max-width:500px; }
          input, select { width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px; }
          button { padding:12px 20px; border:0; background:#2563eb; color:white; border-radius:8px; cursor:pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Kayıt Düzenle</h2>

          <form method="POST" action="/update/${item.id}">
            <label>Tip</label>
            <select name="type">
              <option value="income" ${item.type === "income" ? "selected" : ""}>Gelir</option>
              <option value="expense" ${item.type === "expense" ? "selected" : ""}>Gider</option>
            </select>

            <label>Tutar</label>
            <input name="amount" value="${item.amount}" required />

            <label>Açıklama</label>
            <input name="note" value="${item.note}" required />

            <button type="submit">Kaydet</button>
          </form>

          <br>
          <a href="/">Panele dön</a>
        </div>
      </body>
      </html>
    `);
  });
});

app.post("/update/:id", (req, res) => {
  const { type, amount, note } = req.body;

  db.run(
    "UPDATE transactions SET type = ?, amount = ?, note = ? WHERE id = ?",
    [type, amount, note, req.params.id],
    () => res.redirect("/")
  );
});

app.get("/", (req, res) => {
  db.all("SELECT * FROM transactions ORDER BY date DESC", [], (err, rows) => {
    if (err) return res.send("Hata");

    let income = 0;
    let expense = 0;

    rows.forEach(r => {
      if (r.type === "income") income += r.amount;
      if (r.type === "expense") expense += r.amount;
    });

    let daily = {};

    rows.forEach(r => {
      const day = r.date.split(" ")[0];
      if (!daily[day]) daily[day] = { income: 0, expense: 0 };
      if (r.type === "income") daily[day].income += r.amount;
      if (r.type === "expense") daily[day].expense += r.amount;
    });

    const labels = Object.keys(daily);
    const incomeData = labels.map(d => daily[d].income);
    const expenseData = labels.map(d => daily[d].expense);

    let tableRows = "";

    rows.forEach(r => {
      tableRows += `
        <tr>
          <td>${r.id}</td>
          <td><span class="${r.type === "income" ? "income" : "expense"}">${r.type === "income" ? "Gelir" : "Gider"}</span></td>
          <td>${r.amount} TL</td>
          <td>${r.note}</td>
          <td>${r.date}</td>
          <td>
            <a class="edit" href="/edit/${r.id}">Düzenle</a>
            |
            <a class="delete" href="/delete/${r.id}" onclick="return confirm('Bu kaydı silmek istiyor musun?')">Sil</a>
          </td>
        </tr>
      `;
    });

    res.send(`
    <html>
    <head>
      <title>Finans Paneli</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <meta http-equiv="refresh" content="15">

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #eef1f5;
          color: #222;
          padding: 25px;
        }

        .title {
          font-size: 34px;
          font-weight: bold;
          margin-bottom: 25px;
        }

        .top-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .card {
          background: white;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }

        .pie-box {
          width: 230px;
          height: 230px;
          margin: auto;
        }

        .summary h2 {
          margin: 18px 0;
          font-size: 24px;
        }

        .income {
          color: #16a34a;
          font-weight: bold;
        }

        .expense {
          color: #dc2626;
          font-weight: bold;
        }

        .balance {
          color: #2563eb;
          font-weight: bold;
        }

        .line-box {
          height: 280px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 180px 1fr 2fr 120px;
          gap: 10px;
        }

        input, select {
          padding: 13px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 15px;
        }

        button {
          border: 0;
          background: #2563eb;
          color: white;
          border-radius: 10px;
          font-size: 15px;
          cursor: pointer;
        }

        button:hover {
          background: #1d4ed8;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th, td {
          padding: 13px;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
        }

        th {
          background: #f8fafc;
        }

        .delete {
          color: #dc2626;
          font-weight: bold;
          text-decoration: none;
        }

        .edit {
          color: #2563eb;
          font-weight: bold;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .top-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>

    <body>
      <div class="title">📊 Finans Paneli</div>

      <div class="top-grid">
        <div class="card">
          <h3>Pasta Grafik</h3>
          <div class="pie-box">
            <canvas id="pie"></canvas>
          </div>
        </div>

        <div class="card summary">
          <h3>Özet</h3>
          <h2>Gelir: <span class="income">${income} TL</span></h2>
          <h2>Gider: <span class="expense">${expense} TL</span></h2>
          <h2>Bakiye: <span class="balance">${income - expense} TL</span></h2>
        </div>

        <div class="card">
          <h3>Günlük Grafik</h3>
          <div class="line-box">
            <canvas id="line"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Yeni Kayıt Ekle</h3>
        <form method="POST" action="/add" class="form-grid">
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
            datasets: [{
              data: [${income}, ${expense}],
              backgroundColor: ['#16a34a', '#dc2626']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });

        new Chart(document.getElementById('line'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: 'Gelir',
                data: ${JSON.stringify(incomeData)},
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22,163,74,0.15)',
                tension: 0.3
              },
              {
                label: 'Gider',
                data: ${JSON.stringify(expenseData)},
                borderColor: '#dc2626',
                backgroundColor: 'rgba(220,38,38,0.15)',
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      </script>
    </body>
    </html>
    `);
  });
});

app.listen(port, () => {
  console.log("Panel çalışıyor: http://localhost:3000");
});