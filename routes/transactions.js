const db = require("../lib/db");
const expenseCategoryService = require("../services/expenseCategoryService");
const { normalizeExpenseSlug, navSlugForCategory } = require("../lib/expenseCategoryMap");
const { incomePathFromSlug } = require("../lib/incomeNav");
const { normalizeIncomeSlug } = require("../lib/incomeCategoryMap");
const { expenseCategoryGrid } = require("../lib/components/expenseCategories");
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

function getExpenseRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'expense' ORDER BY t.date DESC`
    )
    .all();
}

function expenseRedirectPath(query) {
  const q = { ...query };
  delete q.ok;
  delete q.err;
  delete q.msg;
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/expenses?${qs}` : "/expenses";
}

function renderExpensePage(req, res) {
  const vehicles = getVehicles();
  const expenseCategories = expenseCategoryService.getCategorySummaries();
  const categoryNames = expenseCategoryService.getCategoryNames();
  const activeSlug = normalizeExpenseSlug(req.query.category || "");
  const filterQuery = activeSlug ? { ...req.query, category: activeSlug } : req.query;
  const filtered = filterTransactions(getExpenseRows(), filterQuery);
  const activeCat = activeSlug
    ? expenseCategories.find((c) => c.slug === activeSlug)
    : null;
  const tableRows = filtered.map((t) =>
    transactionRow(t, `/expense/edit/${t.id}`, `/transaction/delete/${t.id}?from=expense`)
  );

  const categoryFilterNote = activeCat
    ? `<div class="expense-filter-chip fade-in">
        <span class="expense-filter-chip__label">Filtre: <strong>${escapeHtml(activeCat.name)}</strong></span>
        <a href="/expenses" class="btn btn--ghost btn--sm">Filtreyi Temizle</a>
      </div>`
    : "";

  const content = `
    <div class="dash page-enter">
      <p class="page-lead">Gider Yönetimi · ${expenseCategories.length} kategori · ${filtered.length} kayıt listeleniyor</p>
      ${categoryFilterNote}
      ${expenseCategoryGrid(expenseCategories)}
      ${glassPanel({
        title: "Gider ekle",
        body: `<form method="POST" action="/expense/add" class="form-grid">
          <select name="vehicle_id">${vehicleOptions(vehicles, req.query.vehicle_id, { allowShared: true })}</select>
          <select name="category" required>${categoryOptions(categoryNames, activeCat?.name || categoryNames[0])}</select>
          <input name="amount" type="number" placeholder="Tutar (TL)" min="1" required />
          <input name="date" type="date" value="${todayInputValue()}" required />
          <input class="full" name="note" placeholder="Açıklama" />
          <button class="btn btn--primary full" type="submit">Gider Ekle</button>
        </form>`,
      })}
      ${glassPanel({
        title: "Gider listesi",
        desc: "Kategori kartına tıklayarak filtreleyin · CSV mevcut filtreye göre",
        body: `${filterBar("/expenses", req.query, { vehicles, categories: categoryNames, exportPath: "/expense/export" })}
          ${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"], tableRows, { text: "Filtreye uygun gider bulunamadı." })}`,
      })}
    </div>`;

  renderLayout(res, "Gider Yönetimi", content, "/expenses", req, {
    pageTitle: "Gider Yönetimi",
    breadcrumb: "Finans / Gider Yönetimi",
    categorySlug: activeSlug ? navSlugForCategory(activeSlug) : "",
  });
}

function registerTransactions(app) {
  app.get("/expenses", (req, res) => renderExpensePage(req, res));

  app.get("/expense", (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    res.redirect(301, qs ? `/expenses?${qs}` : "/expenses");
  });

  app.post("/expense/add", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      const vehicleId = vehicle_id && String(vehicle_id).trim() ? Number(vehicle_id) : null;
      const amt = parseTransactionAmount(amount);
      const resolved = expenseCategoryService.resolveCategoryInput(category);
      db.prepare(
        `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date) VALUES (?, 'expense', ?, ?, ?, ?, ?)`
      ).run(vehicleId, resolved.name, resolved.slug, amt, note || "", parseTransactionDate(date));
      const slug = navSlugForCategory(resolved.slug);
      redirectWithFlash(
        res,
        slug && slug !== "diger" ? `/expenses?category=${encodeURIComponent(slug)}` : "/expenses",
        "expense_added"
      );
    } catch (e) {
      redirectWithFlash(res, `/expenses?err=1&msg=${encodeURIComponent(e.message)}`, "expense_add_failed");
    }
  });

  app.get("/expense/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'expense'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gider kaydı bulunamadı."));
    const vehicles = getVehicles();
    const categoryNames = expenseCategoryService.getCategoryNames();

    const content = `
      <div class="page-intro"><p>Kayıt bilgilerini güncelleyin</p></div>
      <div class="card" style="max-width:520px">
        <form method="POST" action="/expense/edit/${t.id}">
          <select name="vehicle_id">${vehicleOptions(vehicles, t.vehicle_id, { allowShared: true })}</select>
          <select name="category" required>${categoryOptions(categoryNames, t.category)}</select>
          <input name="amount" type="number" value="${t.amount}" required />
          <input name="date" type="date" value="${dateInputFromDb(t.date)}" required />
          <input name="note" value="${escapeHtml(t.note || "")}" />
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="/expenses">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Gider Düzenle", content, "/expense", req, { pageTitle: "Gider Düzenle", breadcrumb: "Gider Yönetimi / Düzenle" });
  });

  app.post("/expense/edit/:id", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      const vehicleId = vehicle_id && String(vehicle_id).trim() ? Number(vehicle_id) : null;
      const amt = parseTransactionAmount(amount);
      const resolved = expenseCategoryService.resolveCategoryInput(category);
      db.prepare(
        `UPDATE transactions SET vehicle_id=?, category=?, category_slug=?, amount=?, note=?, date=? WHERE id=? AND type='expense'`
      ).run(vehicleId, resolved.name, resolved.slug, amt, note || "", parseTransactionDate(date), req.params.id);
      redirectWithFlash(res, "/expenses", "expense_updated");
    } catch (e) {
      redirectWithFlash(res, `/expenses?err=1&msg=${encodeURIComponent(e.message)}`, "expense_update_failed");
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
    if (req.query.from === "income") {
      const slug = req.query.income_slug || (t ? normalizeIncomeSlug(t.category_slug || t.category) : "service");
      return redirectWithFlash(res, incomePathFromSlug(slug), t?.type === "income" ? "income_deleted" : "expense_deleted");
    }
    if (req.query.from === "expense") return redirectWithFlash(res, expenseRedirectPath(req.query), "expense_deleted");
    res.redirect("/");
  });
}

module.exports = registerTransactions;
