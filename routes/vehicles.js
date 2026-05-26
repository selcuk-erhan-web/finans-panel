const db = require("../lib/db");
const { VEHICLE_TARGET } = require("../lib/constants");
const { redirectWithFlash } = require("../lib/flash");
const {
  money,
  getAllVehicleSummaries,
  getVehicleFinance,
  getCategoryTotal,
  getVehicleMonthlyData,
} = require("../lib/finance");
const {
  escapeHtml,
  pageHeader,
  kpiCard,
  kpiGrid,
  vehicleTypeBadge,
  dataTable,
  vehicleCardGrid,
  transactionRow,
  chartScripts,
  renderLayout,
  vehicleOptions,
  errorPage,
} = require("../lib/ui");

function getVehicles() {
  return db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
}

function registerVehicles(app) {
  app.get("/vehicles", (req, res) => {
    const summaries = getAllVehicleSummaries();
    const vehicles = getVehicles();

    const tableRows = vehicles.map(
      (v) => `<tr>
        <td><a class="plate-link" href="/vehicle/${v.id}">${escapeHtml(v.plate)}</a></td>
        <td>${escapeHtml(v.brand || "-")}</td>
        <td>${escapeHtml(v.model || "-")}</td>
        <td>${escapeHtml(v.year || "-")}</td>
        <td>${v.km != null ? Number(v.km).toLocaleString("tr-TR") : "-"}</td>
        <td>${vehicleTypeBadge(v.type)}</td>
        <td class="actions">
          <a class="btn btn-sm btn-detail" href="/vehicle/${v.id}">Detay</a>
          <a class="btn btn-sm btn-secondary" href="/vehicle/edit/${v.id}">Düzenle</a>
          <a class="btn btn-sm btn-danger" href="/vehicle/delete/${v.id}" onclick="return confirm('Araç silinsin mi?')">Sil</a>
        </td>
      </tr>`
    );

    const content = `
      ${pageHeader("Araçlar", `Filo · ${vehicles.length} / ${VEHICLE_TARGET} araç`)}
      <div class="grid2">
        <div class="card">
          <h2>Araç Ekle</h2>
          <form method="POST" action="/vehicle/add" class="form-grid">
            <input name="plate" placeholder="Plaka" required />
            <input name="brand" placeholder="Marka" />
            <input name="model" placeholder="Model" />
            <input name="year" placeholder="Yıl" />
            <input name="km" type="number" placeholder="KM" min="0" />
            <select name="type" required><option value="Servis">Servis</option><option value="Turizm">Turizm</option></select>
            <button class="full" type="submit">Araç Ekle</button>
          </form>
        </div>
        <div class="card"><h2>Filo Kartları</h2><p class="muted">Her kartta plaka, tip, gelir/gider/net ve durum rengi gösterilir.</p></div>
      </div>
      <div class="card"><h2>Filo Özeti</h2>${vehicleCardGrid(summaries)}</div>
      <div class="card">
        <h2>Tablo Görünümü</h2>
        ${dataTable(["Plaka", "Marka", "Model", "Yıl", "KM", "Tip", "İşlem"], tableRows, { icon: "🚗", title: "Araç yok", desc: "İlk aracınızı ekleyin." })}
      </div>`;

    renderLayout(res, "Araçlar", content, "/vehicles", req);
  });

  app.post("/vehicle/add", (req, res) => {
    const { plate, brand, model, year, km, type } = req.body;
    db.prepare(
      `INSERT INTO vehicles (plate, brand, model, year, km, type) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(plate?.trim(), brand, model, year, Number(km || 0), type);
    redirectWithFlash(res, "/vehicles", "vehicle_added");
  });

  app.get("/vehicle/edit/:id", (req, res) => {
    const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
    if (!v) return res.status(404).send(errorPage("Araç bulunamadı", "Bu araç silinmiş veya mevcut değil."));

    const content = `
      ${pageHeader("Araç Düzenle", v.plate)}
      <div class="card" style="max-width:520px">
        <form method="POST" action="/vehicle/edit/${v.id}">
          <input name="plate" value="${escapeHtml(v.plate)}" required />
          <input name="brand" value="${escapeHtml(v.brand || "")}" placeholder="Marka" />
          <input name="model" value="${escapeHtml(v.model || "")}" placeholder="Model" />
          <input name="year" value="${escapeHtml(v.year || "")}" placeholder="Yıl" />
          <input name="km" type="number" value="${v.km || 0}" />
          <select name="type">
            <option value="Servis" ${v.type === "Servis" ? "selected" : ""}>Servis</option>
            <option value="Turizm" ${v.type === "Turizm" ? "selected" : ""}>Turizm</option>
          </select>
          <button type="submit">Kaydet</button>
          <a class="btn btn-secondary" href="/vehicles">İptal</a>
        </form>
      </div>`;

    renderLayout(res, "Araç Düzenle", content, "/vehicles", req);
  });

  app.post("/vehicle/edit/:id", (req, res) => {
    const { plate, brand, model, year, km, type } = req.body;
    db.prepare(
      `UPDATE vehicles SET plate=?, brand=?, model=?, year=?, km=?, type=? WHERE id=?`
    ).run(plate?.trim(), brand, model, year, Number(km || 0), type, req.params.id);
    redirectWithFlash(res, "/vehicles", "vehicle_updated");
  });

  app.get("/vehicle/delete/:id", (req, res) => {
    db.prepare("DELETE FROM vehicles WHERE id = ?").run(req.params.id);
    redirectWithFlash(res, "/vehicles", "vehicle_deleted");
  });

  app.get("/vehicle/:id", (req, res) => {
    const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
    if (!v) return res.status(404).send(errorPage("Araç bulunamadı", "Kayıt bulunamadı."));

    const finance = getVehicleFinance(v.id);
    const fuelTotal = getCategoryTotal(v.id, "Yakıt");
    const maintTotal = getCategoryTotal(v.id, "Bakım");
    const monthly = getVehicleMonthlyData(v.id, 6);

    const incomes = db
      .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'income' ORDER BY date DESC`)
      .all(v.id);
    const expenses = db
      .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'expense' ORDER BY date DESC`)
      .all(v.id);

    const lastTx = [...incomes, ...expenses]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);

    const incomeRows = incomes.map((t) =>
      transactionRow(
        { ...t, plate: v.plate, type: "income" },
        `/income/edit/${t.id}`,
        `/transaction/delete/${t.id}?from=vehicle&vehicle_id=${v.id}`
      )
    );
    const expenseRows = expenses.map((t) =>
      transactionRow(
        { ...t, plate: v.plate, type: "expense" },
        `/expense/edit/${t.id}`,
        `/transaction/delete/${t.id}?from=vehicle&vehicle_id=${v.id}`
      )
    );
    const lastRows = lastTx.map((t) => {
      const inc = t.type === "income";
      return `<tr>
        <td>${inc ? "Gelir" : "Gider"}</td>
        <td>${escapeHtml(t.category || "-")}</td>
        <td class="${inc ? "green" : "red"}">${money(t.amount)}</td>
        <td>${escapeHtml(t.note || "-")}</td>
        <td>${escapeHtml(String(t.date || "").slice(0, 16))}</td>
      </tr>`;
    });

    const catRows = Object.entries(finance.expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `<tr><td>${escapeHtml(cat)}</td><td class="red">${money(amt)}</td></tr>`);

    const content = `
      ${pageHeader(v.plate, `${v.brand || ""} ${v.model || ""}`.trim())}
      ${kpiGrid([
        kpiCard("Toplam Gelir", money(finance.income), "green"),
        kpiCard("Toplam Gider", money(finance.expense), "red"),
        kpiCard("Net Kâr", money(finance.net), finance.net >= 0 ? "green" : "red"),
        kpiCard("Yakıt Toplamı", money(fuelTotal), "amber"),
        kpiCard("Bakım Toplamı", money(maintTotal), "blue"),
      ])}
      <div class="grid2">
        <div class="card"><h2>Aylık Gelir / Gider</h2><div class="chart-box"><canvas id="monthlyChart"></canvas></div></div>
        <div class="card"><h2>Aylık Net Kâr</h2><div class="chart-box"><canvas id="netChart"></canvas></div></div>
      </div>
      <div class="card">
        <h2>Araç Bilgileri</h2>
        <div class="info-grid">
          <div class="info-item"><span>Plaka</span><strong>${escapeHtml(v.plate)}</strong></div>
          <div class="info-item"><span>Marka / Model</span><strong>${escapeHtml(v.brand || "-")} / ${escapeHtml(v.model || "-")}</strong></div>
          <div class="info-item"><span>Yıl / KM</span><strong>${escapeHtml(v.year || "-")} · ${v.km != null ? Number(v.km).toLocaleString("tr-TR") : "-"}</strong></div>
          <div class="info-item"><span>Tip</span><strong>${vehicleTypeBadge(v.type)}</strong></div>
        </div>
        <p class="actions" style="margin-top:18px">
          <a class="btn btn-secondary" href="/vehicle/edit/${v.id}">Düzenle</a>
          <a class="btn" href="/income">+ Gelir</a>
          <a class="btn btn-danger" href="/expense">+ Gider</a>
          <a class="btn btn-outline" href="/vehicles">← Araçlar</a>
        </p>
      </div>
      <div class="card"><h2>Kategori Bazlı Gider</h2>${dataTable(["Kategori", "Toplam"], catRows, { icon: "💸", title: "Gider yok", desc: "Bu araç için gider kaydı yok." })}</div>
      <div class="card"><h2>Son İşlemler</h2>${dataTable(["Tip", "Kategori", "Tutar", "Açıklama", "Tarih"], lastRows, { icon: "📋", title: "İşlem yok", desc: "Henüz hareket kaydı yok." })}</div>
      <div class="card"><h2>Gelir Geçmişi</h2>${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", ""], incomeRows, { icon: "💰", title: "Gelir yok", desc: "Gelir kaydı ekleyin." })}</div>
      <div class="card"><h2>Gider Geçmişi</h2>${dataTable(["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", ""], expenseRows, { icon: "💸", title: "Gider yok", desc: "Gider kaydı ekleyin." })}</div>
      ${chartScripts([
        `new Chart(document.getElementById("monthlyChart"),{type:"bar",data:{labels:${JSON.stringify(monthly.labels)},datasets:[{label:"Gelir",data:${JSON.stringify(monthly.incomeData)},backgroundColor:"#059669",borderRadius:6},{label:"Gider",data:${JSON.stringify(monthly.expenseData)},backgroundColor:"#e11d48",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});`,
        `new Chart(document.getElementById("netChart"),{type:"line",data:{labels:${JSON.stringify(monthly.labels)},datasets:[{label:"Net Kâr",data:${JSON.stringify(monthly.netData)},borderColor:"#4f46e5",backgroundColor:"rgba(79,70,229,0.1)",fill:true,tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});`,
      ])}`;

    renderLayout(res, "Araç Detay", content, "/vehicles", req);
  });
}

module.exports = { registerVehicles, getVehicles };
