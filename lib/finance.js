const db = require("./db");
const { resolveQueryDates } = require("./dates");

function money(n) {
  return Number(n || 0).toLocaleString("tr-TR") + " TL";
}

function getTotals() {
  const rows = db.prepare("SELECT type, amount FROM transactions").all();
  let income = 0;
  let expense = 0;
  rows.forEach((t) => {
    if (t.type === "income") income += Number(t.amount || 0);
    if (t.type === "expense") expense += Number(t.amount || 0);
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
    if (t.type === "income") income += Number(t.amount || 0);
    if (t.type === "expense") {
      expense += Number(t.amount || 0);
      const cat = t.category || "Diğer";
      expenseByCategory[cat] =
        (expenseByCategory[cat] || 0) + Number(t.amount || 0);
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
        if (t.type === "income") income += Number(t.amount || 0);
        if (t.type === "expense") expense += Number(t.amount || 0);
      }
    });
    return { ...v, income, expense, net: income - expense };
  });
}

function getExpenseByCategory() {
  const rows = db
    .prepare("SELECT category, amount FROM transactions WHERE type = 'expense'")
    .all();
  const map = {};
  rows.forEach((r) => {
    const cat = r.category || "Diğer";
    map[cat] = (map[cat] || 0) + Number(r.amount || 0);
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
  let best = { plate: "-", net: null, id: null };
  let worst = { plate: "-", net: null, id: null };
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
      `SELECT type, amount, date FROM transactions
       WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?`
    )
    .all(dateFrom, dateTo);
  let income = 0;
  let expense = 0;
  rows.forEach((t) => {
    if (t.type === "income") income += Number(t.amount || 0);
    if (t.type === "expense") expense += Number(t.amount || 0);
  });
  return { income, expense, balance: income - expense };
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
      total += Number(r.amount || 0);
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

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    labels.push(`${monthNames[m]} ${y}`);

    const txs = db
      .prepare(
        `SELECT type, amount, date FROM transactions WHERE vehicle_id = ?`
      )
      .all(vehicleId);

    let inc = 0;
    let exp = 0;
    txs.forEach((t) => {
      const txKey = String(t.date || "").slice(0, 7);
      if (txKey !== key) return;
      if (t.type === "income") inc += Number(t.amount || 0);
      if (t.type === "expense") exp += Number(t.amount || 0);
    });
    incomeData.push(inc);
    expenseData.push(exp);
    netData.push(inc - exp);
  }

  return { labels, incomeData, expenseData, netData };
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
    if (category && (t.category || "") !== category) return false;
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

module.exports = {
  money,
  getTotals,
  getTotalsInRange,
  getVehicleFinance,
  getAllVehicleSummaries,
  getExpenseByCategory,
  getTypeTotals,
  getBestWorst,
  getAverageVehicleNet,
  vehicleStatus,
  getCategoryTotal,
  getVehicleMonthlyData,
  getStatusCounts,
  getTopExpenseCategory,
  filterTransactions,
  todayInputValue,
  parseTransactionDate,
  dateInputFromDb,
};
