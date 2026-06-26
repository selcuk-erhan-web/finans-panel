function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function complianceRiskyOrMissing(complianceDocs) {
  if (!complianceDocs.length) return true;
  return complianceDocs.some((d) => ["expired", "critical", "warning"].includes(d.status));
}

function maintenanceMissingOrOverdue(bundle) {
  const records = bundle.maintenanceHistory?.records || bundle.maintenance || [];
  if (!records.length) return true;
  return (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue");
}

function tireMissingOrRisky(bundle) {
  const tireMissing = !(bundle.tireStatus?.records || []).length;
  const tireWarn =
    (bundle.tireSeasonalStatus?.alerts || []).length > 0 ||
    bundle.tireSeasonalStatus?.status === "attention";
  return tireMissing || tireWarn;
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

function majorDataMissing(bundle, complianceDocs) {
  const gaps = [
    !complianceDocs.length,
    !(bundle.maintenanceHistory?.records || []).length,
    !(bundle.tireStatus?.records || []).length,
    !bundle.hasFinancialData,
  ].filter(Boolean).length;
  return gaps >= 2;
}

function scoreToStatus(score) {
  if (score >= 90) return { status: "Mükemmel", tone: "success" };
  if (score >= 75) return { status: "İyi", tone: "info" };
  if (score >= 50) return { status: "Dikkat", tone: "warning" };
  return { status: "Kritik", tone: "danger" };
}

function buildVehicleActionIntelligence(bundle, complianceDocs) {
  const profit = bundle.profit || {};
  const net = profit.netProfit ?? bundle.summary?.net ?? 0;
  const hasIncome = (profit.income || 0) > 0;
  const hasExpense = (profit.totalExpense || 0) > 0;

  let score = 100;
  const criticalActions = [];
  const financialActions = [];
  const operationalActions = [];

  if (complianceRiskyOrMissing(complianceDocs)) {
    score -= 20;
    if (!complianceDocs.length) {
      criticalActions.push("Uygunluk verisi eksik — evrak kayıtları tamamlanmalı.");
    } else {
      criticalActions.push("Uygunluk riski aktif — evrak yenileme tarihleri kontrol edilmeli.");
    }
  }

  if (maintenanceMissingOrOverdue(bundle)) {
    score -= 20;
    const records = bundle.maintenanceHistory?.records || bundle.maintenance || [];
    if (!records.length) {
      criticalActions.push("Bakım kaydı yok — ilk bakım kaydı oluşturulmalı.");
    } else {
      criticalActions.push("Gecikmiş bakım planı var — servis kaydı güncellenmeli.");
    }
  }

  if (tireMissingOrRisky(bundle)) {
    score -= 15;
    if (!(bundle.tireStatus?.records || []).length) {
      criticalActions.push("Lastik envanteri eksik — araç lastik durumu doğrulanmalı.");
    } else {
      criticalActions.push("Lastik uyarısı aktif — lastik sezon durumu kontrol edilmeli.");
    }
  }

  if (net < 0) {
    score -= 20;
    financialActions.push("Araç zararda — gider ve gelir dengesi incelenmeli.");
  }

  if (!hasIncome && hasExpense) {
    score -= 10;
    financialActions.push(
      "Gelir kaydı yok ancak gider oluşmuş — operasyon geliri doğrulanmalı."
    );
  }

  const topCost = highestExpenseCategory(profit);
  if (topCost === "yakıt" && (profit.fuel || 0) > 0) {
    financialActions.push("Ana maliyet kalemi yakıt — yakıt tüketimi kontrol edilmeli.");
  } else if (topCost && (profit.totalExpense || 0) > 0) {
    financialActions.push(`Ana maliyet kalemi ${topCost} — maliyet dağılımı gözden geçirilmeli.`);
  }

  if (majorDataMissing(bundle, complianceDocs)) {
    score -= 15;
    operationalActions.push(
      "Araç verisi eksik — gelir, bakım ve uygunluk kayıtları tamamlanmalı."
    );
  }

  const timelineCount =
    (bundle.timeline?.events || []).length ||
    (bundle.recentTransactions || []).length ||
    0;
  if (timelineCount < 3) {
    operationalActions.push(
      "Araç için operasyon zaman çizelgesi sınırlı — son hareketler kontrol edilmeli."
    );
  }

  score = clampScore(score);
  const { status, tone } = scoreToStatus(score);

  let executiveRecommendation;
  if (score < 50 || criticalActions.length >= 2) {
    executiveRecommendation =
      "Bu araç için öncelik veri tamamlama ve maliyet kontrolü olmalı.";
  } else if (score < 75) {
    executiveRecommendation =
      "Bu araç izlenmeli; eksik kayıtlar tamamlandıktan sonra kârlılık tekrar değerlendirilmeli.";
  } else {
    executiveRecommendation = "Araç genel olarak izlenebilir durumda; rutin kontrol yeterli.";
  }

  return {
    score,
    status,
    tone,
    criticalActions,
    financialActions,
    operationalActions,
    executiveRecommendation,
  };
}

module.exports = {
  buildVehicleActionIntelligence,
  clampScore,
  scoreToStatus,
};
