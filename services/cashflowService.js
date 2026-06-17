const db = require("../lib/db");
const reconciliationService = require("./reconciliationService");
const payrollObligationService = require("./payrollObligationService");
const employeeService = require("./employeeService");
const subcontractorService = require("./subcontractorService");
const documentService = require("./documentService");

const RECON_RECEIVABLE_STATUSES = new Set(["matched", "underpaid", "overpaid"]);
const DEFAULT_WINDOW_DAYS = 30;

const TR_MONTHS = [
  "",
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const OBLIGATION_GROUP_LABELS = {
  sgk: "SGK",
  muhtasar: "Muhtasar",
  personnel: "Personel Maaşları",
  subcontractor: "Taşeron Ödemeleri",
  document: "Evrak",
};

function safeAmount(v) {
  return Math.round(Number(v) || 0);
}

function normalizeRefDate(ref = new Date()) {
  const d = ref instanceof Date ? new Date(ref.getTime()) : new Date(ref);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function toDateKey(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 10);
}

function toLocalDateKey(date) {
  const d = normalizeRefDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const d = normalizeRefDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isWithinWindow(dateStr, ref, windowDays = DEFAULT_WINDOW_DAYS) {
  const key = toDateKey(dateStr);
  if (!key) return false;
  const start = toLocalDateKey(ref);
  const end = toLocalDateKey(addDays(ref, windowDays));
  return key >= start && key <= end;
}

function periodEndDate(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(String(period))) return null;
  const [y, m] = String(period).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function salaryDueDateFromPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(String(period))) return null;
  const [y, m] = String(period).split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-05`;
}

function paymentDueDateFromPeriod(period) {
  return salaryDueDateFromPeriod(period);
}

function formatTimelineDate(dateStr) {
  const key = toDateKey(dateStr);
  if (!key) return "—";
  const d = new Date(`${key}T12:00:00`);
  return `${d.getDate()} ${TR_MONTHS[d.getMonth() + 1]}`;
}

function receivableAmountFromRecon(row) {
  if (row.status === "underpaid") {
    return Math.max(0, safeAmount(row.expectedAmount) - safeAmount(row.actualAmount));
  }
  if (row.status === "matched" || row.status === "overpaid") {
    return safeAmount(row.expectedAmount);
  }
  return 0;
}

function buildReceivablesFromRecon(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return reconciliationService
    .buildReconciliationRows()
    .filter((row) => RECON_RECEIVABLE_STATUSES.has(row.status))
    .map((row) => {
      const amount = receivableAmountFromRecon(row);
      const expectedDate = periodEndDate(row.period) || null;
      return {
        source: "reconciliation",
        customer: row.company && row.company !== "—" ? row.company : "Hakediş",
        amount,
        status: reconciliationService.STATUS_LABELS[row.status] || row.status,
        statusKey: row.status,
        expectedDate,
        period: row.period,
        note: row.note,
      };
    })
    .filter((row) => row.amount > 0 && isWithinWindow(row.expectedDate, ref, windowDays));
}

function buildReceivablesFromIncome(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return db
    .prepare(
      `SELECT t.id, t.amount, t.note, t.date, t.category, v.plate
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.type = 'income'
         AND (t.hakedis_import_id IS NULL OR t.hakedis_import_id = 0)
         AND (t.income_dedup_key IS NULL OR t.income_dedup_key NOT LIKE 'hakedis:%')
         AND COALESCE(t.category_slug, '') != 'service'`
    )
    .all()
    .map((row) => {
      const expectedDate = toDateKey(row.date);
      const customer =
        reconciliationService.extractCompanyFromNote(row.note) ||
        String(row.category || "Gelir").trim() ||
        "Gelir";
      return {
        source: "income",
        customer,
        amount: safeAmount(row.amount),
        status: "Beklenen Gelir",
        statusKey: "income",
        expectedDate,
        note: row.note || "",
        plate: row.plate || null,
      };
    })
    .filter((row) => row.amount > 0 && isWithinWindow(row.expectedDate, ref, windowDays));
}

function getExpectedReceivables(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const recon = buildReceivablesFromRecon(ref, windowDays);
  const income = buildReceivablesFromIncome(ref, windowDays);
  const items = [...recon, ...income].sort((a, b) =>
    String(a.expectedDate || "").localeCompare(String(b.expectedDate || ""))
  );
  const total = items.reduce((s, r) => s + r.amount, 0);
  return { total, items };
}

function buildPayrollObligations(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return payrollObligationService
    .getOpenObligations(ref)
    .map((row) => {
      const group =
        row.obligation_type === "muhtasar"
          ? "muhtasar"
          : row.obligation_type === "sgk"
            ? "sgk"
            : "sgk";
      const dueDate = row.due_date || periodEndDate(row.period);
      return {
        source: "payroll",
        group,
        groupLabel: OBLIGATION_GROUP_LABELS[group],
        title: row.type_label || OBLIGATION_GROUP_LABELS[group],
        dueDate,
        amount: safeAmount(row.amount),
        status: payrollObligationService.STATUS_LABELS[row.status] || row.status,
        statusKey: row.status,
        period: row.period,
        countsTowardCash: true,
      };
    })
    .filter((row) => row.amount > 0 && isWithinWindow(row.dueDate, ref, windowDays));
}

function buildPersonnelObligations(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return db
    .prepare(
      `SELECT c.*, e.full_name, e.is_active
       FROM employee_monthly_costs c
       JOIN employees e ON e.id = c.employee_id
       WHERE e.is_active = 1`
    )
    .all()
    .map((row) => {
      const amount =
        safeAmount(row.salary_amount) +
        safeAmount(row.travel_amount) +
        safeAmount(row.washing_amount) +
        safeAmount(row.bonus_amount) -
        safeAmount(row.advance_amount) -
        safeAmount(row.deduction_amount);
      const dueDate = salaryDueDateFromPeriod(row.period);
      return {
        source: "personnel",
        group: "personnel",
        groupLabel: OBLIGATION_GROUP_LABELS.personnel,
        title: row.full_name,
        dueDate,
        amount,
        status: "Planlanan Maaş",
        statusKey: "planned",
        period: row.period,
        countsTowardCash: true,
      };
    })
    .filter((row) => row.amount > 0 && isWithinWindow(row.dueDate, ref, windowDays));
}

function buildSubcontractorObligations(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return db
    .prepare(
      `SELECT p.*, s.name AS subcontractor_name
       FROM subcontractor_payments p
       JOIN subcontractors s ON s.id = p.subcontractor_id
       ORDER BY COALESCE(p.payment_date, p.period, p.created_at) ASC, p.id ASC`
    )
    .all()
    .map((row) => {
      const dueDate = row.payment_date
        ? toDateKey(row.payment_date)
        : paymentDueDateFromPeriod(row.period);
      return {
        source: "subcontractor",
        group: "subcontractor",
        groupLabel: OBLIGATION_GROUP_LABELS.subcontractor,
        title: row.subcontractor_name || "Taşeron",
        dueDate,
        amount: safeAmount(row.amount),
        status: row.payment_date ? "Planlı Ödeme" : "Dönem Ödemesi",
        statusKey: "planned",
        period: row.period,
        countsTowardCash: true,
      };
    })
    .filter((row) => row.amount > 0 && isWithinWindow(row.dueDate, ref, windowDays));
}

function buildDocumentObligations(ref, windowDays = DEFAULT_WINDOW_DAYS) {
  return documentService
    .listUpcoming(ref, 100)
    .filter((row) => row.expiry_date && isWithinWindow(row.expiry_date, ref, windowDays))
    .map((row) => ({
      source: "document",
      group: "document",
      groupLabel: OBLIGATION_GROUP_LABELS.document,
      title: `${row.plate || "—"} · ${row.title || row.type_label}`,
      dueDate: row.expiry_date,
      amount: 0,
      status: row.status_label || row.status,
      statusKey: row.status,
      countsTowardCash: false,
      infoOnly: true,
    }));
}

function getUpcomingObligations(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const items = [
    ...buildPayrollObligations(ref, windowDays),
    ...buildPersonnelObligations(ref, windowDays),
    ...buildSubcontractorObligations(ref, windowDays),
    ...buildDocumentObligations(ref, windowDays),
  ].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

  const groups = {
    sgk: [],
    muhtasar: [],
    personnel: [],
    subcontractor: [],
    document: [],
  };
  items.forEach((item) => {
    if (groups[item.group]) groups[item.group].push(item);
  });

  const total = items
    .filter((item) => item.countsTowardCash !== false)
    .reduce((s, item) => s + item.amount, 0);

  return { total, groups, items };
}

function getCashflowSummary(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const receivables = getExpectedReceivables(ref, windowDays);
  const obligations = getUpcomingObligations(ref, windowDays);
  const netExpectedCash = receivables.total - obligations.total;

  return {
    totalExpectedReceivables: receivables.total,
    totalUpcomingObligations: obligations.total,
    netExpectedCash,
    receivableCount: receivables.items.length,
    obligationCount: obligations.items.filter((i) => i.countsTowardCash !== false).length,
    windowDays,
    refDate: toLocalDateKey(ref),
  };
}

function getCashflowTimeline(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const receivables = getExpectedReceivables(ref, windowDays);
  const obligations = getUpcomingObligations(ref, windowDays);
  const events = [];

  receivables.items.forEach((row) => {
    events.push({
      date: row.expectedDate,
      dateLabel: formatTimelineDate(row.expectedDate),
      direction: "in",
      amount: row.amount,
      label: "Tahsilat",
      detail: row.customer,
      source: row.source,
    });
  });

  obligations.items.forEach((row) => {
    events.push({
      date: row.dueDate,
      dateLabel: formatTimelineDate(row.dueDate),
      direction: row.infoOnly ? "info" : "out",
      amount: row.amount,
      label: row.groupLabel || row.title,
      detail: row.title,
      source: row.source,
      infoOnly: !!row.infoOnly,
    });
  });

  return events.sort((a, b) => {
    const d = String(a.date || "").localeCompare(String(b.date || ""));
    if (d !== 0) return d;
    if (a.direction === b.direction) return 0;
    if (a.direction === "in") return -1;
    return 1;
  });
}

function getCashflowDashboardCard(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const summary = getCashflowSummary(ref, windowDays);
  return {
    netExpectedCash: summary.netExpectedCash,
    totalExpectedReceivables: summary.totalExpectedReceivables,
    totalUpcomingObligations: summary.totalUpcomingObligations,
    tone: summary.netExpectedCash > 0 ? "positive" : summary.netExpectedCash < 0 ? "negative" : "neutral",
  };
}

function sumItemsInNearTerm(items, ref, days = 7, dateKey = "expectedDate", amountKey = "amount") {
  return items
    .filter((item) => isWithinWindow(item[dateKey], ref, days))
    .reduce((s, item) => s + safeAmount(item[amountKey]), 0);
}

function detectCashflowRiskAlerts(ref = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const summary = getCashflowSummary(ref, windowDays);
  const receivables = getExpectedReceivables(ref, windowDays);
  const obligations = getUpcomingObligations(ref, windowDays);
  const payableItems = obligations.items.filter((item) => item.countsTowardCash !== false);
  const nearReceivables = sumItemsInNearTerm(receivables.items, ref, 7, "expectedDate", "amount");
  const nearObligations = sumItemsInNearTerm(payableItems, ref, 7, "dueDate", "amount");
  const alerts = [];

  if (summary.netExpectedCash < 0) {
    alerts.push({
      severity: "critical",
      type: "CASHFLOW_RISK",
      title: "Nakit Açığı Riski",
      plate: "—",
      vehicleId: null,
      message: `Önümüzdeki ${windowDays} günde beklenen nakit ${Math.abs(summary.netExpectedCash).toLocaleString("tr-TR")} TL açık veriyor.`,
      amount: Math.abs(summary.netExpectedCash),
    });
  } else if (nearObligations > nearReceivables) {
    alerts.push({
      severity: "warning",
      type: "CASHFLOW_RISK",
      title: "Nakit Baskısı",
      plate: "—",
      vehicleId: null,
      message: `Yakın vadeli giderler (${nearObligations.toLocaleString("tr-TR")} TL) kısa vadeli tahsilatın (${nearReceivables.toLocaleString("tr-TR")} TL) üzerinde.`,
      amount: nearObligations - nearReceivables,
    });
  } else if (summary.totalUpcomingObligations > summary.totalExpectedReceivables) {
    alerts.push({
      severity: "warning",
      type: "CASHFLOW_RISK",
      title: "Nakit Baskısı",
      plate: "—",
      vehicleId: null,
      message: `Yaklaşan giderler (${summary.totalUpcomingObligations.toLocaleString("tr-TR")} TL) beklenen tahsilatın (${summary.totalExpectedReceivables.toLocaleString("tr-TR")} TL) üzerinde.`,
      amount: summary.totalUpcomingObligations - summary.totalExpectedReceivables,
    });
  }

  return alerts;
}

module.exports = {
  DEFAULT_WINDOW_DAYS,
  TR_MONTHS,
  OBLIGATION_GROUP_LABELS,
  safeAmount,
  formatTimelineDate,
  salaryDueDateFromPeriod,
  getExpectedReceivables,
  getUpcomingObligations,
  getCashflowSummary,
  getCashflowTimeline,
  getCashflowDashboardCard,
  detectCashflowRiskAlerts,
};
