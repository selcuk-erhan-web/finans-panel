const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatPlateDisplay } = require("../../utils/plate");
const { resolveInsightVehicleImageSrc } = require("../vehicleInsightImages");
const documentService = require("../../services/documentService");
const maintenanceSchedulerService = require("../../services/maintenanceSchedulerService");
const tireSeasonalSchedulerService = require("../../services/tireSeasonalSchedulerService");
const vehicleIntelligenceService = require("../../services/vehicleIntelligenceService");
const vehicleHealthService = require("../../services/vehicleHealthService");
const vehicleProfitRiskService = require("../../services/vehicleProfitRiskService");

const DECISION_TONES = new Set(["success", "warning", "danger", "info", "neutral"]);
const INSIGHT_TONES = new Set(["success", "warning", "danger", "info", "neutral"]);

function executiveInsight({ title = "Yönetici Önerisi", body = "", action = "", tone = "info" }) {
  const t = INSIGHT_TONES.has(tone) ? tone : "info";
  const actionHtml = action
    ? `<p class="executive-insight__action">${escapeHtml(action)}</p>`
    : "";
  return `<aside class="executive-insight executive-insight--${t}">
    <h3 class="executive-insight__title">${escapeHtml(title)}</h3>
    ${body ? `<p class="executive-insight__body">${escapeHtml(body)}</p>` : ""}
    ${actionHtml}
  </aside>`;
}

function executiveDecisionCard({ label, value, meta = "", tone = "neutral" }) {
  const t = DECISION_TONES.has(tone) ? tone : "neutral";
  const metaHtml = meta ? `<em class="executive-decision-card__meta">${escapeHtml(meta)}</em>` : "";
  return `<article class="executive-decision-card executive-decision-card--${t}">
    <span class="executive-decision-card__label">${escapeHtml(label)}</span>
    <strong class="executive-decision-card__value">${value}</strong>
    ${metaHtml}
  </article>`;
}

function executiveDecisionGrid(cardsHtml) {
  return `<section class="executive-decision-grid fade-in" aria-label="Yönetici karar kartları">${cardsHtml}</section>`;
}

function executiveEmptyNote(message, hint = "") {
  const hintHtml = hint
    ? `<span class="executive-empty-note__hint">${escapeHtml(hint)}</span>`
    : "";
  return `<p class="executive-empty-note">${escapeHtml(message)}${hintHtml}</p>`;
}

function deriveFleetStatusLabel({ criticalVehicles, complianceRisk, maintenanceRisk, tireRisk, hasData }) {
  if (criticalVehicles > 0) {
    return { label: "Aksiyon Gerekiyor", tone: "danger", centerTone: "danger" };
  }

  const complianceActive =
    (complianceRisk.within30 || 0) + (complianceRisk.expired || 0) > 0;
  const maintenanceActive =
    (maintenanceRisk.due || 0) + (maintenanceRisk.overdue || 0) + (maintenanceRisk.upcoming || 0) > 0;
  const tireActive = (tireRisk.warnings || 0) > 0;

  if (complianceActive || maintenanceActive || tireActive) {
    return { label: "Dikkat", tone: "warning", centerTone: "warning" };
  }

  if (!hasData) {
    return { label: "İzleme", tone: "info", centerTone: "stable" };
  }

  return { label: "Stabil", tone: "success", centerTone: "stable" };
}

function derivePrimaryAction({
  criticalVehicles,
  complianceRisk,
  maintenanceRisk,
  tireRisk,
  fleetStatus,
}) {
  if (complianceRisk.expired > 0) {
    return `${complianceRisk.expired} evrak süresi geçmiş — Uygunluk Merkezi öncelikli.`;
  }
  if (maintenanceRisk.overdue > 0) {
    return `${maintenanceRisk.overdue} gecikmiş bakım — Bakım planı kontrol edilmeli.`;
  }
  if (criticalVehicles > 0) {
    return `${criticalVehicles} araç kritik sinyal taşıyor — Araç Zekâsı incelenmeli.`;
  }
  if (tireRisk.unknown > 0) {
    return `Öncelik: ${tireRisk.unknown} araç için lastik envanteri girilmeli.`;
  }
  if (complianceRisk.within30 > 0) {
    return `${complianceRisk.within30} evrak 30 gün içinde bitiyor — yenileme planı oluşturun.`;
  }
  if (maintenanceRisk.due > 0 || maintenanceRisk.upcoming > 0) {
    const n = maintenanceRisk.due + maintenanceRisk.upcoming;
    return `${n} yaklaşan bakım kalemi — servis planı gözden geçirilmeli.`;
  }
  if (fleetStatus.tone === "loss") {
    return "Filo net zararda — gider ve gelir dengesi gözden geçirilmeli.";
  }
  if (fleetStatus.tone === "profit") {
    return "Operasyon dengeli — kritik risk sinyali bulunmuyor.";
  }
  return "Veri izleniyor — öncelikli aksiyon bulunamadı.";
}

function deriveCommandCenterBrief({
  criticalVehicles,
  complianceRisk,
  maintenanceRisk,
  tireRisk,
  hasData,
}) {
  if (!hasData) {
    return "Veri izleniyor.";
  }
  if (criticalVehicles > 0) {
    return `${criticalVehicles} araç kritik sinyal taşıyor.`;
  }
  if ((complianceRisk?.expired || 0) > 0) {
    return `${complianceRisk.expired} evrak süresi geçmiş.`;
  }
  if ((maintenanceRisk?.overdue || 0) > 0) {
    return `${maintenanceRisk.overdue} gecikmiş bakım var.`;
  }
  if ((tireRisk?.unknown || 0) > 0) {
    return `${tireRisk.unknown} araçta lastik envanteri eksik.`;
  }
  if ((complianceRisk?.within30 || 0) > 0) {
    return `${complianceRisk.within30} evrak yakında bitiyor.`;
  }
  if ((maintenanceRisk?.due || 0) > 0) {
    return `${maintenanceRisk.due} bakım vadesi var.`;
  }
  return "Kritik sinyal bulunmuyor.";
}

const FLEET_HEALTH_BULLET_LABELS = {
  loss_vehicle: "Zarar üreten araçlar",
  critical_vehicle: "Kritik araç sinyalleri",
  tire_unknown: "Lastik envanteri",
  tire_warning: "Lastik envanteri",
  compliance_expired: "Yaklaşan evraklar",
  compliance_upcoming: "Yaklaşan evraklar",
  maintenance_overdue: "Gecikmiş bakım",
  maintenance_gap: "Bakım planı",
};

function deriveFleetHealthExecutiveRecommendation(commandCtx, bundle = {}) {
  const items = buildRiskRadarItems(commandCtx, bundle);
  const seen = new Set();
  const bullets = [];

  for (const item of items) {
    const label = FLEET_HEALTH_BULLET_LABELS[item.key];
    if (label && !seen.has(label)) {
      seen.add(label);
      bullets.push(label);
    }
  }

  if (bullets.length === 0) {
    return {
      intro: "Filo sağlığı izleniyor.",
      bullets: ["Kritik öncelik bulunmuyor — rutin izleme yeterli."],
    };
  }

  return {
    intro: "Bu haftanın önceliği:",
    bullets,
  };
}

function derivePrimaryActionCTA({ criticalVehicles, complianceRisk, maintenanceRisk, tireRisk }) {
  if (criticalVehicles > 0) {
    return { label: "Araç Zekâsını İncele", href: "/vehicle-intelligence" };
  }
  if ((complianceRisk.expired || 0) > 0 || (complianceRisk.within30 || 0) > 0) {
    return { label: "Uygunluk Risklerini Kontrol Et", href: "/documents" };
  }
  if ((maintenanceRisk.overdue || 0) > 0 || (maintenanceRisk.due || 0) > 0) {
    return { label: "Bakım Planını Oluştur", href: "/maintenance" };
  }
  if ((tireRisk.unknown || 0) > 0 || (tireRisk.mismatch || 0) > 0 || (tireRisk.attention || 0) > 0) {
    return { label: "Lastik Envanterini Tamamla", href: "/tires" };
  }
  if ((maintenanceRisk.upcoming || 0) > 0) {
    return { label: "Bakım Planını Oluştur", href: "/maintenance" };
  }
  return { label: "İzlemeye Devam Et", href: "/" };
}

function buildDashboardCommandBarContext(bundle = {}) {
  const ref = new Date();
  const docKpi = documentService.getKpiSummary(ref);
  const scheduleReport = maintenanceSchedulerService.buildMaintenanceScheduleReport(ref);
  const scheduleSummary = scheduleReport.summary || {};
  const tireSeasonal = tireSeasonalSchedulerService.buildTireSeasonalSchedule(ref);
  const tireSummary = tireSeasonal.summary || {};

  let criticalVehicles = 0;
  try {
    const vi = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: ref });
    criticalVehicles = vi.summary?.vehicles_with_critical_signals || 0;
  } catch {
    criticalVehicles = bundle.corporateAlerts?.critical || 0;
  }

  const complianceRisk = {
    within30: (docKpi.within30 || 0) + (docKpi.within7 || 0),
    expired: docKpi.expired || 0,
    within60: docKpi.within60 || 0,
    critical: (docKpi.expired || 0) + (docKpi.within7 || 0),
  };

  const maintenanceRisk = {
    due: scheduleSummary.due || 0,
    overdue: scheduleSummary.overdue || 0,
    upcoming: scheduleSummary.upcoming || 0,
    total: (scheduleSummary.due || 0) + (scheduleSummary.overdue || 0) + (scheduleSummary.upcoming || 0),
  };

  const tireRisk = {
    unknown: tireSummary.unknown || 0,
    mismatch: tireSummary.mismatch || 0,
    attention: tireSummary.attention || 0,
    warnings: (tireSummary.unknown || 0) + (tireSummary.mismatch || 0) + (tireSummary.attention || 0),
  };

  const fleetStatus = deriveFleetStatusLabel({
    criticalVehicles,
    complianceRisk,
    maintenanceRisk,
    tireRisk,
    hasData:
      (bundle.vehicleCount || 0) > 0 ||
      (docKpi.expired || 0) + (docKpi.within30 || 0) > 0 ||
      (scheduleSummary.due || 0) + (scheduleSummary.overdue || 0) + (scheduleSummary.upcoming || 0) > 0 ||
      (tireSummary.unknown || 0) + (tireSummary.mismatch || 0) + (tireSummary.attention || 0) > 0,
  });

  const netProfit = bundle.profit?.summary?.totalNet ?? 0;
  const primaryRecommendation = derivePrimaryAction({
    criticalVehicles,
    complianceRisk,
    maintenanceRisk,
    tireRisk,
    fleetStatus: bundle.fleetStatus || { tone: "neutral" },
  });
  const primaryCta = derivePrimaryActionCTA({
    criticalVehicles,
    complianceRisk,
    maintenanceRisk,
    tireRisk,
  });

  const hasData =
    (bundle.vehicleCount || 0) > 0 ||
    complianceRisk.expired + complianceRisk.within30 > 0 ||
    maintenanceRisk.total > 0 ||
    tireRisk.warnings > 0;

  const totalActiveRiskCount =
    criticalVehicles +
    (complianceRisk.within30 || 0) +
    (complianceRisk.expired || 0) +
    (maintenanceRisk.due || 0) +
    (maintenanceRisk.overdue || 0) +
    (tireRisk.warnings || 0);

  const briefRecommendation = deriveCommandCenterBrief({
    criticalVehicles,
    complianceRisk,
    maintenanceRisk,
    tireRisk,
    hasData,
  });

  return {
    fleetStatus,
    criticalVehicles,
    complianceRisk,
    maintenanceRisk,
    tireRisk,
    netProfit,
    totalActiveRiskCount,
    primaryRecommendation,
    briefRecommendation,
    primaryAction: primaryRecommendation,
    primaryCta,
    hasData,
  };
}

function presentationRiskScore(severityBase, count) {
  if (!count || count <= 0) return null;
  return Math.min(99, Math.max(12, severityBase + Math.min(count, 8) * 3));
}

function buildRiskRadarItems(commandCtx, bundle = {}) {
  const items = [];
  const { complianceRisk, maintenanceRisk, tireRisk, criticalVehicles } = commandCtx;
  const profit = bundle.profit || {};

  if ((complianceRisk.expired || 0) > 0) {
    items.push({
      key: "compliance_expired",
      label: "Uygunluk / Trafik Sigortası Riski",
      score: presentationRiskScore(72, complianceRisk.expired + (complianceRisk.within30 || 0)),
    });
  } else if ((complianceRisk.within30 || 0) > 0) {
    items.push({
      key: "compliance_upcoming",
      label: "Yaklaşan Uygunluk Bitişi",
      score: presentationRiskScore(40, complianceRisk.within30),
    });
  }

  const lossVehicle = profit.leastProfitable;
  if (lossVehicle?.netProfit != null && lossVehicle.netProfit < 0) {
    items.push({
      key: "loss_vehicle",
      label: "Zarar Üreten Araç",
      score: presentationRiskScore(
        68,
        Math.max(1, Math.round(Math.abs(lossVehicle.netProfit) / 5000))
      ),
      plate: lossVehicle.plate,
    });
  }

  if (criticalVehicles > 0) {
    items.push({
      key: "critical_vehicle",
      label: "Kritik Araç Sinyali",
      score: presentationRiskScore(62, criticalVehicles),
    });
  }

  if ((tireRisk.unknown || 0) > 0) {
    items.push({
      key: "tire_unknown",
      label: "Eksik Lastik Envanteri",
      score: presentationRiskScore(58, tireRisk.unknown),
    });
  } else if ((tireRisk.warnings || 0) > 0) {
    items.push({
      key: "tire_warning",
      label: "Lastik Uyarısı",
      score: presentationRiskScore(48, tireRisk.warnings),
    });
  }

  if ((maintenanceRisk.overdue || 0) > 0) {
    items.push({
      key: "maintenance_overdue",
      label: "Gecikmiş Bakım",
      score: presentationRiskScore(55, maintenanceRisk.overdue),
    });
  } else if ((maintenanceRisk.due || 0) > 0 || (maintenanceRisk.upcoming || 0) > 0) {
    items.push({
      key: "maintenance_gap",
      label: "Bakım Planı Eksikliği",
      score: presentationRiskScore(44, (maintenanceRisk.due || 0) + (maintenanceRisk.upcoming || 0)),
    });
  }

  return items
    .filter((item) => item.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function deriveRiskRadarDecision(topItem, commandCtx) {
  if (!topItem) {
    return "Bu hafta filo riskleri izleniyor — kritik öncelik bulunmuyor.";
  }
  const decisions = {
    compliance_expired: "Bu haftanın önceliği uygunluk iyileştirmesi.",
    compliance_upcoming: "Bu haftanın önceliği uygunluk yenileme planı.",
    loss_vehicle: "Bu haftanın önceliği zarar üreten araçların gider analizi.",
    critical_vehicle: "Bu haftanın önceliği kritik araç sinyallerinin giderilmesi.",
    tire_unknown: "Bu haftanın önceliği lastik envanterinin tamamlanması.",
    tire_warning: "Bu haftanın önceliği lastik risklerinin giderilmesi.",
    maintenance_overdue: "Bu haftanın önceliği gecikmiş bakımın tamamlanması.",
    maintenance_gap: "Bu haftanın önceliği bakım planının oluşturulması.",
  };
  return (
    decisions[topItem.key] ||
    commandCtx.primaryRecommendation ||
    "Bu hafta operasyonel riskler izleniyor."
  );
}

function buildExecutiveRiskRadarContext(bundle = {}) {
  const commandCtx = buildDashboardCommandBarContext(bundle);
  const items = buildRiskRadarItems(commandCtx, bundle);
  return {
    items,
    decision: deriveRiskRadarDecision(items[0], commandCtx),
    hasData: items.length > 0,
  };
}

function executiveRiskRadarHtml(context) {
  const listHtml = context.items.length
    ? context.items
        .map(
          (item) => `<li class="executive-risk-radar__priority-item executive-risk-radar__item">
            <span class="executive-risk-radar__priority-rank">${item.rank}</span>
            <div class="executive-risk-radar__priority-body">
              <strong class="executive-risk-radar__priority-label">${escapeHtml(item.label)}</strong>
              <span class="executive-risk-radar__priority-score">Risk Skoru: ${item.score}</span>
            </div>
          </li>`
        )
        .join("")
    : `<li class="executive-risk-radar__priority-item executive-risk-radar__priority-item--empty">
        <span class="executive-risk-radar__priority-rank">—</span>
        <div class="executive-risk-radar__priority-body">
          <strong class="executive-risk-radar__priority-label">Aktif risk sinyali bulunmuyor</strong>
          <span class="executive-risk-radar__priority-score">Risk Skoru: 0</span>
        </div>
      </li>`;

  return `<section class="executive-risk-radar executive-risk-radar--compact fade-in" aria-label="Yönetici risk radarı">
    <div class="executive-risk-radar__bar">
      <header class="executive-risk-radar__head">
        <h2 class="executive-risk-radar__title">Operasyonel Risk Radarı</h2>
      </header>
      <div class="executive-risk-radar__decision">
        <span class="executive-risk-radar__decision-title">Yönetici Kararı</span>
        <p class="executive-risk-radar__decision-text">${escapeHtml(context.decision)}</p>
      </div>
    </div>
    <ol class="executive-risk-radar__priority-list executive-risk-radar__list">${listHtml}</ol>
  </section>`;
}

function buildExecutiveInsightsContext(bundle = {}) {
  const profit = bundle.profit || {};
  let fleet = { vehicles: [] };
  try {
    fleet = vehicleProfitRiskService.buildFleetVehicleProfitRisk({ referenceDate: new Date() });
  } catch {
    /* safe fallback */
  }

  const vehicles = fleet.vehicles || [];
  let viInsights = buildVehicleDecisionInsights([], {});
  try {
    const vi = vehicleIntelligenceService.buildFleetVehicleIntelligence({ referenceDate: new Date() });
    viInsights = buildVehicleDecisionInsights(vi.vehicles || [], vi.summary || {});
  } catch {
    /* safe fallback */
  }

  const mostProfitableFromProfit = profit.mostProfitable;
  const profitableVehicle =
    vehicles.find((v) => v.plate === mostProfitableFromProfit?.plate) ||
    vehicles.filter((v) => (v.profitability?.net_profit || 0) > 0).slice(-1)[0];

  const highestRisk =
    vehicles.find(
      (v) =>
        v.fusion?.priority === "urgent" ||
        v.risk?.risk_level === "critical" ||
        v.risk?.risk_level === "high"
    ) || vehicles[0];

  const highestCost = vehicles.length
    ? [...vehicles].sort(
        (a, b) => (b.profitability?.total_expense || 0) - (a.profitability?.total_expense || 0)
      )[0]
    : null;

  const immediate =
    vehicles.find((v) => v.fusion?.priority === "urgent") ||
    vehicles.find((v) => v.fusion?.priority === "high") ||
    highestRisk;

  const plateLabel = (row) => formatPlateDisplay(row?.plate) || row?.plate || "—";
  const vehicleIdOf = (row) => row?.vehicle_id || row?.id || null;

  return {
    mostProfitable: {
      plate: plateLabel(
        mostProfitableFromProfit?.plate && mostProfitableFromProfit.plate !== "—"
          ? { plate: mostProfitableFromProfit.plate }
          : profitableVehicle || viInsights.mostProfitable
      ),
      value:
        mostProfitableFromProfit?.netProfit ??
        profitableVehicle?.profitability?.net_profit ??
        viInsights.mostProfitable?.finance?.net_profit,
      vehicleId: vehicleIdOf(
        profitableVehicle ||
          viInsights.mostProfitable ||
          (mostProfitableFromProfit?.plate ? { plate: mostProfitableFromProfit.plate } : null)
      ),
    },
    highestRisk: {
      plate: plateLabel(highestRisk || viInsights.mostRisky),
      reason:
        highestRisk?.drivers?.[0]?.label ||
        highestRisk?.risk?.summary ||
        primarySignalReason(viInsights.mostRisky),
      vehicleId: vehicleIdOf(highestRisk || viInsights.mostRisky),
    },
    highestCost: {
      plate: plateLabel(highestCost || viInsights.highestExpense),
      value:
        highestCost?.profitability?.total_expense ??
        viInsights.highestExpense?.finance?.total_expense,
      vehicleId: vehicleIdOf(highestCost || viInsights.highestExpense),
    },
    immediateAttention: {
      plate: plateLabel(immediate),
      reason:
        immediate?.fusion?.action ||
        immediate?.drivers?.[0]?.label ||
        (immediate ? primarySignalReason(immediate) : "İncelenmeli"),
      vehicleId: vehicleIdOf(immediate),
    },
    hasData:
      profit.hasData ||
      vehicles.length > 0 ||
      viInsights.hasVehicles ||
      (mostProfitableFromProfit?.plate && mostProfitableFromProfit.plate !== "—"),
  };
}

function executiveInsightCard({
  label,
  plate,
  meta = "",
  tone = "neutral",
  vehicleId = null,
  variant = "vehicle",
}) {
  const t = INSIGHT_TONES.has(tone) ? tone : "neutral";
  const detailHref = vehicleId ? `/vehicle/${vehicleId}` : "/executive-vehicle-dashboard";
  const metaHtml = meta ? `<p class="executive-insight-card__meta">${escapeHtml(meta)}</p>` : "";

  let visualHtml = "";
  if (variant === "urgent") {
    visualHtml =
      '<span class="executive-insight-card__icon executive-insight-card__icon--urgent" aria-hidden="true">🔔</span>';
  } else {
    const vehicleSrc = resolveInsightVehicleImageSrc(plate);
    visualHtml = vehicleSrc
      ? `<img src="${escapeHtml(vehicleSrc)}" alt="" class="executive-insight-card__vehicle-img" loading="lazy" />`
      : '<span class="executive-insight-card__icon" aria-hidden="true">🚐</span>';
  }

  return `<article class="executive-insight-card executive-insight-card--${t}">
    <div class="executive-insight-card__content">
      <h3 class="executive-insight-card__title">${escapeHtml(label)}</h3>
      <strong class="executive-insight-card__plate">${escapeHtml(plate || "—")}</strong>
      ${metaHtml}
      <a href="${escapeHtml(detailHref)}" class="executive-insight-card__cta">Detayları Gör →</a>
    </div>
    ${visualHtml}
  </article>`;
}

function executiveInsightMetric(props) {
  return executiveInsightCard(props);
}

function executiveInsightsHtml(context) {
  const profitMeta =
    context.mostProfitable.value != null && Number.isFinite(context.mostProfitable.value)
      ? money(context.mostProfitable.value)
      : "Veri bekleniyor";
  const costMeta =
    context.highestCost.value != null && Number.isFinite(context.highestCost.value)
      ? money(context.highestCost.value)
      : "Veri bekleniyor";

  const metrics = context.hasData
    ? [
        executiveInsightCard({
          label: "En Kârlı Araç",
          plate: context.mostProfitable.plate,
          meta: profitMeta,
          tone: "success",
          vehicleId: context.mostProfitable.vehicleId,
        }),
        executiveInsightCard({
          label: "En Riskli Araç",
          plate: context.highestRisk.plate,
          meta: context.highestRisk.reason || "İncelenmeli",
          tone: "danger",
          vehicleId: context.highestRisk.vehicleId,
        }),
        executiveInsightCard({
          label: "En Masraflı Araç",
          plate: context.highestCost.plate,
          meta: costMeta,
          tone: "warning",
          vehicleId: context.highestCost.vehicleId,
        }),
        executiveInsightCard({
          label: "Acil Müdahale Gereken",
          plate: context.immediateAttention.plate,
          meta: context.immediateAttention.reason || "İncelenmeli",
          tone: "info",
          vehicleId: context.immediateAttention.vehicleId,
          variant: "urgent",
        }),
      ].join("")
    : executiveEmptyNote(
        "Araç zekâsı verisi henüz oluşmadı.",
        "Gelir, gider ve operasyon kayıtları tamamlandıkça içgörüler otomatik üretilecektir."
      );

  return `<section class="executive-insights-panel executive-insights-panel--prominent fade-in" aria-label="Yönetici içgörüleri">
    <header class="executive-insights-panel__head">
      <div>
        <h2 class="executive-insights-panel__title">Yönetici İçgörüleri</h2>
        <p class="executive-insights-panel__subtitle">Kârlılık, risk ve maliyet özeti</p>
      </div>
      <a href="/executive-vehicle-dashboard" class="btn btn--ghost btn--sm">Araç Zekâsı →</a>
    </header>
    <div class="executive-insights-panel__body">${metrics}</div>
  </section>`;
}

function executiveCommandCenter(context) {
  const {
    fleetStatus,
    criticalVehicles,
    totalActiveRiskCount,
    briefRecommendation,
    primaryRecommendation,
    primaryCta,
    hasData,
  } = context;

  const centerTone = fleetStatus.centerTone || "stable";
  const brief = hasData
    ? briefRecommendation || primaryRecommendation
    : "Veri izleniyor.";
  const cta = primaryCta || { label: "İzlemeye Devam Et", href: "/" };
  const activeRisk =
    totalActiveRiskCount != null
      ? totalActiveRiskCount
      : Number(criticalVehicles || 0);

  return `<section class="executive-command-center executive-command-center--${escapeHtml(centerTone)} fade-in" aria-label="Yönetici komut merkezi">
    <header class="executive-command-center__status">
      <span class="executive-command-center__status-label">Filo Durumu</span>
      <strong class="executive-command-center__status-value">${escapeHtml(fleetStatus.label)}</strong>
    </header>
    <div class="executive-command-center__metrics">
      <article class="executive-command-center__metric executive-command-center__metric--danger">
        <span>Kritik Araç</span>
        <strong>${Number(criticalVehicles).toLocaleString("tr-TR")}</strong>
      </article>
      <article class="executive-command-center__metric">
        <span>Toplam Aktif Risk</span>
        <strong>${Number(activeRisk).toLocaleString("tr-TR")}</strong>
      </article>
    </div>
    <p class="executive-command-center__brief">${escapeHtml(brief)}</p>
    <div class="executive-command-center__action">
      <a href="${escapeHtml(cta.href)}" class="btn btn--sm btn--primary executive-command-center__action-btn">${escapeHtml(cta.label)}</a>
    </div>
  </section>`;
}

function executiveCommandBar(context) {
  return executiveCommandCenter(context);
}

function signalSeverity(row) {
  const signals = row.signals || [];
  if (signals.some((s) => s.level === "critical")) return 0;
  if (signals.some((s) => s.level === "warning")) return 1;
  return 2;
}

function primarySignalReason(row) {
  const critical = (row.signals || []).find((s) => s.level === "critical");
  if (critical?.message) return critical.message;
  const warning = (row.signals || []).find((s) => s.level === "warning");
  if (warning?.message) return warning.message;
  if (row.compliance?.status === "expired" || row.compliance?.status === "critical") {
    return "Uygunluk evrakı kritik";
  }
  if (row.maintenance?.status === "overdue") return "Gecikmiş bakım";
  if (row.tire?.seasonal_status === "mismatch") return "Lastik sezon uyumsuzluğu";
  return "Operasyonel izleme gerekli";
}

function buildVehicleDecisionInsights(vehicles = [], summary = {}) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const hasVehicles = list.length > 0;

  const byProfit = hasVehicles
    ? [...list].sort((a, b) => (b.finance?.net_profit || 0) - (a.finance?.net_profit || 0))[0]
    : null;
  const byExpense = hasVehicles
    ? [...list].sort((a, b) => (b.finance?.total_expense || 0) - (a.finance?.total_expense || 0))[0]
    : null;
  const byRisk = hasVehicles
    ? [...list].sort((a, b) => {
        const diff = signalSeverity(a) - signalSeverity(b);
        if (diff !== 0) return diff;
        return (a.finance?.net_profit || 0) - (b.finance?.net_profit || 0);
      })[0]
    : null;

  const actionVehicles = list.filter(
    (v) =>
      (v.signals || []).some((s) => s.level === "critical" || s.level === "warning") ||
      ["expired", "critical"].includes(v.compliance?.status) ||
      v.maintenance?.status === "overdue" ||
      v.tire?.seasonal_status === "mismatch"
  );

  const primaryReason =
    actionVehicles.length > 0 ? primarySignalReason(actionVehicles[0]) : "Kritik sinyal bulunmuyor";

  return {
    hasVehicles,
    mostProfitable: byProfit,
    mostRisky: byRisk,
    highestExpense: byExpense,
    actionCount: actionVehicles.length,
    primaryReason,
    summary,
  };
}

function vehicleDecisionCardsHtml(insights) {
  const plate = (row) => escapeHtml(formatPlateDisplay(row?.plate) || row?.plate || "—");

  if (!insights.hasVehicles) {
    return executiveDecisionGrid(
      [
        executiveDecisionCard({
          label: "En Karlı Araç",
          value: "Veri bekleniyor",
          meta: "Öncelik: araç gelir/gider kayıtları tamamlanmalı · analiz otomatik oluşacaktır.",
          tone: "neutral",
        }),
        executiveDecisionCard({
          label: "En Riskli Araç",
          value: "Veri bekleniyor",
          meta: "İlk kayıt sonrası risk skoru üretilecektir · İncelenmeli.",
          tone: "neutral",
        }),
        executiveDecisionCard({
          label: "En Çok Masraf Yapan",
          value: "Veri bekleniyor",
          meta: "Öncelik: masraf kayıtları girilmeli · Masraf kontrolü başlayacaktır.",
          tone: "neutral",
        }),
        executiveDecisionCard({
          label: "Aksiyon Gerektiren",
          value: "0 araç",
          meta: "Araç envanteri oluşturulduğunda öncelik listesi burada görünecek.",
          tone: "info",
        }),
      ].join("")
    );
  }

  const profitMeta =
    insights.mostProfitable?.finance?.net_profit > 0
      ? `Kar koruma · ${money(insights.mostProfitable?.finance?.net_profit || 0)}`
      : "Kârlılık verisi sınırlı · gelir kaydı kontrol edilmeli";
  const riskMeta = `${primarySignalReason(insights.mostRisky)} · İncelenmeli`;
  const expenseMeta = `Masraf kontrolü · ${money(insights.highestExpense?.finance?.total_expense || 0)}`;

  return executiveDecisionGrid(
    [
      executiveDecisionCard({
        label: "En Karlı Araç",
        value: plate(insights.mostProfitable),
        meta: profitMeta,
        tone: "success",
      }),
      executiveDecisionCard({
        label: "En Riskli Araç",
        value: plate(insights.mostRisky),
        meta: riskMeta,
        tone: "danger",
      }),
      executiveDecisionCard({
        label: "En Çok Masraf Yapan",
        value: plate(insights.highestExpense),
        meta: expenseMeta,
        tone: "warning",
      }),
      executiveDecisionCard({
        label: "Aksiyon Gerektiren Araçlar",
        value: `${insights.actionCount} araç`,
        meta:
          insights.actionCount > 0
            ? `Öncelik: ${insights.primaryReason}`
            : "Kritik sinyal yok · rutin izleme yeterli",
        tone: insights.actionCount > 0 ? "warning" : "success",
      }),
    ].join("")
  );
}

function buildComplianceRiskSummary({ kpi = {}, upcoming = [] }) {
  const criticalCount = (kpi.expired || 0) + (kpi.within7 || 0);
  const sorted = [...(upcoming || [])].sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  const mostCritical = sorted[0] || null;

  let executiveComment = "Uygunluk verisi izleniyor — kritik evrak bulunmuyor.";
  if (mostCritical) {
    const plate = formatPlateDisplay(mostCritical.plate) || mostCritical.plate || "Seçili araç";
    const docType = mostCritical.type_label || "evrak";
    if (mostCritical.status === "expired") {
      executiveComment = `${plate} için ${docType} süresi geçmiş — acil yenileme gerekli.`;
    } else if (mostCritical.daysLeft != null && mostCritical.daysLeft <= 7) {
      executiveComment = `${plate} için ${docType} öncelikli takip edilmeli (${mostCritical.daysLeft} gün).`;
    } else {
      executiveComment = `${plate} için ${docType} ve ilişkili belgeler öncelikli takip edilmeli.`;
    }
  } else if ((kpi.expired || 0) === 0 && (kpi.within30 || 0) === 0) {
    executiveComment = "30 gün içinde bitecek kritik evrak bulunmuyor.";
  }

  return {
    kpi,
    criticalCount,
    mostCritical,
    executiveComment,
    hasData: sorted.length > 0 || criticalCount > 0 || (kpi.within60 || 0) > 0,
  };
}

function complianceRiskSummaryPanel(risk) {
  const { kpi, criticalCount, mostCritical, executiveComment, hasData } = risk;
  const plate = mostCritical
    ? escapeHtml(formatPlateDisplay(mostCritical.plate) || mostCritical.plate || "—")
    : "—";
  const docType = mostCritical ? escapeHtml(mostCritical.type_label || "—") : "—";
  const daysRemaining =
    mostCritical?.daysLeft != null
      ? mostCritical.daysLeft < 0
        ? `${Math.abs(mostCritical.daysLeft)} gün geçmiş`
        : `${mostCritical.daysLeft} gün`
      : "—";

  const upcomingMini =
    risk.upcomingRowsHtml ||
    (hasData
      ? ""
      : executiveEmptyNote(
          "Uygunluk verisi henüz oluşmadı.",
          "İlk evrak kaydı girildiğinde risk analizi otomatik üretilecektir."
        ));

  return `<section class="panel executive-panel executive-panel--info executive-panel--risk fade-in compliance-risk-panel">
    <header class="panel__head executive-panel__head">
      <h2 class="panel__title executive-panel__title">Risk Özeti</h2>
      <p class="panel__desc executive-panel__subtitle">Uygunluk ve evrak yenileme öncelikleri</p>
    </header>
    <div class="panel__body executive-panel__body">
      <div class="executive-risk-metrics">
        <article class="executive-risk-metric executive-risk-metric--warning">
          <span>30 gün içinde bitecek</span>
          <strong>${Number((kpi.within30 || 0) + (kpi.within7 || 0)).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric">
          <span>60 gün içinde bitecek</span>
          <strong>${Number(kpi.within60 || 0).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric executive-risk-metric--danger">
          <span>Süresi geçen</span>
          <strong>${Number(kpi.expired || 0).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric executive-risk-metric--critical">
          <span>Kritik evrak</span>
          <strong>${Number(criticalCount).toLocaleString("tr-TR")}</strong>
        </article>
      </div>

      <div class="executive-risk-highlight">
        <h3 class="executive-risk-highlight__title">En Kritik Araç</h3>
        <div class="executive-risk-highlight__row">
          <span>Plaka</span><strong>${plate}</strong>
        </div>
        <div class="executive-risk-highlight__row">
          <span>Evrak</span><strong>${docType}</strong>
        </div>
        <div class="executive-risk-highlight__row">
          <span>Kalan süre</span><strong>${escapeHtml(daysRemaining)}</strong>
        </div>
      </div>

      ${executiveInsight({
        title: "Yönetici Yorumu",
        action: executiveComment,
        tone: criticalCount > 0 ? "danger" : hasData ? "warning" : "info",
      })}

      ${upcomingMini}
    </div>
  </section>`;
}

function buildTireIntelligence({ seasonalReport = null, summary = {}, vehicleCount = 0 }) {
  const seasonal = seasonalReport?.summary || {};
  const totalVehicles = seasonal.total_vehicles || vehicleCount || 0;
  const unknown = seasonal.unknown || 0;
  const ready = seasonal.ready || 0;
  const mismatch = seasonal.mismatch || 0;
  const attention = seasonal.attention || 0;
  const hasRecords = (summary.total_records || 0) > 0;

  const vehicles = seasonalReport?.vehicles || [];
  const worst = vehicles.find((v) => v.status === "mismatch") || vehicles.find((v) => v.status === "attention") || null;

  let criticalRisk = "Lastik verisi henüz oluşmadı — envanter kaydı bekleniyor.";
  if (hasRecords && worst) {
    const p = formatPlateDisplay(worst.plate) || worst.plate || "—";
    criticalRisk = `${p} — ${worst.status_label || worst.status}`;
  } else if (hasRecords && unknown > 0) {
    criticalRisk = `${unknown} araçta lastik sezon verisi bilinmiyor.`;
  } else if (hasRecords) {
    criticalRisk = "Kritik lastik uyumsuzluğu bulunmuyor.";
  }

  let executiveAction = "Öncelik: aktif araçlar için ilk lastik envanteri oluşturulmalı.";
  if (unknown > 0) {
    executiveAction = `Öncelik: ${unknown} araç için lastik envanteri girilmeli.`;
  } else if (mismatch > 0) {
    executiveAction = `${mismatch} araçta sezon uyumsuzluğu — değişim planı oluşturun.`;
  } else if (attention > 0) {
    executiveAction = `${attention} araç lastik değişimi için izlenmeli.`;
  } else if (hasRecords) {
    executiveAction = "Sezon uyumu dengeli — rutin izleme yeterli.";
  }

  return {
    seasonalReport,
    totalVehicles,
    unknown,
    ready,
    mismatch,
    attention,
    hasRecords,
    currentSeasonLabel: seasonalReport?.current_season_label || "—",
    requiredSeasonLabel: seasonalReport?.required_tire_season_label || "—",
    criticalRisk,
    executiveAction,
    dataStatus:
      unknown > 0
        ? `${unknown} araçta lastik sezon verisi eksik — veri bekleniyor`
        : hasRecords
          ? "Lastik envanter verisi mevcut"
          : "Lastik verisi henüz oluşmadı — ilk kayıt sonrası sezon analizi otomatik üretilecektir",
  };
}

function tireIntelligencePanel(intel) {
  return `<section class="panel executive-panel executive-panel--info executive-panel--intel fade-in tire-intel-panel">
    <header class="panel__head executive-panel__head">
      <h2 class="panel__title executive-panel__title">Lastik Zekâsı</h2>
      <p class="panel__desc executive-panel__subtitle">Sezon uyumu ve envanter risk özeti</p>
    </header>
    <div class="panel__body executive-panel__body">
      <div class="executive-intel-block">
        <h3 class="executive-intel-block__title">Lastik Veri Durumu</h3>
        <p class="executive-intel-block__value">${escapeHtml(intel.dataStatus)}</p>
      </div>

      <div class="executive-risk-metrics executive-risk-metrics--compact">
        <article class="executive-risk-metric executive-risk-metric--success">
          <span>Sezon hazır</span>
          <strong>${Number(intel.ready).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric">
          <span>Veri eksik</span>
          <strong>${Number(intel.unknown).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric executive-risk-metric--danger">
          <span>Uyumsuz</span>
          <strong>${Number(intel.mismatch).toLocaleString("tr-TR")}</strong>
        </article>
      </div>

      <div class="executive-intel-block">
        <h3 class="executive-intel-block__title">Sezon Uyumu</h3>
        <p class="executive-intel-block__meta">${escapeHtml(intel.currentSeasonLabel)} dönemi · gerekli: ${escapeHtml(intel.requiredSeasonLabel)}</p>
      </div>

      <div class="executive-intel-block">
        <h3 class="executive-intel-block__title">En Kritik Lastik Riski</h3>
        <p class="executive-intel-block__value">${escapeHtml(intel.criticalRisk)}</p>
      </div>

      ${executiveInsight({
        title: "Yönetici Aksiyonu",
        action: intel.executiveAction,
        tone: intel.mismatch > 0 ? "danger" : intel.unknown > 0 ? "warning" : intel.hasRecords ? "success" : "info",
      })}
    </div>
  </section>`;
}

function buildMaintenanceIntelligence({ scheduleReport = null, summary = {}, vehicleCount = 0 }) {
  const sched = scheduleReport?.summary || {};
  const overdue = sched.overdue || 0;
  const due = sched.due || 0;
  const upcoming = sched.upcoming || 0;
  const unknown = sched.unknown || 0;
  const totalSchedules = sched.total || 0;
  const recordCount = summary.total_records || 0;
  const maintainedVehicles = summary.vehicles_with_maintenance || 0;
  const fleetSize = vehicleCount || 0;
  const missingPlan = fleetSize > 0 ? Math.max(0, fleetSize - maintainedVehicles) : 0;
  const hasRecords = recordCount > 0;
  const hasSchedule = totalSchedules > 0;

  let dataStatus =
    "Bakım verisi henüz oluşmadı. İlk bakım kaydı girildiğinde plan, uyarı ve maliyet analizi otomatik üretilecektir.";
  if (hasRecords && missingPlan > 0) {
    dataStatus = `${missingPlan} araçta bakım geçmişi eksik — plan analizi kısmi.`;
  } else if (hasRecords) {
    dataStatus = `${recordCount} bakım kaydı mevcut — plan ve maliyet analizi aktif.`;
  } else if (fleetSize > 0) {
    dataStatus = `${fleetSize} aktif araç var; bakım kaydı henüz girilmedi.`;
  }

  let executiveAction = "Öncelik: aktif araçlar için ilk bakım kayıtları oluşturulmalı.";
  if (overdue > 0) {
    executiveAction = `Öncelik: ${overdue} gecikmiş bakım için acil servis planı oluşturun.`;
  } else if (due > 0) {
    executiveAction = `Öncelik: ${due} bakım vadesi geldi — randevu planlayın.`;
  } else if (upcoming > 0) {
    executiveAction = `${upcoming} yaklaşan bakım kalemi izlenmeli — servis takvimi gözden geçirilmeli.`;
  } else if (hasRecords && missingPlan > 0) {
    executiveAction = `Öncelik: ${missingPlan} araç için ilk bakım geçmişi tamamlanmalı.`;
  } else if (hasRecords) {
    executiveAction = "Bakım planı dengeli — rutin izleme yeterli.";
  }

  return {
    dataStatus,
    missingPlan,
    overdue,
    due,
    upcoming,
    dueCount: due + overdue,
    unknown,
    totalSchedules,
    recordCount,
    executiveAction,
    hasRecords,
    hasSchedule,
    insightTone: overdue > 0 ? "danger" : due > 0 || upcoming > 0 ? "warning" : hasRecords ? "success" : "info",
  };
}

function maintenanceIntelligencePanel(intel) {
  return `<section class="panel executive-panel executive-panel--info executive-panel--intel fade-in maintenance-intel-panel">
    <header class="panel__head executive-panel__head">
      <h2 class="panel__title executive-panel__title">Bakım Zekâsı</h2>
      <p class="panel__desc executive-panel__subtitle">Plan, uyarı ve servis risk özeti</p>
    </header>
    <div class="panel__body executive-panel__body">
      <div class="executive-intel-block">
        <h3 class="executive-intel-block__title">Bakım Veri Durumu</h3>
        <p class="executive-intel-block__value">${escapeHtml(intel.dataStatus)}</p>
      </div>
      <div class="executive-risk-metrics executive-risk-metrics--maint">
        <article class="executive-risk-metric">
          <span>Bakım Planı Eksik Araç</span>
          <strong>${Number(intel.missingPlan).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric executive-risk-metric--warning">
          <span>Yaklaşan Bakım</span>
          <strong>${Number(intel.upcoming).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric executive-risk-metric--danger">
          <span>Gecikmiş Bakım</span>
          <strong>${Number(intel.overdue).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="executive-risk-metric">
          <span>Vadesi Gelen</span>
          <strong>${Number(intel.due).toLocaleString("tr-TR")}</strong>
        </article>
      </div>
      ${executiveInsight({
        title: "Yönetici Aksiyonu",
        action: intel.executiveAction,
        tone: intel.insightTone,
      })}
    </div>
  </section>`;
}

function healthScoreLabel(score) {
  if (score == null || !Number.isFinite(score)) return "Veri bekleniyor";
  return `${Math.round(score)}/100`;
}

function vehicleRiskReason(vehicle) {
  if (vehicle?.recommendation) return vehicle.recommendation;
  const top = (vehicle?.top_risks || [])[0];
  if (top?.message) return top.message;
  if (vehicle?.risk_level === "critical") return "Kritik sağlık sinyali";
  if (vehicle?.risk_level === "high") return "Yüksek operasyonel risk";
  return "İncelenmeli";
}

function deriveFleetHealthRecommendation(topVehicles, commandCtx) {
  const risky = (topVehicles || []).filter((v) => v?.plate);
  if (risky.length >= 2) {
    const plates = risky
      .slice(0, 2)
      .map((v) => formatPlateDisplay(v.plate) || v.plate)
      .join(" ve ");
    return `Öncelik: ${plates} araçları incelenmeli.`;
  }
  if (risky.length === 1) {
    const plate = formatPlateDisplay(risky[0].plate) || risky[0].plate;
    return `Öncelik: ${plate} incelenmeli — ${vehicleRiskReason(risky[0])}`;
  }
  if ((commandCtx.complianceRisk?.expired || 0) > 0) {
    return "Öncelik: süresi geçen evraklar için Uygunluk Merkezi kontrol edilmeli.";
  }
  if ((commandCtx.maintenanceRisk?.overdue || 0) > 0) {
    return "Öncelik: gecikmiş bakım planı oluşturulmalı.";
  }
  return commandCtx.primaryRecommendation || "Filo sağlığı izleniyor — kritik sinyal bulunmuyor.";
}

function buildFleetHealthCenterContext(bundle = {}) {
  const commandCtx = buildDashboardCommandBarContext(bundle);
  let healthReport = { summary: {}, vehicles: [] };
  try {
    healthReport = vehicleHealthService.buildFleetVehicleHealthReport({ referenceDate: new Date() });
  } catch {
    /* safe fallback */
  }

  const summary = healthReport.summary || {};
  const vehicles = healthReport.vehicles || [];
  const criticalVehicleCount = (summary.critical || 0) + (summary.risk || 0);
  const topRisky = vehicles
    .filter((v) => ["critical", "risk", "watch", "unknown"].includes(v.health_status))
    .slice(0, 3);
  const topRiskVehicles = topRisky.length > 0 ? topRisky : vehicles.slice(0, Math.min(3, vehicles.length));
  const executiveRecommendation = deriveFleetHealthExecutiveRecommendation(commandCtx, bundle);

  return {
    averageScore: summary.average_health_score,
    averageScoreLabel: healthScoreLabel(summary.average_health_score),
    criticalVehicles: commandCtx.criticalVehicles ?? criticalVehicleCount,
    complianceRisk: (commandCtx.complianceRisk?.within30 || 0) + (commandCtx.complianceRisk?.expired || 0),
    maintenanceRisk: (commandCtx.maintenanceRisk?.due || 0) + (commandCtx.maintenanceRisk?.overdue || 0),
    tireRisk: commandCtx.tireRisk?.warnings || 0,
    topRiskVehicles: topRiskVehicles.map((v) => ({
      vehicle_id: v.vehicle_id,
      plate: v.plate,
      score: v.health_score,
      scoreLabel: healthScoreLabel(v.health_score),
      riskLevel: v.risk_level,
      reason: vehicleRiskReason(v),
    })),
    executiveRecommendation,
    recommendation: deriveFleetHealthRecommendation(topRiskVehicles, commandCtx),
    hasHealthData: summary.average_health_score != null || vehicles.length > 0,
  };
}

function fleetHealthCenterHtml(context) {
  const riskItems = context.topRiskVehicles.length
    ? context.topRiskVehicles
        .map(
          (v) => `<li class="fleet-health-center__risk-item">
            <a class="fleet-health-center__risk-plate plate-link" href="/vehicle/${escapeHtml(v.vehicle_id)}">${escapeHtml(formatPlateDisplay(v.plate) || v.plate || "—")}</a>
            <span class="fleet-health-center__risk-score">${escapeHtml(v.scoreLabel)}</span>
            <span class="fleet-health-center__risk-reason">${escapeHtml(v.reason)}</span>
          </li>`
        )
        .join("")
    : `<li class="fleet-health-center__risk-item fleet-health-center__risk-item--empty">Risk sıralaması için araç verisi bekleniyor.</li>`;

  const scoreTone =
    context.averageScore == null
      ? "muted"
      : context.averageScore >= 70
        ? "good"
        : context.averageScore >= 50
          ? "watch"
          : "bad";

  const rec = context.executiveRecommendation || { intro: "", bullets: [] };
  const bulletItems = (rec.bullets || [])
    .map((line) => `<li class="fleet-health-center__recommendation-item">${escapeHtml(line)}</li>`)
    .join("");

  return `<section class="fleet-health-center fade-in" aria-label="Filo sağlık merkezi">
    <header class="fleet-health-center__head">
      <div>
        <h2 class="fleet-health-center__title">Filo Sağlık Merkezi</h2>
        <p class="fleet-health-center__subtitle">Filo sağlık durumu özeti</p>
      </div>
      <a href="/vehicle-health" class="btn btn--ghost btn--sm">Araç Sağlık Skoru →</a>
    </header>
    <div class="fleet-health-center__body">
      <div class="fleet-health-center__score fleet-health-center__score--${scoreTone}">
        <span class="fleet-health-center__score-label">Genel Filo Sağlık Skoru</span>
        <strong class="fleet-health-center__score-value">${escapeHtml(context.averageScoreLabel)}</strong>
      </div>
      <div class="fleet-health-center__metrics">
        <article class="fleet-health-center__metric fleet-health-center__metric--danger">
          <span>Kritik Araç</span>
          <strong>${Number(context.criticalVehicles).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="fleet-health-center__metric">
          <span>Uygunluk Riski</span>
          <strong>${Number(context.complianceRisk).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="fleet-health-center__metric fleet-health-center__metric--warning">
          <span>Bakım Riski</span>
          <strong>${Number(context.maintenanceRisk).toLocaleString("tr-TR")}</strong>
        </article>
        <article class="fleet-health-center__metric">
          <span>Lastik Riski</span>
          <strong>${Number(context.tireRisk).toLocaleString("tr-TR")}</strong>
        </article>
      </div>
      <div class="fleet-health-center__risk-list-wrap">
        <h3 class="fleet-health-center__risk-title">En Riskli 3 Araç</h3>
        <ul class="fleet-health-center__risk-list">${riskItems}</ul>
      </div>
      <div class="fleet-health-center__recommendation">
        <h3 class="fleet-health-center__recommendation-title">Yönetici Önerisi</h3>
        <p class="fleet-health-center__recommendation-intro">${escapeHtml(rec.intro || "")}</p>
        <ul class="fleet-health-center__recommendation-list">${bulletItems}</ul>
      </div>
    </div>
  </section>`;
}

module.exports = {
  executiveInsight,
  executiveDecisionCard,
  executiveDecisionGrid,
  executiveEmptyNote,
  deriveFleetStatusLabel,
  derivePrimaryAction,
  derivePrimaryActionCTA,
  deriveCommandCenterBrief,
  buildDashboardCommandBarContext,
  executiveCommandCenter,
  executiveCommandBar,
  buildVehicleDecisionInsights,
  vehicleDecisionCardsHtml,
  buildComplianceRiskSummary,
  complianceRiskSummaryPanel,
  buildTireIntelligence,
  tireIntelligencePanel,
  buildMaintenanceIntelligence,
  maintenanceIntelligencePanel,
  buildFleetHealthCenterContext,
  fleetHealthCenterHtml,
  buildExecutiveRiskRadarContext,
  executiveRiskRadarHtml,
  buildExecutiveInsightsContext,
  executiveInsightsHtml,
};
