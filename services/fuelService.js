const db = require("../lib/db");
const { parseMoneyInputRequired } = require("../utils/money");

function normalizeFuel(row) {
  if (!row) return null;
  const liter = Number(row.liter ?? row.liters ?? 0);
  const total_amount = Number(row.total_amount ?? row.total_cost ?? 0);
  const fuel_date = row.fuel_date || String(row.date || "").slice(0, 10);
  const price_per_liter =
    row.price_per_liter != null
      ? Number(row.price_per_liter)
      : liter > 0
        ? Math.round((total_amount / liter) * 100) / 100
        : 0;
  return { ...row, liter, liters: liter, total_amount, total_cost: total_amount, fuel_date, price_per_liter };
}

function listAll(filters = {}) {
  let sql = `SELECT f.*, v.plate,
    COALESCE(v.plate, f.plate_text) AS display_plate
    FROM fuel_records f
    LEFT JOIN vehicles v ON v.id = f.vehicle_id WHERE 1=1`;
  const params = [];
  if (filters.vehicle_id) {
    sql += " AND f.vehicle_id = ?";
    params.push(filters.vehicle_id);
  }
  if (filters.unmatched === "1") {
    sql += " AND f.vehicle_id IS NULL";
  }
  if (filters.date_from) {
    sql += " AND COALESCE(f.fuel_date, substr(f.date,1,10)) >= ?";
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    sql += " AND COALESCE(f.fuel_date, substr(f.date,1,10)) <= ?";
    params.push(filters.date_to);
  }
  sql += " ORDER BY COALESCE(f.fuel_date, f.date) DESC, f.id DESC";
  const rows = db.prepare(sql).all(...params).map(normalizeFuel);
  return rows.map((row, i, arr) => withConsumption(row, i, arr));
}

function listByVehicle(vehicleId, limit = 50) {
  const rows = listAll({ vehicle_id: vehicleId });
  return rows.slice(0, limit);
}

function withConsumption(row, index, arr) {
  const prev = arr[index + 1];
  let km_per_liter = null;
  let cost_per_km = null;
  if (prev && row.km != null && prev.km != null && row.liter > 0) {
    const dist = Number(row.km) - Number(prev.km);
    if (dist > 0) {
      km_per_liter = Math.round((dist / row.liter) * 10) / 10;
      cost_per_km = Math.round((row.total_amount / dist) * 100) / 100;
    }
  }
  return { ...row, km_per_liter, cost_per_km };
}

function vehicleStats(vehicleId) {
  const rows = listByVehicle(vehicleId, 200);
  const withKm = rows.filter((r) => r.km_per_liter != null);
  const avgKmPerLiter =
    withKm.length > 0
      ? Math.round((withKm.reduce((s, r) => s + r.km_per_liter, 0) / withKm.length) * 10) / 10
      : null;
  const totalLiters = Math.round(rows.reduce((s, r) => s + r.liter, 0) * 100) / 100;
  const totalCost = rows.reduce((s, r) => s + r.total_amount, 0);
  const avgPrice =
    totalLiters > 0 ? Math.round((totalCost / totalLiters) * 100) / 100 : null;
  const withCostKm = rows.filter((r) => r.cost_per_km != null);
  const avgCostPerKm =
    withCostKm.length > 0
      ? Math.round((withCostKm.reduce((s, r) => s + r.cost_per_km, 0) / withCostKm.length) * 100) / 100
      : null;

  return {
    records: rows.length,
    totalLiters,
    totalCost,
    avgPrice,
    avgKmPerLiter,
    avgCostPerKm,
    recent: rows.slice(0, 10),
  };
}

function getFleetFuelLast30Days() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const date_from = from.toISOString().slice(0, 10);
  const rows = listAll({ date_from });
  const totalLiters = Math.round(rows.reduce((s, r) => s + r.liter, 0) * 100) / 100;
  const totalCost = rows.reduce((s, r) => s + r.total_amount, 0);
  return { totalLiters, totalCost, count: rows.length };
}

function getTopFuelVehicle() {
  const rows = db
    .prepare(
      `SELECT vehicle_id, SUM(COALESCE(total_amount, total_cost, 0)) as total
       FROM fuel_records GROUP BY vehicle_id ORDER BY total DESC LIMIT 1`
    )
    .get();
  if (!rows || !rows.vehicle_id) return null;
  const v = db.prepare("SELECT plate FROM vehicles WHERE id = ?").get(rows.vehicle_id);
  return { plate: v?.plate || "—", total: rows.total, vehicle_id: rows.vehicle_id };
}

function getById(id) {
  const row = db
    .prepare(
      `SELECT f.*, v.plate FROM fuel_records f
       LEFT JOIN vehicles v ON v.id = f.vehicle_id WHERE f.id = ?`
    )
    .get(id);
  return row ? normalizeFuel(row) : null;
}

function resolveFuelTotal(data, liter, price) {
  const raw = data.total_amount ?? data.total_cost;
  if (raw != null && String(raw).trim() !== "") {
    return parseMoneyInputRequired(raw);
  }
  if (liter > 0 && price > 0) return Math.round(liter * price);
  throw new Error("Tutar geçerli değil");
}

function create(data) {
  const liter = Number(data.liter ?? data.liters);
  if (!Number.isFinite(liter) || liter <= 0) throw new Error("Geçerli bir litre değeri girin.");
  const price = Number(data.price_per_liter || 0);
  const total_amount = resolveFuelTotal(data, liter, price);
  const fuel_date =
    data.fuel_date || data.date || new Date().toISOString().slice(0, 10);

  const info = db
    .prepare(
      `INSERT INTO fuel_records (
        vehicle_id, liter, price_per_liter, total_amount, km, station, note, fuel_date,
        liters, total_cost, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.vehicle_id,
      liter,
      price,
      total_amount,
      data.km != null && data.km !== "" ? Number(data.km) : null,
      data.station || "",
      data.note || "",
      fuel_date,
      liter,
      total_amount,
      fuel_date + " 12:00:00"
    );
  return getById(info.lastInsertRowid);
}

function update(id, data) {
  const cur = getById(id);
  if (!cur) return null;
  const liter = Number(data.liter ?? data.liters ?? cur.liter);
  const price = Number(data.price_per_liter ?? cur.price_per_liter ?? 0);
  const total_amount = resolveFuelTotal(
    { total_amount: data.total_amount ?? data.total_cost ?? cur.total_amount },
    liter,
    price
  );
  const fuel_date = data.fuel_date || data.date || cur.fuel_date;

  const vehicleId =
    data.vehicle_id !== undefined && data.vehicle_id !== ""
      ? Number(data.vehicle_id) || null
      : cur.vehicle_id;

  db.prepare(
    `UPDATE fuel_records SET
      vehicle_id=?, liter=?, price_per_liter=?, total_amount=?, km=?, station=?, note=?, fuel_date=?,
      liters=?, total_cost=?, date=?
     WHERE id=?`
  ).run(
    vehicleId,
    liter,
    price,
    total_amount,
    data.km != null && data.km !== "" ? Number(data.km) : cur.km,
    data.station ?? cur.station,
    data.note ?? cur.note,
    fuel_date,
    liter,
    total_amount,
    fuel_date + " 12:00:00",
    id
  );
  return getById(id);
}

const auditService = require("./auditService");

function remove(id) {
  const old = getById(id);
  db.prepare("DELETE FROM transactions WHERE fuel_record_id = ?").run(id);
  db.prepare("DELETE FROM fuel_records WHERE id = ?").run(id);
  if (old) {
    auditService.log("fuel_delete", "fuel_record", id, old, null, "Yakıt kaydı silindi");
  }
}

function getFuelPageAnalytics() {
  const last30 = getFleetFuelLast30Days();
  const top = getTopFuelVehicle();
  const avgPrice =
    last30.totalLiters > 0
      ? Math.round((last30.totalCost / last30.totalLiters) * 100) / 100
      : null;
  const byVehicle = db
    .prepare(
      `SELECT COALESCE(v.plate, f.plate_text, '—') AS plate,
              f.vehicle_id,
              SUM(COALESCE(f.liter, f.liters, 0)) AS liters,
              SUM(COALESCE(f.total_amount, f.total_cost, 0)) AS total
       FROM fuel_records f
       LEFT JOIN vehicles v ON v.id = f.vehicle_id
       WHERE COALESCE(f.fuel_date, substr(f.date,1,10)) >= date('now', '-30 days')
       GROUP BY COALESCE(f.vehicle_id, f.plate_text)
       ORDER BY total DESC
       LIMIT 12`
    )
    .all();
  const unmatchedCount = db
    .prepare("SELECT COUNT(*) AS c FROM fuel_records WHERE vehicle_id IS NULL")
    .get().c;
  return { last30, top, avgPrice, byVehicle, unmatchedCount };
}

function exportCsv(filters = {}) {
  const rows = listAll(filters);
  const header = [
    "Plaka",
    "Yakıt Tipi",
    "Litre",
    "Birim Fiyat",
    "Toplam",
    "KM",
    "İstasyon",
    "Şehir",
    "UTTS",
    "İşlem No",
    "Tarih",
    "Kaynak",
    "Eşleşme",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.display_plate || r.plate || r.plate_text || "",
        r.fuel_type || "",
        r.liter,
        r.price_per_liter || "",
        r.total_amount,
        r.km ?? "",
        r.station || "",
        r.city || "",
        r.utts || "",
        r.transaction_no || "",
        r.fuel_date || "",
        r.source_file || "manuel",
        r.vehicle_id ? "eşleşti" : "eşleşmedi",
      ]
        .map(esc)
        .join(",")
    ),
  ];
  return "\uFEFF" + lines.join("\n");
}

function syncExpenseForRecord(fuelId) {
  const row = getById(fuelId);
  if (!row || !row.vehicle_id) return false;
  const existing = db
    .prepare("SELECT id FROM transactions WHERE fuel_record_id = ?")
    .get(fuelId);
  if (existing) return false;
  const note = [
    row.station || "Yakıt",
    row.fuel_type,
    `${row.liter} litre`,
    row.utts ? `UTTS:${row.utts}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  db.prepare(
    `INSERT INTO transactions (vehicle_id, type, category, category_slug, amount, note, date, fuel_record_id)
     VALUES (?, 'expense', 'Yakıt', 'yakit', ?, ?, ?, ?)`
  ).run(
    row.vehicle_id,
    row.total_amount,
    note.slice(0, 500),
    `${row.fuel_date} 12:00:00`,
    fuelId
  );
  return true;
}

module.exports = {
  listAll,
  listByVehicle,
  vehicleStats,
  getFleetFuelLast30Days,
  getTopFuelVehicle,
  getFuelPageAnalytics,
  exportCsv,
  syncExpenseForRecord,
  getById,
  create,
  update,
  remove,
  normalizeFuel,
};
