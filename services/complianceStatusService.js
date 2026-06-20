const db = require("../lib/db");
const documentService = require("./documentService");

const STATUS_SCORES = {
  active: 100,
  warning: 75,
  critical: 40,
  expired: 0,
};

const STATUS_RISK = {
  active: "normal",
  warning: "warning",
  critical: "critical",
  expired: "expired",
};

const STATUS_SEVERITY = {
  expired: 0,
  critical: 1,
  warning: 2,
  active: 3,
};

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function normalizeExpirationDate(expirationDate) {
  if (!expirationDate) return null;
  const s = String(expirationDate).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function calculateDaysRemaining(expirationDate, referenceDate = new Date()) {
  const expiry = normalizeExpirationDate(expirationDate);
  if (!expiry) return null;

  const exp = new Date(`${expiry}T12:00:00`);
  const today = normalizeRefDate(referenceDate);
  today.setHours(12, 0, 0, 0);

  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil((exp - today) / 86400000);
}

function calculateComplianceStatus(expirationDate, referenceDate = new Date()) {
  const days = calculateDaysRemaining(expirationDate, referenceDate);
  if (days == null) return null;
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 60) return "warning";
  return "active";
}

function riskLevelForStatus(status) {
  if (!status) return null;
  return STATUS_RISK[status] || null;
}

function scoreForStatus(status) {
  if (!status || !Object.prototype.hasOwnProperty.call(STATUS_SCORES, status)) {
    return null;
  }
  return STATUS_SCORES[status];
}

function calculateComplianceScore(records, referenceDate = new Date()) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const scores = records
    .map((record) => {
      const expiry = record?.expiry_date ?? record?.expirationDate ?? null;
      const status = calculateComplianceStatus(expiry, referenceDate);
      return scoreForStatus(status);
    })
    .filter((score) => score != null);

  if (!scores.length) return null;

  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

function enrichRecord(row, referenceDate = new Date()) {
  const days_remaining = calculateDaysRemaining(row.expiry_date, referenceDate);
  const status = calculateComplianceStatus(row.expiry_date, referenceDate);
  const risk_level = riskLevelForStatus(status);

  return {
    ...row,
    days_remaining,
    status: status || "unknown",
    risk_level: risk_level || "unknown",
  };
}

function summarizeRecords(records) {
  const summary = {
    active: 0,
    warning: 0,
    critical: 0,
    expired: 0,
  };

  for (const record of records) {
    if (Object.prototype.hasOwnProperty.call(summary, record.status)) {
      summary[record.status] += 1;
    }
  }

  return summary;
}

function resolveVehicleStatus(records, referenceDate = new Date()) {
  const dated = (records || []).filter((row) => normalizeExpirationDate(row.expiry_date));
  if (!dated.length) return "unknown";

  let worst = "active";
  for (const row of dated) {
    const status = calculateComplianceStatus(row.expiry_date, referenceDate);
    if (!status) continue;
    if (STATUS_SEVERITY[status] < STATUS_SEVERITY[worst]) {
      worst = status;
    }
  }

  return worst;
}

function buildVehicleScores(records, referenceDate = new Date()) {
  const vehicles = db.prepare("SELECT id, plate FROM vehicles ORDER BY plate ASC").all();
  const grouped = new Map();

  for (const vehicle of vehicles) {
    grouped.set(vehicle.id, []);
  }

  for (const record of records) {
    if (!grouped.has(record.vehicle_id)) {
      grouped.set(record.vehicle_id, []);
    }
    grouped.get(record.vehicle_id).push(record);
  }

  return vehicles.map((vehicle) => {
    const vehicleRecords = grouped.get(vehicle.id) || [];
    const datedRecords = vehicleRecords.filter((row) => normalizeExpirationDate(row.expiry_date));

    return {
      vehicle_id: vehicle.id,
      plate: vehicle.plate,
      score: calculateComplianceScore(datedRecords, referenceDate),
      status: resolveVehicleStatus(vehicleRecords, referenceDate),
    };
  });
}

function buildStatusReport(referenceDate = new Date()) {
  const ref = normalizeRefDate(referenceDate);
  const baseRows = documentService.listAll({}, ref);
  const records = baseRows.map((row) => enrichRecord(row, ref));

  return {
    summary: summarizeRecords(records),
    records,
    vehicle_scores: buildVehicleScores(records, ref),
  };
}

module.exports = {
  STATUS_SCORES,
  STATUS_RISK,
  calculateDaysRemaining,
  calculateComplianceStatus,
  calculateComplianceScore,
  riskLevelForStatus,
  scoreForStatus,
  enrichRecord,
  summarizeRecords,
  buildVehicleScores,
  buildStatusReport,
};
