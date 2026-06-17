const multer = require("multer");
const hgsImportService = require("../services/hgsImportService");
const hgsService = require("../services/hgsService");
const {
  hgsImportResultHtml,
  hgsImportFormHtml,
  hgsReportsTableHtml,
  hgsExpensesTableHtml,
} = require("../lib/components/hgsImport");
const { redirectWithFlash, redirectWithError } = require("../lib/flash");
const { renderLayout, glassPanel, escapeHtml } = require("../lib/components");

const HGS_DB_PATH = require("../lib/db").DB_PATH || "no-db-path-export";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pdf$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Sadece .pdf dosyaları yüklenebilir."));
  },
});

function wantsJson(req) {
  return (
    req.xhr ||
    req.get("X-Requested-With") === "XMLHttpRequest" ||
    (req.get("Accept") || "").includes("application/json")
  );
}

function registerHgs(app) {
  app.get("/hgs", (req, res) => {
    const reports = hgsService.listReports(25);
    const expenses = hgsService.listHgsExpenses(50);
    let importResultBlock = "";
    const errMsg =
      req.query.msg ||
      (req.query.err && req.query.err !== "1" ? String(req.query.err) : null);

    if (errMsg) {
      importResultBlock = `<section class="hgs-import-result-wrap">${hgsImportResultHtml({
        ok: false,
        duplicate: false,
        message: errMsg,
        warnings: [],
        errors: [errMsg],
        errorCount: 1,
      })}</section>`;
    } else if (req.query.report_id) {
      const summary = hgsImportService.getReportSummary(Number(req.query.report_id));
      if (summary) {
        importResultBlock = `<section class="hgs-import-result-wrap">${hgsImportResultHtml({
          ok: true,
          duplicate: false,
          filename: summary.source_file_name,
          plate: summary.plate_normalized,
          hgs_no: summary.hgs_no,
          period: summary.period_label,
          vehicleMatched: summary.matched,
          passage_count: summary.passage_count,
          loading_count: summary.loading_count,
          passage_total: summary.passage_total,
          loading_total: summary.loading_total,
          totalRows: summary.totalRows,
          insertedCount: summary.totalRows,
          expenseCount: summary.expenseCount,
          skippedCount: 0,
          unmatchedPlates: summary.unmatchedPlates,
          errorCount: 0,
          message: "Son içe aktarma özeti",
          warnings: summary.unmatchedPlates?.length
            ? [`Eşleşmeyen plaka: ${summary.unmatchedPlates.join(", ")}`]
            : [],
          errors: [],
        })}</section>`;
      }
    } else if (req.query.duplicate === "1") {
      importResultBlock = `<section class="hgs-import-result-wrap">${hgsImportResultHtml({
        ok: false,
        duplicate: true,
        message: "Bu PDF daha önce içe aktarılmış.",
        warnings: ["Aynı dosya tekrar yüklenemez."],
        errors: [],
      })}</section>`;
    }

    const content = `
      <div class="dash page-enter">
        <p class="page-lead">HGS / OGS Yönetimi · İş Bankası PDF ekstre içe aktarma</p>
        ${importResultBlock}

        <div class="grid2">
          <section class="fuel-import-card hgs-import-card" id="hgsPdfImportCard">
            <div class="fuel-import-header">
              <div>
                <p class="eyebrow">İş Bankası HGS</p>
                <h2>İş Bankası HGS PDF İçe Aktar</h2>
                <p>HGS ekstre PDF dosyanızı yükleyin; geçiş ve yükleme kayıtları araç bazlı HGS/OGS gideri olarak sisteme yazılır.</p>
              </div>
            </div>
            ${hgsImportFormHtml()}
          </section>

          ${glassPanel({
            title: "Import bilgisi",
            body: `<ul class="hgs-info-list">
              <li>Aynı PDF tekrar yüklenemez (dosya hash kontrolü).</li>
              <li>Plaka filoda yoksa HGS satırları kaydedilir; gider yazılmaz ve plaka uyarısı gösterilir.</li>
              <li>Aynı plaka + tarih + tutar + geçiş bilgisi mükerrer engellenir.</li>
              <li>Import öncesi otomatik veritabanı yedeği alınır.</li>
              <li>Giderler <strong>HGS / OGS</strong> kategorisinde transactions tablosuna yazılır.</li>
            </ul>`,
          })}
        </div>

        ${glassPanel({
          title: "HGS / OGS Gider Kayıtları",
          desc: "PDF import ile oluşturulan gider hareketleri",
          body: hgsExpensesTableHtml(expenses),
        })}

        ${glassPanel({
          title: "Son HGS importları",
          body: hgsReportsTableHtml(reports),
        })}
      </div>`;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    renderLayout(res, "HGS / OGS", content, "/hgs", req, {
      pageTitle: "HGS / OGS Yönetimi",
      breadcrumb: "Operasyon / HGS / OGS",
    });
  });

  app.post("/hgs/import", (req, res) => {
    // Field name must match input name="pdfFile" in hgsImportFormHtml
    upload.single("pdfFile")(req, res, async (uploadErr) => {
      const sendError = (message, status = 400) => {
        const text = message || "İçe aktarma sırasında hata oluştu.";
        if (wantsJson(req)) {
          return res.status(status).json({ ok: false, error: text });
        }
        return redirectWithError(res, "/hgs", text);
      };

      if (uploadErr) {
        return sendError(uploadErr.message || "Dosya yüklenemedi.");
      }
      if (!req.file?.buffer?.length) {
        return sendError("PDF dosyası alınamadı");
      }

      console.log("[HGS_DB_PATH]", HGS_DB_PATH);
      console.log("[HGS_IMPORT_START]", {
        file: req.file?.originalname,
        size: req.file?.size ?? req.file?.buffer?.length,
        path: req.file?.path,
        body: req.body,
      });

      try {
        const result = await hgsImportService.importFromBuffer(
          req.file.buffer,
          req.file.originalname || "hgs.pdf"
        );

        console.log("[HGS_IMPORT_RESULT]", result);

        if (wantsJson(req)) {
          return res.status(result.duplicate ? 409 : 200).json({
            ok: result.ok && !result.duplicate,
            result,
            resultHtml: hgsImportResultHtml(result),
          });
        }

        if (result.duplicate) {
          return res.redirect("/hgs?duplicate=1");
        }

        return redirectWithFlash(res, `/hgs?report_id=${result.reportId}`, "hgs_imported");
      } catch (error) {
        console.error("[HGS_IMPORT_ERROR]", error);
        return sendError(error?.message || String(error) || "HGS PDF içe aktarılamadı.");
      }
    });
  });
}

module.exports = registerHgs;
