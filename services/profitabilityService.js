const db = require("../lib/db");
const { normalizeExpenseSlug } = require("../lib/expenseCategoryMap");
const { buildVehiclePlateMap, findVehicleByPlate } = require("../utils/plate");

const UNASSIGNED_KEY = "__unassigned__";
const OPERATIONAL_SLUGS = {
  fuel: "yakit",
  hgs: "hgs-ogs",
  maintenance: "bakim-onarim",
};

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function createBucket(vehicle) {
  if (!vehicle) {
    return {
      vehicleId: null,
      plate: "Atanmamış",
      type: "",
      income: 0,
      fuel: 0,
      hgs: 0,
      maintenance: 0,
      other: 0,
      totalExpense: 0,
      netProfit: 0,
      isUnassigned: true,
    };
  }
  return {
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    type: vehicle.type || "",
    income: 0,
    fuel: 0,
    hgs: 0,
    maintenance: 0,
    other: 0,
    totalExpense: 0,
    netProfit: 0,
    isUnassigned: false,
  };
}

function finalizeBucket(bucket) {
  bucket.totalExpense = bucket.fuel + bucket.hgs + bucket.maintenance + bucket.other;
  bucket.netProfit = bucket.income - bucket.totalExpense;
  return bucket;
}

function buildVehicleContext() {
  const vehicles = db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
  const plateMap = buildVehiclePlateMap(vehicles);
  const buckets = new Map();
  vehicles.forEach((v) => buckets.set(String(v.id), createBucket(v)));
  buckets.set(UNASSIGNED_KEY, createBucket(null));
  return { vehicles, plateMap, buckets };
}

function resolveBucketKey(buckets, plateMap, vehicleId, plateText) {
  if (vehicleId != null && String(vehicleId).trim() !== "") {
    const key = String(Number(vehicleId));
    if (buckets.has(key)) return key;
  }
  if (plateText) {
    const found = findVehicleByPlate(plateText, plateMap);
    if (found) return String(found.id);
  }
  return UNASSIGNED_KEY;
}

function addExpense(bucket, kind, amount) {
  const amt = safeAmount(amount);
  if (!amt) return;
  if (kind === "fuel") bucket.fuel += amt;
  else if (kind === "hgs") bucket.hgs += amt;
  else if (kind === "maintenance") bucket.maintenance += amt;
  else bucket.other += amt;
}

function classifyExpenseSlug(slug) {
  if (slug === OPERATIONAL_SLUGS.fuel) return "fuel";
  if (slug === OPERATIONAL_SLUGS.hgs) return "hgs";
  if (slug === OPERATIONAL_SLUGS.maintenance) return "maintenance";
  return "other";
}

function ingestTransactions(buckets, plateMap) {
  const rows = db
    .prepare(
      `SELECT t.vehicle_id, t.type, t.category, t.category_slug, t.amount, v.plate AS vehicle_plate
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id`
    )
    .all();

  rows.forEach((r) => {
    const key = resolveBucketKey(buckets, plateMap, r.vehicle_id, r.vehicle_plate);
    const bucket = buckets.get(key);
    const amt = safeAmount(r.amount);
    if (!amt) return;
    if (r.type === "income") {
      bucket.income += amt;
      return;
    }
    if (r.type !== "expense") return;
    const slug = normalizeExpenseSlug(r.category_slug || r.category);
    addExpense(bucket, classifyExpenseSlug(slug), amt);
  });
}

function ingestFuelRecords(buckets, plateMap) {
  const linked = new Set(
    db
      .prepare(
        `SELECT fuel_record_id FROM transactions WHERE fuel_record_id IS NOT NULL AND fuel_record_id != ''`
      )
      .all()
      .map((r) => Number(r.fuel_record_id))
  );

  const rows = db
    .prepare(
      `SELECT f.id, f.vehicle_id, f.plate_text,
              COALESCE(f.total_amount, f.total_cost, 0) AS amt,
              v.plate AS vehicle_plate
       FROM fuel_records f
       LEFT JOIN vehicles v ON v.id = f.vehicle_id`
    )
    .all();

  rows.forEach((r) => {
    if (linked.has(Number(r.id))) return;
    const key = resolveBucketKey(buckets, plateMap, r.vehicle_id, r.plate_text || r.vehicle_plate);
    addExpense(buckets.get(key), "fuel", r.amt);
  });
}

function ingestHgsTransactions(buckets, plateMap) {
  const rows = db
    .prepare(
      `SELECT vehicle_id, plate_normalized, amount
       FROM hgs_transactions
       WHERE transaction_type = 'passage'`
    )
    .all();

  rows.forEach((r) => {
    const key = resolveBucketKey(buckets, plateMap, r.vehicle_id, r.plate_normalized);
    addExpense(buckets.get(key), "hgs", r.amount);
  });
}

function ingestMaintenanceRecords(buckets, plateMap) {
  const rows = db
    .prepare(
      `SELECT m.vehicle_id, COALESCE(m.amount, m.cost, 0) AS amt, v.plate
       FROM maintenance_records m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id`
    )
    .all();

  rows.forEach((r) => {
    const key = resolveBucketKey(buckets, plateMap, r.vehicle_id, r.plate);
    addExpense(buckets.get(key), "maintenance", r.amt);
  });
}

function buildVehicleProfitability() {
  const { vehicles, plateMap, buckets } = buildVehicleContext();
  ingestTransactions(buckets, plateMap);
  ingestFuelRecords(buckets, plateMap);
  ingestHgsTransactions(buckets, plateMap);
  ingestMaintenanceRecords(buckets, plateMap);

  const rows = [];
  vehicles.forEach((v) => rows.push(finalizeBucket(buckets.get(String(v.id)))));
  rows.push(finalizeBucket(buckets.get(UNASSIGNED_KEY)));
  return rows;
}

function getVehicleProfitability() {
  return buildVehicleProfitability();
}

function getAssignedRows(rows) {
  return rows.filter((r) => !r.isUnassigned);
}

function getFleetProfitSummary(rows = null) {
  const data = rows || buildVehicleProfitability();
  const assigned = getAssignedRows(data);
  const totalIncome = data.reduce((s, r) => s + r.income, 0);
  const totalExpense = data.reduce((s, r) => s + r.totalExpense, 0);
  const totalNet = totalIncome - totalExpense;
  const avgProfitPerVehicle = assigned.length
    ? Math.round(assigned.reduce((s, r) => s + r.netProfit, 0) / assigned.length)
    : 0;

  return {
    totalIncome,
    totalExpense,
    totalNet,
    avgProfitPerVehicle,
    vehicleCount: assigned.length,
  };
}

function getTopProfitableVehicles(limit = 5, rows = null) {
  const data = rows || buildVehicleProfitability();
  return getAssignedRows(data)
    .filter((r) => r.income > 0 || r.totalExpense > 0)
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, limit);
}

function getMostProfitableVehicle(rows = null) {
  const top = getTopProfitableVehicles(1, rows);
  if (!top.length) return { plate: "—", netProfit: null, vehicleId: null };
  return {
    plate: top[0].plate,
    netProfit: top[0].netProfit,
    vehicleId: top[0].vehicleId,
    income: top[0].income,
    totalExpense: top[0].totalExpense,
  };
}

function hasSufficientData(rows = null) {
  const data = rows || buildVehicleProfitability();
  return data.some((r) => r.income > 0 || r.totalExpense > 0);
}

module.exports = {
  getVehicleProfitability,
  getFleetProfitSummary,
  getTopProfitableVehicles,
  getMostProfitableVehicle,
  hasSufficientData,
  UNASSIGNED_KEY,
};
