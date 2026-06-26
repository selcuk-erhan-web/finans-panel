const { daysUntilExpiry } = require("../../services/documentService");
const { buildPredictiveMaintenanceIntelligence } = require("./predictiveMaintenanceIntelligence");
const { buildVehicleActionIntelligence } = require("./vehicleActionIntelligence");

const COMPLIANCE_LABELS = {
  inspection: "Muayene",
  traffic_insurance: "Trafik Sigortası",
  casco: "Kasko",
  seat_insurance: "Koltuk Ferdi Kaza",
};

function daysUntilDate(dateStr, ref = new Date()) {
  if (!dateStr) return null;
  const target = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  const base = new Date(`${ref.toISOString().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

function severityBucket(days, status) {
  if (status === "overdue" || status === "expired" || days < 0) return "critical";
  if (days <= 7) return "critical";
  if (days <= 30) return "high";
  if (days <= 60) return "medium";
  if (days <= 90) return "normal";
  return "later";
}

function highestExpenseCategory(profit) {
  const rows = [
    ["yakıt", profit.fuel || 0],
    ["HGS / OGS", profit.hgs || 0],
    ["bakım", profit.maintenance || 0],
    ["personel", profit.personnel || 0],
    ["taşeron", profit.subcontractor || 0],
    ["diğer", profit.other || 0],
  ];
  const top = rows.sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] <= 0) return null;
  return top[0];
}

function resolveProfitabilityNet(bundle) {
  const profit = bundle.profit || {};
  const monthly = bundle.monthly || {};
  const incomeSeries = monthly.incomeData || [];
  const expenseSeries = monthly.expenseData || [];
  const hasMonthly = incomeSeries.length > 0;
  const lastIdx = hasMonthly ? incomeSeries.length - 1 : 0;
  const monthIncome = hasMonthly ? Number(incomeSeries[lastIdx] || 0) : 0;
  const monthExpense = hasMonthly ? Number(expenseSeries[lastIdx] || 0) : 0;
  const useMonthly = hasMonthly && (monthIncome > 0 || monthExpense > 0);
  const incomeAmount = useMonthly ? monthIncome : Number(profit.income || 0);
  const expenseAmount = useMonthly ? monthExpense : Number(profit.totalExpense || 0);
  let netAmount = useMonthly
    ? monthIncome - monthExpense
    : Number(profit.netProfit ?? bundle.summary?.net ?? 0);
  if (incomeAmount === 0 && expenseAmount > 0) netAmount = -expenseAmount;
  return netAmount;
}

function collectPredictedEvents(bundle, complianceDocs) {
  const events = [];

  for (const item of bundle.maintenanceSchedule?.items || []) {
    const days =
      item.days_remaining != null
        ? Number(item.days_remaining)
        : daysUntilDate(item.next_due_date);
    if (days == null || days > 90) continue;
    events.push({
      type: "service",
      category: "Bakım",
      label: item.maintenance_type_label || "Bakım planı",
      days,
      severity: severityBucket(days, item.status),
      date: item.next_due_date || null,
    });
  }

  for (const record of bundle.upcomingMaintenance || []) {
    const days =
      record.days_remaining != null
        ? Number(record.days_remaining)
        : daysUntilDate(record.next_service_date || record.due_date);
    if (days == null || days > 90) continue;
    events.push({
      type: "maintenance",
      category: "Bakım",
      label: record.title || record.type_label || "Planlı bakım",
      days,
      severity: severityBucket(days, record.status),
      date: record.next_service_date || record.due_date || null,
    });
  }

  for (const doc of complianceDocs || []) {
    if (!doc.expiry_date) continue;
    const days = doc.daysLeft != null ? Number(doc.daysLeft) : daysUntilExpiry(doc.expiry_date);
    if (days == null || days > 90) continue;
    const docType = doc.document_type;
    const eventType =
      docType === "inspection" ? "inspection" : docType.includes("insurance") ? "insurance" : "document";
    events.push({
      type: eventType,
      category: "Uygunluk",
      label: COMPLIANCE_LABELS[docType] || doc.title || "Evrak",
      days,
      severity: severityBucket(days, doc.status),
      date: doc.expiry_date,
    });
  }

  const seen = new Set();
  return events
    .filter((event) => {
      const key = `${event.type}:${event.label}:${event.days}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.days - b.days);
}

function buildMaintenanceForecast(bundle, maintIntel, events) {
  const overdue = (bundle.upcomingMaintenance || []).some((row) => row.status === "overdue");
  if (overdue) {
    return {
      text: "Gecikmiş bakım planı kritik seviyede.",
      tone: "danger",
      level: "CRITICAL",
    };
  }

  const nextMaint = events.find((event) => event.category === "Bakım");
  if (nextMaint) {
    if (nextMaint.days <= 7) {
      return {
        text: `Bakım planı ${nextMaint.days} gün içinde kritik seviyeye ulaşacak.`,
        tone: "danger",
        level: "CRITICAL",
      };
    }
    if (nextMaint.days <= 30) {
      return {
        text: `Bakım planı ${nextMaint.days} gün içinde kritik seviyeye ulaşacak.`,
        tone: "warning",
        level: "HIGH",
      };
    }
    if (nextMaint.days <= 60) {
      return {
        text: `Planlı bakım ${nextMaint.days} gün içinde yaklaşıyor.`,
        tone: "warning",
        level: "MEDIUM",
      };
    }
    return {
      text: `Sonraki bakım ${nextMaint.days} gün içinde planlanmalı.`,
      tone: "info",
      level: "NORMAL",
    };
  }

  if (maintIntel.score < 45) {
    return {
      text: "Bakım riski yükseliyor — plan gözden geçirilmeli.",
      tone: "danger",
      level: "HIGH",
    };
  }

  return {
    text: maintIntel.nextReviewLabel || "Rutin bakım takibi yeterli.",
    tone: maintIntel.tone || "success",
    level: "LOW",
  };
}

function buildComplianceForecast(complianceDocs, events) {
  if (!complianceDocs.length) {
    return {
      text: "Uygunluk kayıtları eksik — evrak tamamlanmalı.",
      tone: "danger",
      level: "HIGH",
    };
  }

  const expired = complianceDocs.some((doc) => doc.status === "expired");
  if (expired) {
    return {
      text: "Süresi geçmiş evrak operasyonu durdurabilir.",
      tone: "danger",
      level: "CRITICAL",
    };
  }

  const nextCompliance = events.find((event) => event.category === "Uygunluk" && event.date);
  if (nextCompliance) {
    if (nextCompliance.days <= 7) {
      return {
        text: `${nextCompliance.label} ${nextCompliance.days} gün içinde sona erecek.`,
        tone: "danger",
        level: "CRITICAL",
      };
    }
    if (nextCompliance.days <= 30) {
      return {
        text: `${nextCompliance.label} ${nextCompliance.days} gün içinde sona erecek.`,
        tone: "warning",
        level: "HIGH",
      };
    }
    if (nextCompliance.days <= 60) {
      return {
        text: `${nextCompliance.label} ${nextCompliance.days} gün içinde yenilenmeli.`,
        tone: "warning",
        level: "MEDIUM",
      };
    }
    return {
      text: `${nextCompliance.label} ${nextCompliance.days} gün içinde izlenmeli.`,
      tone: "info",
      level: "NORMAL",
    };
  }

  const risky = complianceDocs.filter((doc) =>
    ["critical", "warning"].includes(doc.status)
  ).length;
  if (risky > 0) {
    return {
      text: `${risky} evrak uyarı seviyesinde.`,
      tone: "warning",
      level: "MEDIUM",
    };
  }

  return {
    text: "Uygunluk evrakları kısa vadede kritik risk göstermiyor.",
    tone: "success",
    level: "LOW",
  };
}

function buildFinancialForecast(bundle, fleet) {
  const profit = bundle.profit || {};
  const net = resolveProfitabilityNet(bundle);
  const monthly = bundle.monthly || {};
  const incomeSeries = monthly.incomeData || [];
  const expenseSeries = monthly.expenseData || [];
  const topCost = highestExpenseCategory(profit);
  const signals = [];

  if (incomeSeries.length >= 2 && expenseSeries.length >= 2) {
    const lastExpense = Number(expenseSeries[incomeSeries.length - 1] || 0);
    const prevExpense = Number(expenseSeries[incomeSeries.length - 2] || 0);
    if (lastExpense > prevExpense && prevExpense > 0) signals.push("expense_up");
  }

  if (!profit.income && profit.totalExpense > 0) signals.push("income_missing");
  if (topCost === "yakıt" && (profit.fuel || 0) > 0) signals.push("fuel_dominant");
  if (net < 0) signals.push("negative_profit");

  if (Array.isArray(fleet) && fleet.length > 1) {
    const vehicleId = bundle.vehicle?.id;
    const current = fleet.find((row) => row.vehicleId === vehicleId);
    const avgProfit =
      fleet.reduce((sum, row) => sum + Number(row.profitability || 0), 0) / fleet.length;
    if (current && current.profitability < avgProfit) signals.push("below_fleet_avg");
  }

  if (signals.includes("negative_profit")) {
    return {
      text: "Düşük kârlılık devam ederse araç zarar grubuna geçebilir.",
      tone: "danger",
      level: "HIGH",
    };
  }
  if (signals.includes("income_missing")) {
    return {
      text: "Gelir kaydı olmadan gider devam ediyor — finansal risk artıyor.",
      tone: "warning",
      level: "HIGH",
    };
  }
  if (signals.includes("fuel_dominant")) {
    return {
      text: "Yakıt baskın maliyet — tüketim artışı kârlılığı zayıflatabilir.",
      tone: "warning",
      level: "MEDIUM",
    };
  }
  if (signals.includes("expense_up")) {
    return {
      text: "Giderler artış eğiliminde — aylık kârlılık izlenmeli.",
      tone: "warning",
      level: "MEDIUM",
    };
  }
  if (signals.includes("below_fleet_avg")) {
    return {
      text: "Kârlılık filo ortalamasının altında seyrediyor.",
      tone: "info",
      level: "MEDIUM",
    };
  }

  return {
    text: "Finansal görünüm kısa vadede stabil görünüyor.",
    tone: "success",
    level: "LOW",
  };
}

function buildOperationalForecast(bundle, actionIntel, events) {
  const criticalActions = actionIntel.criticalActions || [];
  const timelineWarn = (bundle.timeline?.events || []).some((event) =>
    ["warning", "critical"].includes(event.severity)
  );
  const nearCritical = events.some(
    (event) => event.severity === "critical" && event.days <= 7
  );

  let readiness = "Hazır";
  let tone = "success";
  let level = "LOW";

  if (criticalActions.length >= 2 || nearCritical) {
    readiness = "Kritik";
    tone = "danger";
    level = "CRITICAL";
  } else if (criticalActions.length > 0 || timelineWarn || events.some((event) => event.days <= 30)) {
    readiness = "Riskli";
    tone = "warning";
    level = "HIGH";
  } else if (actionIntel.score < 75 || events.some((event) => event.days <= 60)) {
    readiness = "Kontrollü";
    tone = "info";
    level = "MEDIUM";
  }

  return {
    readiness,
    text: `Operasyonel hazırlık: ${readiness}.`,
    tone,
    level,
  };
}

function levelRank(level) {
  const map = { LOW: 0, NORMAL: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return map[level] ?? 0;
}

function resolveExecutiveRiskLevel(forecasts) {
  const maxLevel = Math.max(
    levelRank(forecasts.maintenance.level),
    levelRank(forecasts.compliance.level),
    levelRank(forecasts.financial.level),
    levelRank(forecasts.operational.level)
  );
  if (maxLevel >= 4) return { level: "CRITICAL", tone: "danger" };
  if (maxLevel >= 3) return { level: "HIGH", tone: "warning" };
  if (maxLevel >= 2) return { level: "MEDIUM", tone: "info" };
  return { level: "LOW", tone: "success" };
}

function buildExecutiveForecast(forecasts, events, risk) {
  const nextEvent = events[0];
  if (risk.level === "CRITICAL" && nextEvent) {
    return `${nextEvent.label} önümüzdeki ${Math.max(nextEvent.days, 0)} gün içinde kritik operasyon riski oluşturabilir.`;
  }
  if (forecasts.maintenance.level === "CRITICAL" || forecasts.compliance.level === "CRITICAL") {
    return "Bakım ve uygunluk sinyalleri kısa vadede operasyonel baskı oluşturuyor.";
  }
  if (forecasts.financial.level === "HIGH") {
    return "Finansal trend zayıflıyor — gelir-gider dengesi yakından izlenmeli.";
  }
  if (forecasts.operational.readiness === "Hazır") {
    return "Operasyonel görünüm kısa vadede stabil kalması bekleniyor.";
  }
  return "Operasyonel riskler artıyor — öncelikli aksiyonlar planlanmalı.";
}

function buildRecommendation(forecasts, events) {
  const priorities = [
    { key: "maintenance", rank: levelRank(forecasts.maintenance.level) },
    { key: "compliance", rank: levelRank(forecasts.compliance.level) },
    { key: "financial", rank: levelRank(forecasts.financial.level) },
    { key: "operational", rank: levelRank(forecasts.operational.level) },
  ].sort((a, b) => b.rank - a.rank);

  const top = priorities[0];
  const hasNearTerm = events.some((event) => event.days <= 30);

  if (top.key === "maintenance" && top.rank >= 3) {
    return hasNearTerm
      ? "Bakım ve uygunluk kayıtları önümüzdeki 30 gün içinde operasyonel risk oluşturabilir. Öncelik bakım planı ve evrak yenilemesidir."
      : "Bakım planı önceliklendirilmeli ve servis kayıtları güncellenmelidir.";
  }
  if (top.key === "compliance" && top.rank >= 2) {
    return "Uygunluk evrakları önümüzdeki dönemde yenilenmeli; muayene ve sigorta tarihleri takip edilmelidir.";
  }
  if (top.key === "financial" && top.rank >= 2) {
    const profit = forecasts.financial.text.includes("Yakıt")
      ? "Yakıt giderleri azaltılmalı ve gelir kayıtları doğrulanmalıdır."
      : "Finansal performans izlenmeli; gelir-gider dengesi gözden geçirilmelidir.";
    return profit;
  }
  if (forecasts.operational.readiness === "Hazır") {
    return "Normal operasyona devam edilebilir; rutin kontrol yeterlidir.";
  }
  return "Operasyonel riskler izlenmeli; kritik aksiyonlar tamamlanmalıdır.";
}

function resolveNextCriticalDate(events) {
  const next = events.find((event) => event.days != null && event.days <= 90);
  if (!next) return null;
  if (next.days <= 0) return "Bugün";
  if (next.date) return next.date;
  return `${next.days} gün`;
}

function buildExecutivePredictiveFleetIntelligence(bundle, fleet, complianceDocs) {
  const docs = complianceDocs || [];
  const maintIntel = buildPredictiveMaintenanceIntelligence(bundle);
  const actionIntel = buildVehicleActionIntelligence(bundle, docs);
  const predictedEvents = collectPredictedEvents(bundle, docs);

  const maintenanceForecast = buildMaintenanceForecast(bundle, maintIntel, predictedEvents);
  const complianceForecast = buildComplianceForecast(docs, predictedEvents);
  const financialForecast = buildFinancialForecast(bundle, fleet);
  const operationalForecast = buildOperationalForecast(bundle, actionIntel, predictedEvents);

  const forecasts = {
    maintenance: maintenanceForecast,
    compliance: complianceForecast,
    financial: financialForecast,
    operational: operationalForecast,
  };

  const executiveRisk = resolveExecutiveRiskLevel(forecasts);
  const nextCriticalDate = resolveNextCriticalDate(predictedEvents);
  const nextCriticalEvent =
    predictedEvents[0]?.label || maintenanceForecast.text || "Yakın vadeli kritik olay yok";

  return {
    executiveRiskLevel: executiveRisk.level,
    executiveRiskTone: executiveRisk.tone,
    predictedEvents,
    maintenanceForecast,
    complianceForecast,
    financialForecast,
    operationalForecast,
    nextCriticalDate,
    nextCriticalEvent,
    executiveForecast: buildExecutiveForecast(forecasts, predictedEvents, executiveRisk),
    recommendation: buildRecommendation(forecasts, predictedEvents),
  };
}

module.exports = {
  buildExecutivePredictiveFleetIntelligence,
  collectPredictedEvents,
  severityBucket,
  buildMaintenanceForecast,
  buildComplianceForecast,
  buildFinancialForecast,
  buildOperationalForecast,
  resolveExecutiveRiskLevel,
};
