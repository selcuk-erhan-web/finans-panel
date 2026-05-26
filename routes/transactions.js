const db = require("../lib/db");
const { INCOME_CATEGORIES, EXPENSE_CATEGORIES } = require("../lib/constants");
const { redirectWithFlash } = require("../lib/flash");
const { transactionsToCsv } = require("../lib/export");
const {
  filterTransactions,
  todayInputValue,
  parseTransactionDate,
  dateInputFromDb,
} = require("../lib/finance");
const {
  escapeHtml,
  pageHeader,
  dataTable,
  transactionRow,
  filterBar,
  renderLayout,
  vehicleOptions,
  categoryOptions,
} = require("../lib/ui");
const { getVehicles } = require("./vehicles");

function getIncomeRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'income' ORDER BY t.date DESC`
    )
    .all();
}

function getExpenseRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'expense' ORDER BY t.date DESC`
    )
    .all();
}

function registerTransactions(app) {
  app.get("/income", (req, res) => {
    const vehicles = getVehicles();
    const filtered = filterTransactions(getIncomeRows(), req.query);
    const tableRows = filtered.map((t) =>
      transactionRow(t, `/income/edit/${t.id}`, `/transaction/delete/${t.id}?from=income`)
    );

    const content = `
      ${pageHeader("Gelirler", `${filtered.length} kayıt`)}
      <div class="card">
        <h2>Gelir Ekle</h2>
        <form method="POST" action="/income/add" class="form-grid">
          <select name="vehicle_id" required>${vehicleOptions(vehicles)}</select>
          <select name="category">${categoryOptions(INCOME_CATEGORIES)}</select>
          <input name="amount" type="number" placeholder="Tutar (TL)" min="1" required />
          <input name="date" type="date" value="${todayInputValue()}" required />
          <input class="full" name="note" placeholder="Açıklama" />
          <button class="full" type="submit">Gelir Ekle</button>
        </form>
      </div>
      <div class="card">
        <h2>Gelir Listesi</h2>
        ${filterBar("/income", req.query, { vehicles, categories: INCOME_CATEGORIES, exportPath: "/income/export" })}
        ${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"], tableRows, { icon: "💰", title: "Kayıt yok", desc: "Filtreye uygun gelir bulunamadı." })}
      </div>`;

    renderLayout(res, "Gelirler", content, "/income", req);
  });

  app.get("/income/export", (req, res) => {
    const filtered = filterTransactions(getIncomeRows(), req.query);
    const csv = transactionsToCsv(filtered, "income");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="gelirler.csv"');
    res.send(csv);
  });

  app.post("/income/add", (req, res) => {
    const { vehicle_id, category, amount, note, date } = req.body;
    db.prepare(
      `INSERT INTO transactions (vehicle_id, type, category, amount, note, date) VALUES (?, 'income', ?, ?, ?, ?)`
    ).run(vehicle_id, category, Number(amount), note || "", parseTransactionDate(date));
    redirectWithFlash(res, "/income", "income_added");
  });

  app.get("/income/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'income'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gelir kaydı bulunamadı."));
    const vehicles = getVehicles();

    const content = `
      ${pageHeader("Gelir Düzenle")}
      <div class="card" style="max-width:520px">
        <form method="POST" action="/income/edit/${t.id}">
          <select name="vehicle_id" required>${vehicleOptions(vehicles, t.vehicle_id)}</select>
          <select name="category">${categoryOptions(INCOME_CATEGORIES, t.category)}</select>
          <input name="amount" type="number" value="${t.amount}" required />
          <input name="date" type="date" value="${dateInputFromDb(t.date)}" required />
          <input name="note" value="${escapeHtml(t.note || "")}" />
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="/income">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Gelir Düzenle", content, "/income", req);
  });

  app.post("/income/edit/:id", (req, res) => {
    const { vehicle_id, category, amount, note, date } = req.body;
    db.prepare(
      `UPDATE transactions SET vehicle_id=?, category=?, amount=?, note=?, date=? WHERE id=? AND type='income'`
    ).run(vehicle_id, category, Number(amount), note || "", parseTransactionDate(date), req.params.id);
    redirectWithFlash(res, "/income", "income_updated");
  });

  app.get("/expense", (req, res) => {
    const vehicles = getVehicles();
    const filtered = filterTransactions(getExpenseRows(), req.query);
    const tableRows = filtered.map((t) =>
      transactionRow(t, `/expense/edit/${t.id}`, `/transaction/delete/${t.id}?from=expense`)
    );

    const content = `
      ${pageHeader("Giderler", `${filtered.length} kayıt`)}
      <div class="card">
        <h2>Gider Ekle</h2>
        <form method="POST" action="/expense/add" class="form-grid">
          <select name="vehicle_id" required>${vehicleOptions(vehicles)}</select>
          <select name="category">${categoryOptions(EXPENSE_CATEGORIES)}</select>
          <input name="amount" type="number" placeholder="Tutar (TL)" min="1" required />
          <input name="date" type="date" value="${todayInputValue()}" required />
          <input class="full" name="note" placeholder="Açıklama" />
          <button class="full" type="submit">Gider Ekle</button>
        </form>
      </div>
      <div class="card">
        <h2>Gider Listesi</h2>
        ${filterBar("/expense", req.query, { vehicles, categories: EXPENSE_CATEGORIES, exportPath: "/expense/export" })}
        ${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"], tableRows, { icon: "💸", title: "Kayıt yok", desc: "Filtreye uygun gider bulunamadı." })}
      </div>`;

    renderLayout(res, "Giderler", content, "/expense", req);
  });

  app.get("/expense/export", (req, res) => {
    const filtered = filterTransactions(getExpenseRows(), req.query);
    const csv = transactionsToCsv(filtered, "expense");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="giderler.csv"');
    res.send(csv);
  });

  app.post("/expense/add", (req, res) => {
    const { vehicle_id, category, amount, note, date } = req.body;
    db.prepare(
      `INSERT INTO transactions (vehicle_id, type, category, amount, note, date) VALUES (?, 'expense', ?, ?, ?, ?)`
    ).run(vehicle_id, category, Number(amount), note || "", parseTransactionDate(date));
    redirectWithFlash(res, "/expense", "expense_added");
  });

  app.get("/expense/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'expense'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gider kaydı bulunamadı."));
    const vehicles = getVehicles();

    const content = `
      ${pageHeader("Gider Düzenle")}
      <div class="card" style="max-width:520px">
        <form method="POST" action="/expense/edit/${t.id}">
          <select name="vehicle_id" required>${vehicleOptions(vehicles, t.vehicle_id)}</select>
          <select name="category">${categoryOptions(EXPENSE_CATEGORIES, t.category)}</select>
          <input name="amount" type="number" value="${t.amount}" required />
          <input name="date" type="date" value="${dateInputFromDb(t.date)}" required />
          <input name="note" value="${escapeHtml(t.note || "")}" />
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="/expense">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Gider Düzenle", content, "/expense", req);
  });

  app.post("/expense/edit/:id", (req, res) => {
    const { vehicle_id, category, amount, note, date } = req.body;
    db.prepare(
      `UPDATE transactions SET vehicle_id=?, category=?, amount=?, note=?, date=? WHERE id=? AND type='expense'`
    ).run(vehicle_id, category, Number(amount), note || "", parseTransactionDate(date), req.params.id);
    redirectWithFlash(res, "/expense", "expense_updated");
  });

  app.get("/transaction/delete/:id", (req, res) => {
    const t = db.prepare("SELECT type FROM transactions WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);

    if (req.query.from === "vehicle" && req.query.vehicle_id) {
      return redirectWithFlash(res, `/vehicle/${req.query.vehicle_id}`, t?.type === "income" ? "income_deleted" : "expense_deleted");
    }
    if (req.query.from === "income") return redirectWithFlash(res, "/income", "income_deleted");
    if (req.query.from === "expense") return redirectWithFlash(res, "/expense", "expense_deleted");
    res.redirect("/");
  });
}

module.exports = registerTransactions;
