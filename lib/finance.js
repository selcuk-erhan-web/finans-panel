const db = require("./db");
const { resolveQueryDates } = require("./dates");
const { parseTrMoney } = require("../utils/numbers");
const { parseMoneyInputRequired } = require("../utils/money");

/** Güvenli sayı — NaN/undefined/string birleşimi engeller */
function safeAmount(val) {
  if (val === "" || val == null) return 0;
  const n = typeof val === "number" ? val : parseTrMoney(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n));
}

function money(n) {
  return safeAmount(n).toLocaleString("tr-TR") + " TL";
}

function getTotals() {
  const rows = db.prepare("SELECT type, amount FROM transactions").all();
  let income = 0;
  let expense = 0;
  rows.forEach((t) => {
    if (t.type === "income") income += safeAmount(t.amount);
    if (t.type === "expense") expense += safeAmount(t.amount);
  });
  return { income, expense, balance: income - expense };
}

function getVehicleFinance(vehicleId) {
  const rows = db
    .prepare(
      "SELECT type, amount, category FROM transactions WHERE vehicle_id = ?"
    )
    .all(vehicleId);
  let income = 0;
  let expense = 0;
  const expenseByCategory = {};
  rows.forEach((t) => {
    if (t.type === "income") income += safeAmount(t.amount);
    if (t.type === "expense") {
      expense += safeAmount(t.amount);
      const cat = t.category || "Diğer";
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + safeAmount(t.amount);
    }
  });
  return { income, expense, net: income - expense, expenseByCategory };
}

function getAllVehicleSummaries() {
  const vehicles = db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
  const transactions = db.prepare("SELECT * FROM transactions").all();
  return vehicles.map((v) => {
    let income = 0;
    let expense = 0;
    transactions.forEach((t) => {
      if (Number(t.vehicle_id) === Number(v.id)) {
        if (t.type === "income") income += safeAmount(t.amount);
        if (t.type === "expense") expense += safeAmount(t.amount);
      }
    });
    return { ...v, income, expense, net: income - expense };
  });
}

function getExpenseByCategory() {
  const { resolveSlugFromCategory, resolveNameFromSlug } = require("./expenseCategoryMap");
  const rows = db
    .prepare("SELECT category, category_slug, amount FROM transactions WHERE type = 'expense'")
    .all();
  const map = {};
  rows.forEach((r) => {
    const slug = r.category_slug || resolveSlugFromCategory(r.category);
    const cat = resolveNameFromSlug(slug);
    map[cat] = (map[cat] || 0) + safeAmount(r.amount);
  });
  return map;
}

function getTypeTotals(summaries, typeName) {
  const filtered = summaries.filter((v) => v.type === typeName);
  let income = 0;
  let expense = 0;
  filtered.forEach((v) => {
    income += v.income;
    expense += v.expense;
  });
  return {
    count: filtered.length,
    income,
    expense,
    net: income - expense,
  };
}

function getBestWorst(summaries) {
  let best = { plate: "—", net: null, id: null };
  let worst = { plate: "—", net: null, id: null };
  summaries.forEach((v) => {
    if (best.net === null || v.net > best.net) {
      best = { plate: v.plate, net: v.net, id: v.id };
    }
    if (worst.net === null || v.net < worst.net) {
      worst = { plate: v.plate, net: v.net, id: v.id };
    }
  });
  return { best, worst };
}

function getAverageVehicleNet(summaries) {
  if (!summaries.length) return 0;
  const sum = summaries.reduce((a, v) => a + v.net, 0);
  return Math.round(sum / summaries.length);
}

function vehicleStatus(v) {
  if (v.income === 0 && v.expense === 0) return "empty";
  if (v.net > 0) return "profit";
  if (v.net < 0) return "loss";
  return "empty";
}

function getTotalsInRange(dateFrom, dateTo) {
  const rows = db
    .prepare(
      `SELECT type, amount FROM transactions
       WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?`
    )
    .all(dateFrom, dateTo);
  let income = 0;
  let expense = 0;
  rows.forEach((t) => {
    if (t.type === "income") income += safeAmount(t.amount);
    if (t.type === "expense") expense += safeAmount(t.amount);
  });
  return { income, expense, balance: income - expense };
}

function getSharedExpenseTotal() {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE type = 'expense' AND vehicle_id IS NULL`
    )
    .get();
  return safeAmount(row?.total);
}

function getCategoryTotal(vehicleId, categoryName) {
  const rows = db
    .prepare(
      `SELECT amount, category FROM transactions
       WHERE vehicle_id = ? AND type = 'expense'`
    )
    .all(vehicleId);
  let total = 0;
  const target = categoryName.toLowerCase();
  rows.forEach((r) => {
    if ((r.category || "").toLowerCase() === target) {
      total += safeAmount(r.amount);
    }
  });
  return total;
}

function getVehicleMonthlyData(vehicleId, monthCount = 6) {
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const netData = [];
  const now = new Date();
  const txs = db
    .prepare("SELECT type, amount, date FROM transactions WHERE vehicle_id = ?")
    .all(vehicleId);

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthNames = [
      "Oca", "Şub", "Mar", "Nis", "May", "Haz",
      "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
    ];
    labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);

    let inc = 0;
    let exp = 0;
    txs.forEach((t) => {
      if (String(t.date || "").slice(0, 7) !== key) return;
      if (t.type === "income") inc += safeAmount(t.amount);
      if (t.type === "expense") exp += safeAmount(t.amount);
    });
    incomeData.push(inc);
    expenseData.push(exp);
    netData.push(inc - exp);
  }

  return { labels, incomeData, expenseData, netData };
}

/** Filo geneli aylık gelir/gider (dashboard grafiği) */
function getFleetMonthlyData(monthCount = 6) {
  const rows = db.prepare("SELECT type, amount, date FROM transactions").all();
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const now = new Date();
  const monthNames = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    labels.push(`${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);

    let inc = 0;
    let exp = 0;
    rows.forEach((t) => {
      if (String(t.date || "").slice(0, 7) !== key) return;
      if (t.type === "income") inc += safeAmount(t.amount);
      if (t.type === "expense") exp += safeAmount(t.amount);
    });
    incomeData.push(inc);
    expenseData.push(exp);
  }

  return { labels, incomeData, expenseData };
}

function getRecentExpenses(limit = 8) {
  return db
    .prepare(
      `SELECT t.*, v.plate FROM transactions t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.type = 'expense'
       ORDER BY t.date DESC LIMIT ?`
    )
    .all(limit);
}

function getStatusCounts(summaries) {
  let profit = 0;
  let loss = 0;
  let empty = 0;
  summaries.forEach((v) => {
    const s = vehicleStatus(v);
    if (s === "profit") profit++;
    else if (s === "loss") loss++;
    else empty++;
  });
  return { profit, loss, empty };
}

function getFleetStatus(totals) {
  if (totals.balance > 0) return { label: "Filo kârlı", tone: "profit" };
  if (totals.balance < 0) return { label: "Filo zararda", tone: "loss" };
  return { label: "Dengede", tone: "neutral" };
}

/** Yakıt / bakım / sigorta gider oranları (araç detay) */
function getExpenseRatioBreakdown(vehicleId) {
  const finance = getVehicleFinance(vehicleId);
  const total = finance.expense || 0;
  const defs = [
    { key: "fuel", name: "Yakıt", icon: "⛽", match: ["yakıt"] },
    { key: "maint", name: "Bakım", icon: "🔧", match: ["bakım", "lastik"] },
    { key: "ins", name: "Sigorta", icon: "🛡️", match: ["sigorta", "muayene"] },
  ];
  return defs.map((d) => {
    let amount = 0;
    Object.entries(finance.expenseByCategory).forEach(([cat, val]) => {
      const c = (cat || "").toLowerCase();
      if (d.match.some((m) => c.includes(m))) amount += safeAmount(val);
    });
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    return { ...d, amount, pct };
  });
}

function getHighestExpenseVehicle(summaries) {
  if (!summaries.length) return { plate: "—", expense: 0, id: null };
  return summaries.reduce((top, v) =>
    v.expense > top.expense ? { plate: v.plate, expense: v.expense, id: v.id } : top
  );
}

function getTopExpenseCategory(expenseByCat) {
  const entries = Object.entries(expenseByCat);
  if (!entries.length) return { name: "-", amount: 0 };
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], amount: entries[0][1] };
}

function filterTransactions(rows, query) {
  const resolved = resolveQueryDates(query);
  const q = (resolved.q || "").trim().toLowerCase();
  const vehicleId = resolved.vehicle_id || "";
  const category = resolved.category || "";
  const dateFrom = resolved.date_from || "";
  const dateTo = resolved.date_to || "";

  return rows.filter((t) => {
    if (vehicleId && String(t.vehicle_id) !== String(vehicleId)) return false;
    if (category) {
      const { normalizeExpenseSlug } = require("./expenseCategoryMap");
      const { normalizeIncomeSlug } = require("./incomeCategoryMap");
      if (t.type === "income") {
        const want = normalizeIncomeSlug(category);
        const got = normalizeIncomeSlug(t.category_slug || t.category);
        if (want !== got) return false;
      } else {
        const want = normalizeExpenseSlug(category);
        const got = normalizeExpenseSlug(t.category_slug || t.category);
        if (want !== got) return false;
      }
    }
    const d = String(t.date || "").slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (q) {
      const hay = `${t.plate || ""} ${t.category || ""} ${t.note || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function parseTransactionDate(input) {
  if (!input) return new Date().toISOString().slice(0, 19).replace("T", " ");
  return `${input} 12:00:00`;
}

function dateInputFromDb(dbDate) {
  if (!dbDate) return todayInputValue();
  return String(dbDate).slice(0, 10);
}

function parseTransactionAmount(input) {
  return parseMoneyInputRequired(input);
}

module.exports = {
  money,
  safeAmount,
  parseTransactionAmount,
  getTotals,
  getTotalsInRange,
  getSharedExpenseTotal,
  getVehicleFinance,
  getAllVehicleSummaries,
  getExpenseByCategory,
  getTypeTotals,
  getBestWorst,
  getAverageVehicleNet,
  vehicleStatus,
  getCategoryTotal,
  getVehicleMonthlyData,
  getFleetMonthlyData,
  getRecentExpenses,
  getStatusCounts,
  getTopExpenseCategory,
  getHighestExpenseVehicle,
  getFleetStatus,
  getExpenseRatioBreakdown,
  filterTransactions,
  todayInputValue,
  parseTransactionDate,
  dateInputFromDb,
};
