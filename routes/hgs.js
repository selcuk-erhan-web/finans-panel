const multer = require("multer");
const hgsImportService = require("../services/hgsImportService");
const hgsService = require("../services/hgsService");
const { hgsImportResultHtml, hgsReportsTableHtml } = require("../lib/components/hgsImport");
const { redirectWithFlash } = require("../lib/flash");
const { renderLayout, glassPanel, escapeHtml, dataTable } = require("../lib/components");

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
    let importResultBlock = "";
    const err = req.query.err;

    if (err) {
      importResultBlock = `<section class="hgs-import-result-wrap">${hgsImportResultHtml({
        ok: false,
        duplicate: false,
        message: String(err),
        warnings: [],
        errors: [String(err)],
      })}</section>`;
    } else if (req.query.report_id) {
      const summary = hgsImportService.getReportSummary(Number(req.query.report_id));
      if (summary) {
        const txCount = require("../lib/db")
          .prepare("SELECT COUNT(*) AS c FROM hgs_transactions WHERE report_id = ?")
          .get(summary.id).c;
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
          insertedCount: txCount,
          skippedCount: 0,
          message: "Son içe aktarma özeti",
          warnings: summary.matched ? [] : [`Eşleşmeyen plaka: ${summary.plate_normalized}`],
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
        <p class="page-lead">HGS Yönetimi · İş Bankası PDF ekstre içe aktarma</p>
        ${importResultBlock}

        <div class="grid2">
          <section class="fuel-import-card hgs-import-card" id="hgsPdfImportCard">
            <div class="fuel-import-header">
              <div>
                <p class="eyebrow">İş Bankası HGS</p>
                <h2>İş Bankası HGS PDF İçe Aktar</h2>
                <p>HGS ekstre PDF dosyanızı yükleyin; sistem plaka, dönem, geçiş ve yükleme kayıtlarını otomatik analiz eder.</p>
              </div>
            </div>
            <form method="POST" action="/hgs/import" enctype="multipart/form-data" class="fuel-import-form">
              <label class="fuel-dropzone">
                <input type="file" name="pdfFile" accept=".pdf,application/pdf" required />
                <strong>PDF dosyasını seç</strong>
                <span>Sadece İş Bankası HGS ekstre PDF formatı desteklenir.</span>
              </label>
              <button type="submit" class="btn btn-primary">PDF İçe Aktar</button>
            </form>
          </section>

          ${glassPanel({
            title: "Import bilgisi",
            body: `<ul class="hgs-info-list">
              <li>Aynı PDF tekrar yüklenemez (dosya hash kontrolü).</li>
              <li>Plaka sistemde yoksa import tamamlanır; eşleşmeyen plaka uyarısı gösterilir.</li>
              <li>Import öncesi otomatik veritabanı yedeği alınır.</li>
              <li>HGS kayıtları ayrı tablolarda tutulur; mevcut gider akışı zorlanmaz.</li>
            </ul>`,
          })}
        </div>

        ${glassPanel({
          title: "Son HGS importları",
          body: hgsReportsTableHtml(reports),
        })}
      </div>`;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    renderLayout(res, "HGS Yönetimi", content, "/hgs", req, {
      pageTitle: "HGS Yönetimi",
      breadcrumb: "Operasyon / HGS",
    });
  });

  app.post("/hgs/import", (req, res) => {
    upload.single("pdfFile")(req, res, async (uploadErr) => {
      const sendError = (message, status = 400) => {
        if (wantsJson(req)) {
          return res.status(status).json({ ok: false, error: message });
        }
        return redirectWithFlash(res, `/hgs?err=${encodeURIComponent(message)}`);
      };

      if (uploadErr) {
        return sendError(uploadErr.message || "Dosya yüklenemedi.");
      }
      if (!req.file?.buffer?.length) {
        return sendError("PDF dosyası seçilmedi.");
      }

      try {
        const result = await hgsImportService.importFromBuffer(
          req.file.buffer,
          req.file.originalname || "hgs.pdf"
        );

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

        return res.redirect(`/hgs?report_id=${result.reportId}&ok=hgs_imported`);
      } catch (e) {
        return sendError(e.message || "HGS PDF içe aktarılamadı.");
      }
    });
  });
}

module.exports = registerHgs;
