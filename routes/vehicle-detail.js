const db = require("../lib/db");
const {
  money,
  getVehicleFinance,
  getVehicleMonthlyData,
  vehicleStatus,
} = require("../lib/finance");
const { chartOpts } = require("../lib/charts");
const maintenanceService = require("../services/maintenanceService");
const fuelService = require("../services/fuelService");
const {
  escapeHtml,
  metricCard,
  metricGrid,
  glassPanel,
  modernTable,
  transactionRow,
  chartBoot,
  vehicleHeroLarge,
  transactionTimeline,
  monthlyMiniCards,
  typeBadge,
  statusPill,
  renderLayout,
  errorPage,
} = require("../lib/ui");

function renderVehicleDetail(req, res) {
  try {
    const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
    if (!v) return res.status(404).send(errorPage("Araç bulunamadı", "Kayıt bulunamadı."));

    const finance = getVehicleFinance(v.id);
    const summary = { ...v, income: finance.income, expense: finance.expense, net: finance.net };
    const st = vehicleStatus(summary);
    const netTone = st === "profit" ? "profit" : st === "loss" ? "loss" : "neutral";
    const monthly = getVehicleMonthlyData(v.id, 6);
    const fuelStats = fuelService.vehicleStats(v.id);
    const maintHistory = maintenanceService.listByVehicle(v.id);

    const incomes = db
      .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'income' ORDER BY date DESC`)
      .all(v.id);
    const expenses = db
      .prepare(`SELECT * FROM transactions WHERE vehicle_id = ? AND type = 'expense' ORDER BY date DESC`)
      .all(v.id);

    const lastTx = [...incomes, ...expenses]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 12);

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

    const catRows = Object.entries(finance.expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => {
        const pct =
          finance.expense > 0 ? Math.round((amt / finance.expense) * 100) : 0;
        return `<tr>
          <td>${escapeHtml(cat)}</td>
          <td class="text-neg"><strong>${money(amt)}</strong></td>
          <td><div class="progress" style="min-width:120px"><div class="progress__bar progress__bar--rose" style="width:${pct}%"></div></div></td>
          <td>${pct}%</td>
        </tr>`;
      });

    const maintRows = maintHistory.map(
      (m) => `<tr>
        <td>${escapeHtml(m.type_label)}</td>
        <td>${escapeHtml(m.description || "—")}</td>
        <td>${m.amount ? money(m.amount) : "—"}</td>
        <td>${escapeHtml(m.service_date || "—")}</td>
        <td>${escapeHtml(m.next_service_date || "—")}</td>
      </tr>`
    );

    const fuelRows = fuelStats.recent.map((f) => {
      const kmCell =
        f.km != null
          ? Number(f.km).toLocaleString("tr-TR")
          : '<span class="text-warn">Veri yetersiz</span>';
      const extra =
        f.cost_per_km != null ? ` · ${f.cost_per_km} TL/km` : "";
      const consumption =
        f.km_per_liter != null ? f.km_per_liter + " km/L" + extra : '<span class="text-warn">Veri yetersiz</span>';
      return `<tr>
        <td>${Number(f.liter).toLocaleString("tr-TR")} L</td>
        <td>${money(f.total_amount)}</td>
        <td>${kmCell}</td>
        <td>${consumption}</td>
        <td>${escapeHtml(f.fuel_date || "")}</td>
      </tr>`;
    });

    const currentKm = v.current_km ?? v.km;
    const kmStr =
      currentKm != null && Number(currentKm) > 0
        ? Number(currentKm).toLocaleString("tr-TR") + " km"
        : '<span class="text-warn">Veri yetersiz</span>';

    const content = `
      <div class="dash page-enter">
        ${vehicleHeroLarge(v, summary)}

        ${glassPanel({
          title: "Araç bilgileri",
          action: `<a href="/vehicle/edit/${v.id}" class="btn btn--ghost btn--sm">Düzenle</a>`,
          body: `<div class="info-grid">
            <div class="info-item"><span>Plaka</span><strong>${escapeHtml(v.plate)}</strong></div>
            <div class="info-item"><span>Marka</span><strong>${escapeHtml(v.brand || "—")}</strong></div>
            <div class="info-item"><span>Model</span><strong>${escapeHtml(v.model || "—")}</strong></div>
            <div class="info-item"><span>Yıl</span><strong>${escapeHtml(v.year || "—")}</strong></div>
            <div class="info-item"><span>Güncel KM</span><strong>${kmStr}</strong></div>
            <div class="info-item"><span>Araç tipi</span><strong>${typeBadge(v.type)}</strong></div>
            <div class="info-item"><span>Durum</span><strong>${statusPill(summary)}</strong></div>
          </div>`,
        })}

        ${metricGrid(
          [
            metricCard({ label: "Toplam Gelir", value: money(finance.income), tone: "income", icon: "↑" }),
            metricCard({ label: "Toplam Gider", value: money(finance.expense), tone: "expense", icon: "↓" }),
            metricCard({
              label: "Net Kâr",
              value: money(finance.net),
              hint: st === "profit" ? "Kârlı" : st === "loss" ? "Zararda" : "Veri Yok",
              tone: netTone,
              icon: "◆",
            }),
            metricCard({
              label: "Toplam Yakıt",
              value: money(fuelStats.totalCost),
              hint: `${fuelStats.totalLiters} L · ort. ${fuelStats.avgPrice != null ? fuelStats.avgPrice + " ₺/L" : "—"}`,
              tone: "fleet",
              icon: "⛽",
            }),
          ],
          "4"
        )}

        <div class="dash-split">
          ${glassPanel({
            title: "Aylık gelir / gider",
            body: `<div class="chart-wrap chart-wrap--modern"><canvas id="vehicleMonthlyChart"></canvas></div>`,
          })}
          ${glassPanel({
            title: "Gider kategori dağılımı",
            body: modernTable(
              ["Kategori", "Tutar", "Pay", "%"],
              catRows,
              { text: "Gider kategorisi yok" }
            ),
          })}
        </div>

        ${monthlyMiniCards(monthly)}

        ${glassPanel({
          title: "Son işlemler",
          desc: "Gelir ve gider timeline",
          body: transactionTimeline(
            lastTx.map((t) => ({ ...t, plate: v.plate }))
          ),
        })}

        <div class="dash-split">
          ${glassPanel({
            title: "Gelir geçmişi",
            desc: `${incomes.length} kayıt`,
            action: `<a href="/income?vehicle_id=${v.id}" class="btn btn--ghost btn--sm">+ / Tümü</a>`,
            body: modernTable(
              ["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", ""],
              incomeRows,
              { text: "Henüz gelir kaydı yok" }
            ),
          })}
          ${glassPanel({
            title: "Gider geçmişi",
            desc: `${expenses.length} kayıt`,
            action: `<a href="/expense?vehicle_id=${v.id}" class="btn btn--ghost btn--sm">+ / Tümü</a>`,
            body: modernTable(
              ["Araç", "Kategori", "Tutar", "Açıklama", "Tarih", ""],
              expenseRows,
              { text: "Henüz gider kaydı yok" }
            ),
          })}
        </div>

        <div class="dash-split">
          ${glassPanel({
            title: "Bakım geçmişi",
            desc: "Yağ, lastik, muayene, sigorta…",
            action: `<a href="/maintenance?vehicle_id=${v.id}" class="btn btn--ghost btn--sm">+ Bakım</a>`,
            body: modernTable(
              ["Tür", "Açıklama", "Tutar", "Servis", "Sonraki"],
              maintRows,
              { text: "Bakım kaydı yok — ekleyin" }
            ),
          })}
          ${glassPanel({
            title: "Yakıt geçmişi",
            desc: `Ort. ${fuelStats.avgKmPerLiter != null ? fuelStats.avgKmPerLiter + " km/L" : "—"} · km başı ${fuelStats.avgCostPerKm != null ? fuelStats.avgCostPerKm + " TL" : "—"}`,
            action: `<a href="/fuel?vehicle_id=${v.id}" class="btn btn--ghost btn--sm">+ Yakıt</a>`,
            body: modernTable(
              ["Litre", "Tutar", "KM", "Tüketim", "Tarih"],
              fuelRows,
              { text: "Yakıt kaydı yok — ekleyin" }
            ),
          })}
        </div>
      </div>
      ${chartBoot([
        `new Chart(document.getElementById("vehicleMonthlyChart"),{
          type:"bar",
          data:{labels:${JSON.stringify(monthly.labels)},datasets:[
            {label:"Gelir",data:${JSON.stringify(monthly.incomeData)},backgroundColor:"rgba(16,185,129,0.85)",borderRadius:10},
            {label:"Gider",data:${JSON.stringify(monthly.expenseData)},backgroundColor:"rgba(244,63,94,0.85)",borderRadius:10}
          ]},
          options:${chartOpts()}
        });`,
      ])}`;

    renderLayout(res, v.plate, content, "/vehicles", req, {
      pageTitle: v.plate,
      breadcrumb: `${v.plate} · Araç detayı`,
    });
  } catch (err) {
    console.error("vehicle detail:", err);
    res.status(500).send(errorPage("Hata", "Araç detayı yüklenirken bir sorun oluştu."));
  }
}

module.exports = { renderVehicleDetail };
