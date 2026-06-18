const multer = require("multer");
const db = require("../lib/db");
const incomeCategoryService = require("../services/incomeCategoryService");
const hakedisImportService = require("../services/hakedisImportService");
const { normalizeIncomeSlug } = require("../lib/incomeCategoryMap");
const { incomePathFromSlug } = require("../lib/incomeNav");
const { redirectWithFlash, redirectWithError } = require("../lib/flash");
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
  glassPanel,
  renderLayout,
  vehicleOptions,
  categoryOptions,
} = require("../lib/ui");
const {
  hakedisImportPanelHtml,
  hakedisImportResultHtml,
} = require("../lib/components/hakedisImport");
const { getVehicles } = require("./vehicles");
const { moneyInputHtml, formatMoneyInputValue } = require("../utils/money");
const { incomeHubPageHtml } = require("../lib/components/incomeHub");
const incomeHubService = require("../services/incomeHubService");

const INCOME_SLUGS = ["service", "tourism", "other"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pdf$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Sadece .pdf dosyaları yüklenebilir."));
  },
});

function getIncomeRows() {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'income' ORDER BY t.date DESC`
    )
    .all();
}

function filterIncomeBySlug(rows, slug) {
  const want = normalizeIncomeSlug(slug);
  return rows.filter((t) => normalizeIncomeSlug(t.category_slug || t.category) === want);
}

function renderIncomeListBody(rows, cat) {
  if (!rows.length) {
    return `<div class="income-empty fade-in">
      <div class="income-empty__ring" aria-hidden="true"></div>
      <p class="income-empty__title">Bu kategoride henüz gelir kaydı bulunmuyor.</p>
      <p class="income-empty__hint">İlk kaydı oluşturmak için yukarıdaki gelir formunu kullanın.</p>
      <a href="#incomeForm" class="btn btn--primary btn--sm income-empty__cta">${escapeHtml(cat.addLabel)}</a>
    </div>`;
  }

  const tableRows = rows.map((t) =>
    transactionRow(t, `/income/edit/${t.id}`, `/transaction/delete/${t.id}?from=income&income_slug=${cat.slug}`)
  );

  return dataTable(
    ["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", "İşlem"],
    tableRows,
    { text: "Bu kategoride gelir kaydı bulunamadı." }
  );
}

function renderServiceImportBlock(req) {
  let block = "";
  if (req.query.import_batch) {
    const batch = hakedisImportService.getBatchSummary(Number(req.query.import_batch));
    const result = hakedisImportService.batchToResult(batch);
    if (result) {
      block = `<section class="hgs-import-result-wrap">${hakedisImportResultHtml(result)}</section>`;
    }
  } else if (req.query.duplicate === "1") {
    block = `<section class="hgs-import-result-wrap">${hakedisImportResultHtml({
      ok: false,
      duplicate: true,
      message: "Bu PDF daha önce içe aktarılmış.",
    })}</section>`;
  }
  return `${block}${hakedisImportPanelHtml()}`;
}

function renderIncomeCategoryPage(req, res, slug) {
  const cat = incomeCategoryService.getCategoryBySlug(slug);
  const vehicles = getVehicles();
  const path = `/income/${cat.slug}`;
  const scoped = filterIncomeBySlug(getIncomeRows(), cat.slug);
  const filtered = filterTransactions(scoped, req.query);
  const pageTitle = cat.pageTitle || cat.name.toUpperCase();
  const pageDesc = cat.pageDesc || cat.description || "";
  const panelTitle = cat.panelTitle || `${cat.name} Yönetimi`;

  const importSection =
    cat.slug === "service"
      ? `<div class="income-import-section fade-in">${renderServiceImportBlock(req)}</div>`
      : "";

  const dashClass =
    cat.slug === "service" ? "dash page-enter income-module dash--income-service" : "dash page-enter income-module";

  const incomeFormPanel = glassPanel({
    title: panelTitle,
    desc: "Tarih, araç, tutar ve açıklama ile hızlı gelir kaydı",
    className: "panel--income-form",
    body: `<form id="incomeForm" method="POST" action="/income/add" class="form-grid form-grid--income income-form">
      <input type="hidden" name="income_slug" value="${escapeHtml(cat.slug)}" />
      <label class="income-form__field">
        <span class="income-form__label">Tarih</span>
        <input name="date" type="date" value="${todayInputValue()}" required />
      </label>
      <label class="income-form__field">
        <span class="income-form__label">Araç</span>
        <select name="vehicle_id" required>${vehicleOptions(vehicles, req.query.vehicle_id)}</select>
      </label>
      <label class="income-form__field">
        <span class="income-form__label">Tutar (TL)</span>
        ${moneyInputHtml("amount")}
      </label>
      <label class="income-form__field income-form__field--full">
        <span class="income-form__label">Açıklama</span>
        <input name="note" placeholder="Operasyon veya fatura notu" />
      </label>
      <button class="btn btn--primary btn--income-submit full" type="submit">${escapeHtml(cat.addLabel)}</button>
    </form>`,
  });

  const content = `
    <div class="${dashClass}">
      <header class="income-cat-header fade-in">
        <div class="income-cat-header__copy">
          <p class="income-cat-header__eyebrow">Gelir Operasyonu</p>
          <h2 class="income-cat-header__title">${escapeHtml(pageTitle)}</h2>
          <p class="income-cat-header__desc">${escapeHtml(pageDesc)}</p>
        </div>
        <a href="#incomeForm" class="btn btn--primary btn--sm btn--income-cta">+ ${escapeHtml(cat.addLabel)}</a>
      </header>

      ${incomeFormPanel}

      ${importSection}

      <div class="income-stat-bar fade-in">
        <span class="income-stat-bar__label">Toplam Kayıt:</span>
        <strong class="income-stat-bar__value">${Number(filtered.length).toLocaleString("tr-TR")}</strong>
      </div>

      ${glassPanel({
        title: "Kayıt Listesi",
        desc: `${cat.name} · kategori bazlı gelir hareketleri`,
        body: renderIncomeListBody(filtered, cat),
        className: "panel--income-list",
      })}
    </div>`;

  renderLayout(res, cat.name, content, path, req, {
    pageTitle: cat.name,
    breadcrumb: `Finans / Gelirler / ${cat.name}`,
  });
}

function registerIncome(app) {
  INCOME_SLUGS.forEach((slug) => {
    app.get(`/income/${slug}`, (req, res) => renderIncomeCategoryPage(req, res, slug));
  });

  app.get("/income", (req, res) => {
    const bundle = incomeHubService.getIncomeDashboardBundle();
    renderLayout(res, "Gelir Yönetimi", incomeHubPageHtml(bundle), "/income", req, {
      pageTitle: "Gelir Yönetimi",
      breadcrumb: "Finans / Gelirler",
    });
  });

  app.post("/income/service/import", (req, res) => {
    upload.single("pdfFile")(req, res, async (uploadErr) => {
      const back = "/income/service";
      if (uploadErr) {
        return redirectWithError(res, back, uploadErr.message || "PDF yüklenemedi.");
      }
      try {
        if (!req.file?.buffer?.length) {
          return redirectWithError(res, back, "PDF dosyası seçilmedi.");
        }
        const result = await hakedisImportService.importFromBuffer(
          req.file.buffer,
          req.file.originalname
        );
        if (result.duplicate) {
          return res.redirect(`${back}?duplicate=1`);
        }
        if (!result.ok) {
          return redirectWithError(res, back, result.message || "Import başarısız.");
        }
        res.redirect(`${back}?import_batch=${result.batchId}&ok=hakedis_imported`);
      } catch (e) {
        console.error("Hakediş import:", e);
        redirectWithError(res, back, e.message || "PDF işlenemedi.");
      }
    });
  });

  app.post("/income/add", (req, res) => {
    try {
      const { vehicle_id, amount, note, date, income_slug } = req.body;
      if (!vehicle_id) {
        return redirectWithFlash(
          res,
          `${incomePathFromSlug(income_slug)}?err=1&msg=${encodeURIComponent("Gelir için araç seçilmeli.")}`,
          "income_add_failed"
        );
      }
      const resolved = incomeCategoryService.resolveCategoryInput(income_slug);
      const amt = parseTransactionAmount(amount);
      db.prepare(
        `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date)
         VALUES (?, 'income', ?, ?, ?, ?, ?)`
      ).run(
        Number(vehicle_id),
        resolved.name,
        resolved.slug,
        amt,
        note || "",
        parseTransactionDate(date)
      );
      redirectWithFlash(res, incomePathFromSlug(resolved.slug), "income_added");
    } catch (e) {
      redirectWithFlash(
        res,
        `${incomePathFromSlug(req.body.income_slug)}?err=1&msg=${encodeURIComponent(e.message)}`,
        "income_add_failed"
      );
    }
  });

  app.get("/income/edit/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND type = 'income'").get(req.params.id);
    if (!t) return res.status(404).send(require("../lib/ui").errorPage("Kayıt yok", "Gelir kaydı bulunamadı."));
    const vehicles = getVehicles();
    const categoryNames = incomeCategoryService.getCategoryNames();
    const slug = normalizeIncomeSlug(t.category_slug || t.category);
    const backPath = incomePathFromSlug(slug);

    const content = `
      <div class="page-intro"><p>Kayıt bilgilerini güncelleyin</p></div>
      <div class="card" style="max-width:520px">
        <form method="POST" action="/income/edit/${t.id}">
          <select name="vehicle_id" required>${vehicleOptions(vehicles, t.vehicle_id)}</select>
          <select name="category" required>${categoryOptions(categoryNames, t.category)}</select>
          <input name="amount" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(formatMoneyInputValue(t.amount))}" placeholder="Tutar (örn. 42.357,00)" required />
          <input name="date" type="date" value="${dateInputFromDb(t.date)}" required />
          <input name="note" value="${escapeHtml(t.note || "")}" />
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="${backPath}">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Gelir Düzenle", content, backPath, req, {
      pageTitle: "Gelir Düzenle",
      breadcrumb: "Gelirler / Düzenle",
    });
  });

  app.post("/income/edit/:id", (req, res) => {
    try {
      const { vehicle_id, category, amount, note, date } = req.body;
      if (!vehicle_id) {
        return redirectWithFlash(res, "/income/service?err=1&msg=" + encodeURIComponent("Gelir için araç seçilmeli."), "income_update_failed");
      }
      const resolved = incomeCategoryService.resolveCategoryInput(category);
      const amt = parseTransactionAmount(amount);
      db.prepare(
        `UPDATE transactions SET vehicle_id=?, category=?, category_slug=?, amount=?, note=?, date=? WHERE id=? AND type='income'`
      ).run(Number(vehicle_id), resolved.name, resolved.slug, amt, note || "", parseTransactionDate(date), req.params.id);
      redirectWithFlash(res, incomePathFromSlug(resolved.slug), "income_updated");
    } catch (e) {
      redirectWithFlash(res, "/income/service?err=1&msg=" + encodeURIComponent(e.message), "income_update_failed");
    }
  });
}

module.exports = registerIncome;
