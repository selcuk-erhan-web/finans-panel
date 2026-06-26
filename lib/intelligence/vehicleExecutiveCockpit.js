const {
  buildCriticalRiskDomains,
  resolveMonthlyProfitability,
} = require("./vehicleExecutiveScoreboard");

const RISK_PRIORITY = ["Uygunluk", "Bakım", "Lastik", "Finans", "Operasyon"];

function scoreToStateLabel(score) {
  if (score >= 90) return { stateLabel: "MÜKEMMEL", tone: "success" };
  if (score >= 75) return { stateLabel: "İYİ", tone: "info" };
  if (score >= 50) return { stateLabel: "DİKKAT", tone: "warning" };
  return { stateLabel: "KRİTİK", tone: "danger" };
}

function resolveScore(actionIntel, healthIntel) {
  if (actionIntel?.score != null) return Number(actionIntel.score) || 0;
  if (healthIntel?.healthScore?.score != null) return Number(healthIntel.healthScore.score) || 0;
  return 0;
}

function resolveTodayPriority(actionIntel) {
  const action = actionIntel || {};
  if (action.criticalActions?.length) return action.criticalActions[0];
  if (action.financialActions?.length) return action.financialActions[0];
  if (action.operationalActions?.length) return action.operationalActions[0];
  if (action.executiveRecommendation) return action.executiveRecommendation;
  return "Rutin takip yeterli.";
}

function resolvePrimaryRisk(bundle, complianceDocs, maintenanceIntel) {
  const domains = buildCriticalRiskDomains(bundle, complianceDocs || [], maintenanceIntel);
  if (!domains.length) {
    return { primaryRisk: "Yok", riskMeta: "Kritik sinyal yok" };
  }

  const primaryRisk = RISK_PRIORITY.find((domain) => domains.includes(domain)) || domains[0];
  const riskMeta =
    domains.length === 1
      ? "1 aktif risk alanı"
      : `${domains.length} aktif risk alanı`;

  return { primaryRisk, riskMeta };
}

function resolveFinancialImpact(bundle, scoreboard) {
  const profitCard = (scoreboard?.cards || []).find((card) => card.key === "profit");
  if (profitCard) {
    return {
      financialImpact: profitCard.value,
      financialMeta: profitCard.meta || "Aylık kârlılık",
      tone: profitCard.tone || "neutral",
    };
  }

  const profitability = resolveMonthlyProfitability(bundle);
  return {
    financialImpact: profitability.value,
    financialMeta: profitability.meta,
    tone: profitability.tone,
  };
}

function resolveReadiness(actionIntel, score) {
  const criticalCount = (actionIntel?.criticalActions || []).length;
  if (!criticalCount && score >= 75) return "Operasyona Hazır";
  if (score < 50 || criticalCount >= 2) return "Önce Kontrol";
  return "Kontrollü Kullanım";
}

function buildVehicleExecutiveCockpit(
  bundle,
  actionIntel,
  healthIntel,
  maintenanceIntel,
  scoreboard,
  complianceDocs
) {
  const score = resolveScore(actionIntel, healthIntel);
  const state = scoreToStateLabel(score);
  const { primaryRisk, riskMeta } = resolvePrimaryRisk(bundle, complianceDocs, maintenanceIntel);
  const financial = resolveFinancialImpact(bundle, scoreboard);

  return {
    stateLabel: state.stateLabel,
    score,
    tone: actionIntel?.tone || state.tone,
    todayPriority: resolveTodayPriority(actionIntel),
    primaryRisk,
    riskMeta,
    financialImpact: financial.financialImpact,
    financialMeta: financial.financialMeta,
    financialTone: financial.tone,
    readiness: resolveReadiness(actionIntel, score),
  };
}

module.exports = {
  buildVehicleExecutiveCockpit,
  scoreToStateLabel,
  resolveTodayPriority,
  resolvePrimaryRisk,
  resolveReadiness,
};
