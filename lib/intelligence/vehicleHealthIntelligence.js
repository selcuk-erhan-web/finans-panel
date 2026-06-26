const { buildVehicleActionIntelligence } = require("./vehicleActionIntelligence");

const HEALTH_STATUS_LABELS = {
  healthy: "Sağlıklı",
  watch: "İzleme",
  risk: "Risk",
  critical: "Kritik",
  unknown: "Bilinmiyor",
};

const HEALTH_STATUS_TONES = {
  healthy: "success",
  watch: "info",
  risk: "warning",
  critical: "danger",
  unknown: "neutral",
};

const CLASSIFICATION_LABELS = {
  critical_asset: "Kritik Varlık",
  risky_operation: "Riskli Operasyon",
  under_watch: "İzleme Altında",
  healthy_operation: "Sağlıklı Operasyon",
  awaiting_data: "Veri Bekleniyor",
};

function domainPercent(breakdownRow) {
  if (!breakdownRow || !breakdownRow.weight) return null;
  return Math.max(0, Math.min(100, Math.round((breakdownRow.score / breakdownRow.weight) * 100)));
}

function complianceRiskyOrMissing(complianceDocs) {
  if (!complianceDocs.length) return true;
  return complianceDocs.some((d) => ["expired", "critical", "warning"].includes(d.status));
}

function buildHealthScore(bundle, complianceDocs) {
  const health = bundle.health;
  const actionIntel = buildVehicleActionIntelligence(bundle, complianceDocs);

  if (health?.health_score != null) {
    return {
      score: health.health_score,
      status: health.health_status || "unknown",
      statusLabel: HEALTH_STATUS_LABELS[health.health_status] || "Bilinmiyor",
      tone: HEALTH_STATUS_TONES[health.health_status] || "neutral",
      meta: health.recommendation || `${health.health_score} / 100`,
      breakdown: health.breakdown || null,
      source: "health",
    };
  }

  return {
    score: actionIntel.score,
    status:
      actionIntel.score >= 90
        ? "healthy"
        : actionIntel.score >= 75
          ? "watch"
          : actionIntel.score >= 50
            ? "risk"
            : "critical",
    statusLabel: actionIntel.status,
    tone: actionIntel.tone,
    meta: actionIntel.executiveRecommendation,
    breakdown: null,
    source: "action",
  };
}

function buildRiskRadarDomains(bundle, complianceDocs, healthScore) {
  const breakdown = healthScore.breakdown;
  if (breakdown) {
    return [
      { key: "compliance", label: "Uygunluk", score: domainPercent(breakdown.compliance), reason: breakdown.compliance?.reason },
      { key: "maintenance", label: "Bakım", score: domainPercent(breakdown.maintenance), reason: breakdown.maintenance?.reason },
      { key: "tire", label: "Lastik", score: domainPercent(breakdown.tire), reason: breakdown.tire?.reason },
      { key: "finance", label: "Finans", score: domainPercent(breakdown.finance), reason: breakdown.finance?.reason },
      { key: "data", label: "Veri Kalitesi", score: domainPercent(breakdown.data_quality), reason: breakdown.data_quality?.reason },
    ]
      .filter((row) => row.score != null)
      .map((row) => ({
        ...row,
        tone: row.score >= 80 ? "success" : row.score >= 60 ? "info" : row.score >= 40 ? "warning" : "danger",
        riskScore: 100 - row.score,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  const profit = bundle.profit || {};
  const net = profit.netProfit ?? bundle.summary?.net ?? 0;
  const maintOverdue = (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue");
  const tireRisky =
    !(bundle.tireStatus?.records || []).length ||
    (bundle.tireSeasonalStatus?.alerts || []).length > 0 ||
    bundle.tireSeasonalStatus?.status === "attention";

  const fallback = [
    {
      key: "compliance",
      label: "Uygunluk",
      score: complianceRiskyOrMissing(complianceDocs) ? 35 : 90,
      reason: complianceDocs.length ? "Uygunluk kayıtları mevcut." : "Uygunluk verisi eksik.",
    },
    {
      key: "maintenance",
      label: "Bakım",
      score: !(bundle.maintenanceHistory?.records || []).length ? 30 : maintOverdue ? 40 : 85,
      reason: maintOverdue ? "Gecikmiş bakım planı var." : "Bakım durumu izleniyor.",
    },
    {
      key: "tire",
      label: "Lastik",
      score: tireRisky ? 45 : 88,
      reason: tireRisky ? "Lastik envanteri veya sezon riski." : "Lastik durumu izlenebilir.",
    },
    {
      key: "finance",
      label: "Finans",
      score: net < 0 ? 35 : bundle.hasFinancialData ? 82 : 55,
      reason: net < 0 ? "Araç zararda." : bundle.hasFinancialData ? "Finansal kayıt mevcut." : "Finans verisi sınırlı.",
    },
    {
      key: "data",
      label: "Veri Kalitesi",
      score: healthScore.score,
      reason: "Genel veri tamamlama düzeyi.",
    },
  ];

  return fallback
    .map((row) => ({
      ...row,
      tone: row.score >= 80 ? "success" : row.score >= 60 ? "info" : row.score >= 40 ? "warning" : "danger",
      riskScore: 100 - row.score,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);
}

function buildExecutiveAlarms(bundle, complianceDocs) {
  const alarms = [];

  (bundle.alerts || []).forEach((alert) => {
    alarms.push({
      title: alert.title || "Operasyon Uyarısı",
      message: alert.message || "—",
      tone: alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "info",
      source: alert.type || "alert",
    });
  });

  (complianceDocs || [])
    .filter((d) => ["expired", "critical", "warning"].includes(d.status))
    .forEach((doc) => {
      alarms.push({
        title: doc.type_label || "Uygunluk",
        message: doc.status_label || doc.status || "Riskli evrak",
        tone: doc.status === "expired" || doc.status === "critical" ? "danger" : "warning",
        source: "compliance",
      });
    });

  (bundle.upcomingMaintenance || [])
    .filter((m) => m.status === "overdue")
    .forEach((m) => {
      alarms.push({
        title: "Gecikmiş Bakım",
        message: m.maintenance_type_label || m.type_label || "Bakım planı gecikti",
        tone: "danger",
        source: "maintenance",
      });
    });

  const tireAlerts = bundle.tireSeasonalStatus?.alerts || [];
  tireAlerts.slice(0, 2).forEach((alert) => {
    alarms.push({
      title: "Lastik Uyarısı",
      message: alert.message || alert.label || "Lastik sezon kontrolü gerekli",
      tone: "warning",
      source: "tire",
    });
  });

  const profit = bundle.profit || {};
  const net = profit.netProfit ?? bundle.summary?.net ?? 0;
  if (net < 0 && !alarms.some((a) => a.source === "LOSS_VEHICLE")) {
    alarms.push({
      title: "Zarar Eden Araç",
      message: `Net kâr negatif — maliyet kontrolü gerekli.`,
      tone: "danger",
      source: "finance",
    });
  }

  return alarms.slice(0, 6);
}

function buildRecentActivity(bundle) {
  const timelineEvents = (bundle.timeline?.events || []).slice(0, 6);
  if (timelineEvents.length) {
    return timelineEvents.map((event) => ({
      title: event.title || "Operasyon kaydı",
      date: event.event_date,
      source: event.source,
      tone:
        event.severity === "critical"
          ? "danger"
          : event.severity === "warning"
            ? "warning"
            : "info",
      amount: event.amount,
      description: event.description || "",
    }));
  }

  return (bundle.recentTransactions || []).slice(0, 6).map((tx) => ({
    title: tx.category || tx.description || (tx.type === "income" ? "Gelir" : "Gider"),
    date: tx.date,
    source: tx.type === "income" ? "finance" : "finance",
    tone: tx.type === "income" ? "success" : "info",
    amount: tx.amount,
    description: tx.description || "",
  }));
}

function buildVehicleClassification(bundle, complianceDocs, healthScore, alarms) {
  const score = healthScore.score;
  const status = healthScore.status;
  const net = bundle.profit?.netProfit ?? bundle.summary?.net ?? 0;
  const criticalAlarms = alarms.filter((a) => a.tone === "danger").length;

  if (score == null && !bundle.hasFinancialData && !complianceDocs.length) {
    return {
      label: CLASSIFICATION_LABELS.awaiting_data,
      tone: "neutral",
      description: "Gelir, uygunluk ve bakım kayıtları tamamlandıkça sınıflandırma netleşir.",
    };
  }

  if (status === "critical" || score < 40 || criticalAlarms >= 2) {
    return {
      label: CLASSIFICATION_LABELS.critical_asset,
      tone: "danger",
      description: "Acil veri tamamlama ve maliyet kontrolü öncelikli.",
    };
  }

  if (status === "risk" || score < 70 || net < 0 || criticalAlarms >= 1) {
    return {
      label: CLASSIFICATION_LABELS.risky_operation,
      tone: "warning",
      description: "Operasyonel ve finansal riskler aktif — yakın izleme gerekli.",
    };
  }

  if (status === "watch" || score < 90) {
    return {
      label: CLASSIFICATION_LABELS.under_watch,
      tone: "info",
      description: "Kayıtlar tamamlandıkça sağlık skoru güçlenecektir.",
    };
  }

  return {
    label: CLASSIFICATION_LABELS.healthy_operation,
    tone: "success",
    description: "Rutin kontrol ve periyodik izleme yeterli.",
  };
}

function deriveRiskRadarDecision(domains) {
  const top = domains[0];
  if (!top || top.riskScore <= 10) {
    return "Aktif risk sinyali düşük — rutin izleme yeterli.";
  }
  return `${top.label} alanında öncelikli kontrol önerilir: ${top.reason}`;
}

function buildVehicleHealthIntelligence(bundle, complianceDocs) {
  const healthScore = buildHealthScore(bundle, complianceDocs);
  const riskRadar = {
    domains: buildRiskRadarDomains(bundle, complianceDocs, healthScore),
    decision: "",
  };
  riskRadar.decision = deriveRiskRadarDecision(riskRadar.domains);

  const alarms = buildExecutiveAlarms(bundle, complianceDocs);
  const activity = buildRecentActivity(bundle);
  const classification = buildVehicleClassification(bundle, complianceDocs, healthScore, alarms);

  return {
    healthScore,
    riskRadar,
    alarms,
    activity,
    classification,
  };
}

module.exports = {
  buildVehicleHealthIntelligence,
  HEALTH_STATUS_LABELS,
  CLASSIFICATION_LABELS,
};
