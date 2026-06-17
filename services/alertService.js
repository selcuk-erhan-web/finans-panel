const db = require("../lib/db");
const profitService = require("./profitService");
const { money } = require("../lib/finance");

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const SLUG = { fuel: "yakit", hgs: "hgs-ogs" };

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function monthKeyFromDate(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7);
}

function currentMonthKey(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKeys(count = 3, ref = new Date()) {
  const keys = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const s = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (s !== 0) return s;
    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function buildLinkedFuelIds() {
  return new Set(
    db
      .prepare(
        `SELECT fuel_record_id FROM transactions
         WHERE fuel_record_id IS NOT NULL AND fuel_record_id != ''`
      )
      .all()
      .map((r) => Number(r.fuel_record_id))
  );
}

function buildFuelMonthlyMap() {
  const map = new Map();
  const linked = buildLinkedFuelIds();

  db.prepare(
    `SELECT id, vehicle_id,
            COALESCE(total_amount, total_cost, 0) AS amt,
            substr(COALESCE(fuel_date, date), 1, 7) AS mk
     FROM fuel_records WHERE vehicle_id IS NOT NULL`
  )
    .all()
    .forEach((r) => {
      if (!r.mk || linked.has(Number(r.id))) return;
      const key = `${r.vehicle_id}|${r.mk}`;
      map.set(key, (map.get(key) || 0) + safeAmount(r.amt));
    });

  db.prepare(
    `SELECT vehicle_id, amount,
            substr(date, 1, 7) AS mk
     FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL
       AND category_slug = ?
       AND (fuel_record_id IS NULL OR fuel_record_id = '')`
  )
    .all(SLUG.fuel)
    .forEach((r) => {
      if (!r.mk) return;
      const key = `${r.vehicle_id}|${r.mk}`;
      map.set(key, (map.get(key) || 0) + safeAmount(r.amount));
    });

  return map;
}

function buildHgsMonthlyMap() {
  const map = new Map();
  db.prepare(
    `SELECT vehicle_id, amount, substr(date, 1, 7) AS mk
     FROM transactions
     WHERE type = 'expense' AND vehicle_id IS NOT NULL AND category_slug = ?`
  )
    .all(SLUG.hgs)
    .forEach((r) => {
      if (!r.mk) return;
      const key = `${r.vehicle_id}|${r.mk}`;
      map.set(key, (map.get(key) || 0) + safeAmount(r.amount));
    });
  return map;
}

function monthlyAmount(map, vehicleId, monthKey) {
  return map.get(`${vehicleId}|${monthKey}`) || 0;
}

function averagePreviousMonths(map, vehicleId, prevKeys) {
  if (!prevKeys.length) return 0;
  const sum = prevKeys.reduce((s, mk) => s + monthlyAmount(map, vehicleId, mk), 0);
  return sum / prevKeys.length;
}

function deltaPercent(current, average) {
  if (!average || average <= 0) return null;
  return Math.round(((current - average) / average) * 100);
}

function detectLossVehicleAlerts() {
  const alerts = [];
  profitService.getVehicleProfitRows().forEach((row) => {
    if (row.netProfit >= 0) return;
    alerts.push({
      severity: "critical",
      type: "LOSS_VEHICLE",
      title: "Zarar Eden Araç",
      plate: row.plate,
      vehicleId: row.vehicleId,
      message: `Net kâr ${money(row.netProfit)} seviyesinde.`,
      amount: row.netProfit,
    });
  });
  return alerts;
}

function detectFuelAnomalyAlerts(ref = new Date()) {
  const alerts = [];
  const map = buildFuelMonthlyMap();
  const current = currentMonthKey(ref);
  const prev = previousMonthKeys(3, ref);
  const vehicles = db.prepare("SELECT id, plate FROM vehicles ORDER BY plate ASC").all();

  vehicles.forEach((v) => {
    const currentAmt = monthlyAmount(map, v.id, current);
    const avg = averagePreviousMonths(map, v.id, prev);
    if (currentAmt <= 0 || avg <= 0) return;
    const delta = deltaPercent(currentAmt, avg);
    if (delta == null || delta < 30) return;
    alerts.push({
      severity: "warning",
      type: "FUEL_ANOMALY",
      title: "Yakıt Anomalisi",
      plate: v.plate,
      vehicleId: v.id,
      message: `Bu ay yakıt gideri son 3 ay ortalamasının %${delta} üzerinde.`,
      deltaPercent: delta,
      amount: currentAmt,
    });
  });
  return alerts;
}

function detectHgsAnomalyAlerts(ref = new Date()) {
  const alerts = [];
  const map = buildHgsMonthlyMap();
  const current = currentMonthKey(ref);
  const prev = previousMonthKeys(3, ref);
  const vehicles = db.prepare("SELECT id, plate FROM vehicles ORDER BY plate ASC").all();

  vehicles.forEach((v) => {
    const currentAmt = monthlyAmount(map, v.id, current);
    const avg = averagePreviousMonths(map, v.id, prev);
    if (currentAmt <= 0 || avg <= 0) return;
    const delta = deltaPercent(currentAmt, avg);
    if (delta == null || delta < 50) return;
    alerts.push({
      severity: "warning",
      type: "HGS_ANOMALY",
      title: "HGS Anomalisi",
      plate: v.plate,
      vehicleId: v.id,
      message: `Bu ay HGS/OGS gideri son 3 ay ortalamasının %${delta} üzerinde.`,
      deltaPercent: delta,
      amount: currentAmt,
    });
  });
  return alerts;
}

function detectMaintenanceRiskAlerts() {
  const alerts = [];
  const rows = db
    .prepare(
      `SELECT m.vehicle_id, v.plate, COUNT(*) AS cnt
       FROM maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE COALESCE(m.service_date, substr(m.created_at, 1, 10)) >= date('now', '-90 days')
       GROUP BY m.vehicle_id
       HAVING cnt >= 4`
    )
    .all();

  rows.forEach((r) => {
    const count = Number(r.cnt) || 0;
    alerts.push({
      severity: "info",
      type: "MAINTENANCE_RISK",
      title: "Bakım Riski",
      plate: r.plate,
      vehicleId: r.vehicle_id,
      message: `Son 90 günde ${count} bakım kaydı var.`,
      count,
    });
  });
  return alerts;
}

function getCorporateAlerts(options = {}) {
  const ref = options.refDate ? new Date(options.refDate) : new Date();
  const alerts = sortAlerts([
    ...detectLossVehicleAlerts(),
    ...detectFuelAnomalyAlerts(ref),
    ...detectHgsAnomalyAlerts(ref),
    ...detectMaintenanceRiskAlerts(),
  ]);
  return alerts;
}

function getAlertSummary(alerts = null) {
  const list = alerts || getCorporateAlerts();
  return {
    total: list.length,
    critical: list.filter((a) => a.severity === "critical").length,
    warning: list.filter((a) => a.severity === "warning").length,
    info: list.filter((a) => a.severity === "info").length,
    preview: list.slice(0, 3),
    byType: {
      LOSS_VEHICLE: list.filter((a) => a.type === "LOSS_VEHICLE"),
      FUEL_ANOMALY: list.filter((a) => a.type === "FUEL_ANOMALY"),
      HGS_ANOMALY: list.filter((a) => a.type === "HGS_ANOMALY"),
      MAINTENANCE_RISK: list.filter((a) => a.type === "MAINTENANCE_RISK"),
    },
  };
}

module.exports = {
  getCorporateAlerts,
  getAlertSummary,
  sortAlerts,
  detectLossVehicleAlerts,
  detectFuelAnomalyAlerts,
  detectHgsAnomalyAlerts,
  detectMaintenanceRiskAlerts,
  SEVERITY_ORDER,
};
