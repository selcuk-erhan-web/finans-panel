const db = require("../lib/db");
const { INCOME_CATEGORIES, EXPENSE_CATEGORIES } = require("../lib/constants");
const { redirectWithFlash } = require("../lib/flash");
const {
  filterTransactions,
  todayInputValue,
  parseTransactionDate,
  parseTransactionAmount,
  dateInputFromDb,
} = require("../lib/finance");
const {
  escapeHtml,
  dataTable,
  transactionRow,
  filterBar,
  glassPanel,
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
      <div class="dash">
        <p class="page-lead">${filtered.length} gelir kaydı listeleniyor</p>
        ${glassPanel({
          title: "Gelir ekle",
          body: `<form method="POST" action="/income/add" class="form-grid">
            <select name="vehicle_id" required>${vehicleOptions(vehicles, req.query.vehicle_id)}</select>
            <select name="category" required>${categoryOptions(INCOME_CATEGORIES, INCOME_CATEGORIES[0])}</select>
            <input name="amount" type="number" placeholder="Tutar (TL)" min="1" required />
            <input name="date" type="date" value="${todayInputValue()}" required />
            <input class="full" name="note" placeholder="Açıklama" />
            <button class="btn btn--primary full" type="submit">Gelir Ekle</button>
          </form>`,
        })}
        ${glassPanel({
          title: "Gelir listesi",
          desc: "Araç, kategori ve tarih filtreleri",
          body: `${filterBar("/income", req.query, { vehicles, categories: INCOME_CATEGORIES, exportPath: "/income/export" })}
            ${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"], tableRows, { text: "Filtreye uygun gelir bulunamadı." })}`,
        })}
      </div>`;

    renderLayout(res, "Gelirler", content, "/income", req, { pageTitle: "Gelirler", breadcrumb: "İşlemler / Gelir" });
  });

  app.post("/income/add", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      if (!vehicle_id) {
        return redirectWithFlash(res, "/income?err=1&msg=" + encodeURIComponent("Gelir için araç seçilmeli."), "income_add_failed");
      }
      const amt = parseTransactionAmount(amount);
      const cat = INCOME_CATEGORIES.includes(category) ? category : INCOME_CATEGORIES[0];
      db.prepare(
        `INSERT INTO transactions (vehicle_id, type, category, amount, note, date) VALUES (?, 'income', ?, ?, ?, ?)`
      ).run(Number(vehicle_id), cat, amt, note || "", parseTransactionDate(date));
      redirectWithFlash(res, "/income", "income_added");
    } catch (e) {
      redirectWithFlash(res, "/income?err=1&msg=" + encodeURIComponent(e.message), "income_add_failed");
    }
  });

  app.get("/income/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'income'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gelir kaydı bulunamadı."));
    const vehicles = getVehicles();

    const content = `
      <div class="page-intro"><p>Kayıt bilgilerini güncelleyin</p></div>
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

    renderLayout(res, "Gelir Düzenle", content, "/income", req, { pageTitle: "Gelir Düzenle", breadcrumb: "İşlemler / Düzenle" });
  });

  app.post("/income/edit/:id", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      if (!vehicle_id) {
        return redirectWithFlash(res, "/income?err=1&msg=" + encodeURIComponent("Gelir için araç seçilmeli."), "income_update_failed");
      }
      const amt = parseTransactionAmount(amount);
      const cat = INCOME_CATEGORIES.includes(category) ? category : INCOME_CATEGORIES[0];
      db.prepare(
        `UPDATE transactions SET vehicle_id=?, category=?, amount=?, note=?, date=? WHERE id=? AND type='income'`
      ).run(Number(vehicle_id), cat, amt, note || "", parseTransactionDate(date), req.params.id);
      redirectWithFlash(res, "/income", "income_updated");
    } catch (e) {
      redirectWithFlash(res, "/income?err=1&msg=" + encodeURIComponent(e.message), "income_update_failed");
    }
  });

  app.get("/expense", (req, res) => {
    const vehicles = getVehicles();
    const filtered = filterTransactions(getExpenseRows(), req.query);
    const tableRows = filtered.map((t) =>
      transactionRow(t, `/expense/edit/${t.id}`, `/transaction/delete/${t.id}?from=expense`)
    );

    const content = `
      <div class="dash">
        <p class="page-lead">${filtered.length} gider kaydı listeleniyor</p>
        ${glassPanel({
          title: "Gider ekle",
          body: `<form method="POST" action="/expense/add" class="form-grid">
            <select name="vehicle_id">${vehicleOptions(vehicles, req.query.vehicle_id, { allowShared: true })}</select>
            <select name="category" required>${categoryOptions(EXPENSE_CATEGORIES, EXPENSE_CATEGORIES[0])}</select>
            <input name="amount" type="number" placeholder="Tutar (TL)" min="1" required />
            <input name="date" type="date" value="${todayInputValue()}" required />
            <input class="full" name="note" placeholder="Açıklama" />
            <button class="btn btn--primary full" type="submit">Gider Ekle</button>
          </form>`,
        })}
        ${glassPanel({
          title: "Gider listesi",
          desc: "Araç, kategori ve tarih filtreleri · CSV mevcut filtreye göre",
          body: `${filterBar("/expense", req.query, { vehicles, categories: EXPENSE_CATEGORIES, exportPath: "/expense/export" })}
            ${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"], tableRows, { text: "Filtreye uygun gider bulunamadı." })}`,
        })}
      </div>`;

    renderLayout(res, "Giderler", content, "/expense", req, { pageTitle: "Giderler", breadcrumb: "İşlemler / Gider" });
  });

  app.post("/expense/add", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      const vehicleId = vehicle_id && String(vehicle_id).trim() ? Number(vehicle_id) : null;
      const amt = parseTransactionAmount(amount);
      const cat = EXPENSE_CATEGORIES.includes(category) ? category : EXPENSE_CATEGORIES[0];
      db.prepare(
        `INSERT INTO transactions (vehicle_id, type, category, amount, note, date) VALUES (?, 'expense', ?, ?, ?, ?)`
      ).run(vehicleId, cat, amt, note || "", parseTransactionDate(date));
      redirectWithFlash(res, "/expense", "expense_added");
    } catch (e) {
      redirectWithFlash(res, "/expense?err=1&msg=" + encodeURIComponent(e.message), "expense_add_failed");
    }
  });

  app.get("/expense/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'expense'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gider kaydı bulunamadı."));
    const vehicles = getVehicles();

    const content = `
      <div class="page-intro"><p>Kayıt bilgilerini güncelleyin</p></div>
      <div class="card" style="max-width:520px">
        <form method="POST" action="/expense/edit/${t.id}">
          <select name="vehicle_id">${vehicleOptions(vehicles, t.vehicle_id, { allowShared: true })}</select>
          <select name="category" required>${categoryOptions(EXPENSE_CATEGORIES, t.category)}</select>
          <input name="amount" type="number" value="${t.amount}" required />
          <input name="date" type="date" value="${dateInputFromDb(t.date)}" required />
          <input name="note" value="${escapeHtml(t.note || "")}" />
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="/expense">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Gider Düzenle", content, "/expense", req, { pageTitle: "Gider Düzenle", breadcrumb: "İşlemler / Düzenle" });
  });

  app.post("/expense/edit/:id", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      const vehicleId = vehicle_id && String(vehicle_id).trim() ? Number(vehicle_id) : null;
      const amt = parseTransactionAmount(amount);
      const cat = EXPENSE_CATEGORIES.includes(category) ? category : EXPENSE_CATEGORIES[0];
      db.prepare(
        `UPDATE transactions SET vehicle_id=?, category=?, amount=?, note=?, date=? WHERE id=? AND type='expense'`
      ).run(vehicleId, cat, amt, note || "", parseTransactionDate(date), req.params.id);
      redirectWithFlash(res, "/expense", "expense_updated");
    } catch (e) {
      redirectWithFlash(res, "/expense?err=1&msg=" + encodeURIComponent(e.message), "expense_update_failed");
    }
  });

  app.get("/transaction/delete/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    if (t) {
      const auditService = require("../services/auditService");
      auditService.log(
        t.type === "income" ? "income_delete" : "expense_delete",
        "transaction",
        t.id,
        t,
        null,
        `${t.type === "income" ? "Gelir" : "Gider"} kaydı silindi`
      );
    }

    if (req.query.from === "vehicle" && req.query.vehicle_id) {
      return redirectWithFlash(res, `/vehicle/${req.query.vehicle_id}`, t?.type === "income" ? "income_deleted" : "expense_deleted");
    }
    if (req.query.from === "income") return redirectWithFlash(res, "/income", "income_deleted");
    if (req.query.from === "expense") return redirectWithFlash(res, "/expense", "expense_deleted");
    res.redirect("/");
  });
}

module.exports = registerTransactions;
