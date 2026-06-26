function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToStatus(score) {
  if (score >= 85) return { status: "Düşük Risk", tone: "success" };
  if (score >= 70) return { status: "İzleme", tone: "info" };
  if (score >= 45) return { status: "Yüksek Risk", tone: "warning" };
  return { status: "Kritik", tone: "danger" };
}

function nextReviewLabel(status) {
  if (status === "Kritik") return "Bugün gözden geçirilmeli";
  if (status === "Yüksek Risk") return "7 gün içinde bakım kontrolü";
  if (status === "İzleme") return "30 gün içinde rutin kontrol";
  return "Rutin takip yeterli";
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function hasMaintenancePlan(bundle) {
  const scheduleItems = bundle.maintenanceSchedule?.items || [];
  return scheduleItems.length > 0;
}

function hasOverdueMaintenance(bundle) {
  return (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue");
}

function hasUpcomingMaintenance(bundle) {
  return (bundle.upcomingMaintenance || []).some((m) => m.status === "upcoming");
}

function hasTimelineWarningEvents(bundle) {
  const warnSources = new Set(["maintenance", "tire", "tire_history", "finance"]);
  return (bundle.timeline?.events || []).some(
    (event) =>
      warnSources.has(event.source) &&
      ["warning", "critical"].includes(event.severity)
  );
}

function isHighMaintenanceExpense(bundle) {
  const profit = bundle.profit || {};
  const maintenanceCost = Number(profit.maintenance || 0);
  if (maintenanceCost <= 0) return false;

  const benchmarks = bundle.benchmarks || {};
  if (benchmarks.avgExpense > 0 && benchmarks.vehicleCount > 1) {
    return maintenanceCost > benchmarks.avgExpense * 0.2;
  }

  const totalExpense = Number(profit.totalExpense || 0);
  return totalExpense > 0 && maintenanceCost / totalExpense >= 0.25;
}

function isHighKmWithoutRecentMaintenance(bundle, maintRecords) {
  const km = Number(bundle.vehicle?.current_km ?? bundle.vehicle?.km) || 0;
  if (km < 100000) return false;
  if (!maintRecords.length) return true;

  const latest = maintRecords[0];
  const latestDate = latest.maintenance_date || latest.service_date;
  const days = daysSince(latestDate);
  return days == null || days > 180;
}

function buildMaintenanceSignals(bundle, maintRecords) {
  const overdue = (bundle.upcomingMaintenance || []).filter((m) => m.status === "overdue");
  const upcoming = (bundle.upcomingMaintenance || []).filter((m) => m.status === "upcoming");
  const hasPlan = hasMaintenancePlan(bundle);

  return [
    {
      key: "history",
      label: "Bakım Geçmişi",
      value: maintRecords.length ? `${maintRecords.length} kayıt` : "Kayıt yok",
      meta: maintRecords.length
        ? "Geçmiş bakım izlenebilir"
        : "İlk bakım kaydı bekleniyor",
      tone: maintRecords.length ? "success" : "danger",
    },
    {
      key: "plan",
      label: "Bakım Planı",
      value: hasPlan ? "Plan tanımlı" : "Plan eksik",
      meta: hasPlan ? "Periyodik takvim mevcut" : "Bakım takvimi oluşturulmalı",
      tone: hasPlan ? "success" : "warning",
    },
    {
      key: "schedule",
      label: "Yaklaşan/Gecikmiş Bakım",
      value: overdue.length
        ? `${overdue.length} gecikmiş`
        : upcoming.length
          ? `${upcoming.length} yaklaşan`
          : "Bekleyen yok",
      meta: overdue.length
        ? "Servis planı güncellenmeli"
        : upcoming.length
          ? "Yaklaşan bakım kontrol edilmeli"
          : "Aktif bakım uyarısı yok",
      tone: overdue.length ? "danger" : upcoming.length ? "warning" : "success",
    },
  ];
}

function buildExecutiveRecommendation(status, riskFactors) {
  if (status === "Kritik") {
    return "Bu araç için bakım disiplini acil olarak gözden geçirilmeli ve eksik kayıtlar tamamlanmalı.";
  }
  if (status === "Yüksek Risk") {
    return "Bakım planı ve gecikmiş servis kayıtları öncelikli olarak kontrol edilmeli.";
  }
  if (status === "İzleme") {
    return "Bakım kayıtları izlenmeli; yaklaşan servis planı rutin kontrolle doğrulanmalı.";
  }
  if (riskFactors.length) {
    return "Genel bakım riski düşük; mevcut sinyaller rutin takiple yönetilebilir.";
  }
  return "Bakım disiplini yeterli görünüyor; periyodik kontrol sürdürülmeli.";
}

function buildPredictiveMaintenanceIntelligence(bundle) {
  const maintRecords = bundle.maintenanceHistory?.records || bundle.maintenance || [];
  const profit = bundle.profit || {};
  const riskFactors = [];
  const maintenanceSignals = buildMaintenanceSignals(bundle, maintRecords);

  let score = 100;

  if (!maintRecords.length) {
    score -= 25;
    riskFactors.push("Bakım geçmişi yok — ilk bakım kaydı oluşturulmalı.");
  }

  if (!hasMaintenancePlan(bundle)) {
    score -= 20;
    riskFactors.push("Bakım planı eksik — periyodik bakım takvimi tanımlanmalı.");
  }

  if (hasOverdueMaintenance(bundle)) {
    score -= 25;
    riskFactors.push("Gecikmiş bakım bulunuyor — servis kaydı güncellenmeli.");
  } else if (hasUpcomingMaintenance(bundle)) {
    score -= 10;
    riskFactors.push("Yaklaşan bakım bulunuyor — servis planı kontrol edilmeli.");
  }

  if (isHighMaintenanceExpense(bundle)) {
    score -= 15;
    riskFactors.push("Bakım gideri yüksek görünüyor — maliyet ve servis kayıtları incelenmeli.");
  }

  if ((profit.fuel || 0) > 0 && !maintRecords.length) {
    score -= 10;
    riskFactors.push(
      "Yakıt gideri oluşmuş ancak bakım kaydı yok — mekanik kontrol önerilir."
    );
  }

  if (hasTimelineWarningEvents(bundle)) {
    score -= 10;
    riskFactors.push(
      "Zaman çizelgesinde bakım/lastik/yakıt uyarısı var — operasyon kayıtları kontrol edilmeli."
    );
  }

  if (isHighKmWithoutRecentMaintenance(bundle, maintRecords)) {
    score -= 15;
    riskFactors.push("KM yüksek görünüyor — bakım disiplini doğrulanmalı.");
  }

  score = clampScore(score);
  const { status, tone } = scoreToStatus(score);
  const review = nextReviewLabel(status);

  return {
    score,
    status,
    tone,
    nextReviewLabel: review,
    riskFactors: riskFactors.slice(0, 4),
    maintenanceSignals,
    executiveRecommendation: buildExecutiveRecommendation(status, riskFactors),
  };
}

module.exports = {
  buildPredictiveMaintenanceIntelligence,
  clampScore,
  scoreToStatus,
  nextReviewLabel,
};
