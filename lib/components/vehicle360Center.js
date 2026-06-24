const { escapeHtml } = require("./escape");
const { money } = require("../finance");
const { formatPlateDisplay } = require("../../utils/plate");
const { formatDateDisplay } = require("../../utils/date");
const { statusPill, typeBadge, vehicleEmoji } = require("./fleet");
const { executiveKpi, executiveKpiGrid, executiveHubHeader } = require("./executiveDesign");
const { executiveInsight } = require("./executiveIntelligence");
const { vehicleImageForVehicle, vehicleDisplayType } = require("../vehicleInsightImages");
const { buildVehicleActionIntelligence } = require("../intelligence/vehicleActionIntelligence");
const { buildVehicleHealthIntelligence } = require("../intelligence/vehicleHealthIntelligence");
const { buildPredictiveMaintenanceIntelligence } = require("../intelligence/predictiveMaintenanceIntelligence");
const { buildVehicleExecutiveScoreboard } = require("../intelligence/vehicleExecutiveScoreboard");
const documentService = require("../../services/documentService");

const COMPLIANCE_KEYS = [
  { key: "inspection", label: "Muayene" },
  { key: "traffic_insurance", label: "Trafik Sigortası" },
  { key: "casco", label: "Kasko" },
  { key: "seat_insurance", label: "Koltuk Ferdi Kaza" },
];

function v360Empty(title, hint = "") {
  return `<div class="v360-empty">
    <p class="v360-empty__title">${escapeHtml(title)}</p>
    ${hint ? `<p class="v360-empty__hint">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

function v360Badge(label, tone) {
  return `<span class="v360-badge v360-badge--${tone}">${escapeHtml(label)}</span>`;
}

function activityBadge(bundle) {
  const km = Number(bundle.vehicle?.current_km ?? bundle.vehicle?.km) || 0;
  const txCount = (bundle.incomeCount || 0) + (bundle.expenseCount || 0);
  if (txCount > 0 || km > 0) return v360Badge("Aktif", "success");
  const hasMaint = (bundle.maintenanceHistory?.records || []).length > 0;
  const hasDocs = (bundle.documents || []).length > 0;
  if (hasMaint || hasDocs) return v360Badge("Aktif", "success");
  if (km === 0 && txCount === 0 && bundle.vehicle?.plate) return v360Badge("Pasif", "neutral");
  return v360Badge("Bilinmiyor", "info");
}

function profitBadge(bundle) {
  const net = bundle.profit?.netProfit ?? bundle.summary?.net ?? 0;
  if (!bundle.hasFinancialData && net === 0) return v360Badge("İzlenmeli", "info");
  if (net > 0) return v360Badge("Kârlı", "success");
  if (net < 0) return v360Badge("Zararda", "danger");
  return v360Badge("Dengede", "neutral");
}

function riskBadgeHtml(bundle) {
  const level =
    bundle.profitRisk?.risk?.risk_level ||
    bundle.intelligence?.risk?.level ||
    (bundle.summary?.net < 0 ? "high" : "low");
  if (level === "critical" || level === "high") return v360Badge("Yüksek Risk", "danger");
  if (level === "medium") return v360Badge("Riskli", "warning");
  return v360Badge("Temiz", "success");
}

function profitStatusLabel(bundle) {
  const net = bundle.profit?.netProfit ?? bundle.summary?.net ?? 0;
  if (!bundle.hasFinancialData && net === 0) return "Veri bekleniyor";
  if (net > 0) return "Kârlı";
  if (net < 0) return "Zararda";
  return "Dengede";
}

function sumTireExpense(bundle) {
  return (bundle.tireChangeHistory?.records || []).reduce(
    (sum, row) => sum + (Number(row.cost) || 0),
    0
  );
}

function complianceRiskCount(docs) {
  return (docs || []).filter((d) =>
    ["expired", "critical", "warning"].includes(d.status)
  ).length;
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

function buildManagerRecommendation(bundle, complianceDocs) {
  const notes = [];
  const profit = bundle.profit || {};
  const net = profit.netProfit ?? 0;

  if (net > 0) notes.push("Araç kârlı görünüyor.");
  else if (net < 0) notes.push("Araç zarar yazıyor — maliyet kontrolü önerilir.");
  else if (!bundle.hasFinancialData) notes.push("Finansal kayıt tamamlandıkça özet güçlenecektir.");

  const riskCount = complianceRiskCount(complianceDocs);
  if (riskCount > 0) notes.push(`${riskCount} uygunluk riski aktif.`);

  if (!complianceDocs.length) notes.push("Uygunluk verisi eksik.");
  if (!(bundle.tireStatus?.records || []).length) notes.push("Lastik envanteri bekleniyor.");

  const overdue = (bundle.upcomingMaintenance || []).filter((m) => m.status === "overdue");
  if (overdue.length) notes.push("Gecikmiş bakım planı var.");

  const top = highestExpenseCategory(profit);
  const costNote = top
    ? `Bu araçta ana maliyet kalemi ${top} görünüyor.`
    : "Maliyet dağılımı henüz oluşmadı.";

  return `${costNote} ${notes.join(" ")}`.trim();
}

function buildComplianceRows(vehicleId) {
  const docs = documentService.listByVehicle(vehicleId);
  const byType = new Map(docs.map((d) => [d.document_type, d]));

  return COMPLIANCE_KEYS.map(({ key, label }) => {
    const doc = byType.get(key);
    if (!doc) {
      return { label, expiry: "—", status: "Eksik", days: null, tone: "neutral" };
    }
    const tone =
      doc.status === "expired" || doc.status === "critical"
        ? "danger"
        : doc.status === "warning"
          ? "warning"
          : doc.status === "ok"
            ? "success"
            : "info";
    return {
      label,
      expiry: doc.expiry_date ? formatDateDisplay(doc.expiry_date) : "—",
      status: doc.status_label || doc.status,
      days: doc.daysLeft,
      tone,
    };
  });
}

function buildDecisionStrip(bundle, complianceDocs) {
  const profit = bundle.profit || {};
  const net = profit.netProfit ?? bundle.summary?.net ?? 0;
  const hasIncome = (profit.income || 0) > 0;
  const hasExpense = (profit.totalExpense || 0) > 0;
  const complianceMissing = !complianceDocs.length;
  const complianceRisk = complianceRiskCount(complianceDocs);
  const tireMissing = !(bundle.tireStatus?.records || []).length;
  const tireWarn =
    (bundle.tireSeasonalStatus?.alerts || []).length > 0 ||
    bundle.tireSeasonalStatus?.status === "attention";
  const maintOverdue = (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue");
  const maintDue = (bundle.upcomingMaintenance || []).some(
    (m) => m.status === "upcoming" || m.status === "overdue"
  );

  let netStatus = "İzlenmeli";
  if (net > 0) netStatus = "Kârlı";
  else if (net < 0) netStatus = "Zararda";
  else if (!hasIncome && hasExpense) netStatus = "İzlenmeli";
  else if (hasIncome && !hasExpense) netStatus = "Kârlı";

  let primaryRisk = "Yok";
  if (complianceRisk > 0 || complianceMissing) primaryRisk = "Uygunluk";
  else if (tireMissing || tireWarn) primaryRisk = "Lastik";
  else if (maintOverdue || maintDue) primaryRisk = "Bakım";
  else if (net < 0) primaryRisk = "Finans";

  const topCost = highestExpenseCategory(profit);
  const topCostLabel = topCost ? topCost : "Henüz oluşmadı";

  const notes = [];
  if (net < 0 && topCost) notes.push(`ana maliyet ${topCost}`);
  else if (net > 0) notes.push("gider kontrolü normal");
  else if (!hasIncome && hasExpense) notes.push("gelir verisi eksik, gider oluşmuş");
  else if (!bundle.hasFinancialData) notes.push("finansal kayıt bekleniyor");

  if (complianceMissing) notes.push("uygunluk verisi eksik");
  else if (complianceRisk > 0) notes.push("uygunluk riski aktif");
  if (tireMissing) notes.push("lastik verisi eksik");
  if (maintOverdue) notes.push("gecikmiş bakım var");

  let managerAction;
  if (net < 0) {
    managerAction = `Zararda${topCost ? ` — ana maliyet ${topCost}` : ""}. ${
      complianceMissing || tireMissing
        ? "Uygunluk ve lastik verisi eksik."
        : "Maliyet kalemleri gözden geçirilmeli."
    }`;
  } else if (net > 0 && primaryRisk === "Yok") {
    managerAction = "Kârlı — gider kontrolü normal. Rutin izleme yeterli.";
  } else if (!hasIncome && hasExpense) {
    managerAction = "İzlenmeli — gelir verisi eksik, gider oluşmuş.";
  } else if (primaryRisk !== "Yok") {
    managerAction = `${netStatus} — öncelik ${primaryRisk.toLowerCase()}. ${notes.slice(0, 2).join(", ")}.`;
  } else {
    managerAction = `${netStatus} — rutin izleme yeterli.`;
  }

  return { netStatus, primaryRisk, topCostLabel, managerAction };
}

function netStatusTone(netStatus) {
  if (netStatus === "Kârlı") return "success";
  if (netStatus === "Zararda") return "danger";
  return "warning";
}

function conciseActionText(text, max = 58) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1)}…`;
}

function conciseManagerAction(text) {
  return conciseActionText(text, 72);
}

function buildFocusManagerAction(bundle, complianceDocs, decision, actionIntel) {
  const parts = [];
  const complianceMissing = !complianceDocs.length;
  const complianceRisk = complianceRiskCount(complianceDocs) > 0;
  const net = bundle.profit?.netProfit ?? bundle.summary?.net ?? 0;

  if (complianceMissing || complianceRisk) parts.push("evrak");
  if (
    !(bundle.maintenanceHistory?.records || []).length ||
    (bundle.upcomingMaintenance || []).some((m) => m.status === "overdue")
  ) {
    parts.push("bakım");
  }
  if (net < 0 || actionIntel.financialActions.length) parts.push("maliyet");
  if (
    !(bundle.tireStatus?.records || []).length &&
    decision.primaryRisk === "Lastik"
  ) {
    parts.push("lastik");
  }

  if (!parts.length) return "Rutin izleme yeterli";
  const label = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" + ");
  return `${label} kontrolü`;
}

function vehicle360FocusStripHtml(bundle, complianceDocs, actionIntel, predictiveMaint) {
  const decision = buildDecisionStrip(bundle, complianceDocs);
  const action = actionIntel || buildVehicleActionIntelligence(bundle, complianceDocs);
  const maint = predictiveMaint || buildPredictiveMaintenanceIntelligence(bundle);
  const maintReview = conciseActionText(maint.nextReviewLabel, 36);

  const cards = [
    {
      label: "Araç Sağlığı",
      value: `${action.score} / 100`,
      meta: action.status,
      icon: "◆",
      tone: action.tone,
    },
    {
      label: "Net Durum",
      value: decision.netStatus,
      meta: profitStatusLabel(bundle),
      icon: "●",
      tone: netStatusTone(decision.netStatus),
    },
    {
      label: "Ana Risk",
      value: decision.primaryRisk,
      meta: decision.primaryRisk === "Yok" ? "Kritik sinyal yok" : "Öncelikli alan",
      icon: "◎",
      tone: decision.primaryRisk === "Yok" ? "success" : "warning",
    },
    {
      label: "Bakım Tahmini",
      value: maint.status,
      meta: maintReview,
      icon: "⚙",
      tone: maint.tone,
    },
    {
      label: "Yönetici Aksiyonu",
      value: buildFocusManagerAction(bundle, complianceDocs, decision, action),
      meta: "Bugün odak",
      icon: "→",
      tone: action.tone === "danger" ? "danger" : netStatusTone(decision.netStatus),
      wide: true,
    },
  ];

  const body = cards
    .map(
      (c) => `<article class="vehicle-focus-card vehicle-focus-card--${c.tone}${c.wide ? " vehicle-focus-card--wide" : ""}">
      <span class="vehicle-focus-card__icon" aria-hidden="true">${c.icon}</span>
      <span class="vehicle-focus-card__label">${escapeHtml(c.label)}</span>
      <strong class="vehicle-focus-card__value">${escapeHtml(c.value)}</strong>
      ${c.meta ? `<span class="vehicle-focus-card__meta">${escapeHtml(c.meta)}</span>` : ""}
    </article>`
    )
    .join("");

  return `<section class="vehicle-focus-strip fade-in" aria-label="Executive Focus Strip">${body}</section>`;
}

function vehicle360ExecutiveScoreboardHtml(bundle, complianceDocs, actionIntel, healthIntel, maintenanceIntel) {
  const action = actionIntel || buildVehicleActionIntelligence(bundle, complianceDocs);
  const health = healthIntel || buildVehicleHealthIntelligence(bundle, complianceDocs);
  const maint = maintenanceIntel || buildPredictiveMaintenanceIntelligence(bundle);
  const scoreboard = buildVehicleExecutiveScoreboard(
    bundle,
    action,
    health,
    maint,
    complianceDocs
  );

  const body = scoreboard.cards
    .map(
      (card) => `<article class="vehicle-score-card vehicle-score-card--${card.tone}">
      <span class="vehicle-score-card__label">${escapeHtml(card.label)}</span>
      <strong class="vehicle-score-card__value">${escapeHtml(card.value)}</strong>
      <span class="vehicle-score-card__meta">${escapeHtml(card.meta)}</span>
    </article>`
    )
    .join("");

  return `<section class="vehicle-executive-scoreboard fade-in" aria-label="Vehicle Executive Scoreboard">${body}</section>`;
}

function buildVehicleCommandMetrics(bundle, complianceDocs, actionIntel, predictiveMaint) {
  const profit = bundle.profit || {};
  const monthly = bundle.monthly || {};
  const incomeSeries = monthly.incomeData || [];
  const expenseSeries = monthly.expenseData || [];
  const hasMonthlySeries = incomeSeries.length > 0;
  const lastIdx = hasMonthlySeries ? incomeSeries.length - 1 : 0;
  const monthIncome = hasMonthlySeries ? Number(incomeSeries[lastIdx] || 0) : 0;
  const monthExpense = hasMonthlySeries ? Number(expenseSeries[lastIdx] || 0) : 0;
  const useMonthlySlice = hasMonthlySeries && (monthIncome > 0 || monthExpense > 0);

  const incomeLabel = useMonthlySlice ? "Bu Ay Gelir" : "Toplam Gelir";
  const expenseLabel = useMonthlySlice ? "Bu Ay Gider" : "Toplam Gider";
  const incomeAmount = useMonthlySlice ? monthIncome : Number(profit.income || 0);
  const expenseAmount = useMonthlySlice ? monthExpense : Number(profit.totalExpense || 0);

  const intel = actionIntel || buildVehicleActionIntelligence(bundle, complianceDocs);
  const maintIntel =
    predictiveMaint || buildPredictiveMaintenanceIntelligence(bundle);

  return {
    income: {
      label: incomeLabel,
      value: money(incomeAmount),
      tone: incomeAmount > 0 ? "success" : "neutral",
    },
    expense: {
      label: expenseLabel,
      value: money(expenseAmount),
      tone: expenseAmount > 0 ? "warning" : "neutral",
    },
    maintenance: {
      label: "Bakım Tahmini",
      value: maintIntel.status,
      meta: maintIntel.nextReviewLabel,
      tone: maintIntel.tone,
    },
    health: {
      label: "Araç Sağlığı",
      value: `${intel.score} / 100`,
      meta: intel.status,
      tone: intel.tone,
    },
  };
}

function vehicle360CommandMetricsHtml(bundle, complianceDocs, actionIntel, predictiveMaint) {
  const metrics = buildVehicleCommandMetrics(bundle, complianceDocs, actionIntel, predictiveMaint);
  const items = [metrics.income, metrics.expense, metrics.health, metrics.maintenance];

  const body = items
    .map(
      (m) => `<article class="vehicle-360-command-metric vehicle-360-command-metric--${m.tone}">
      <span class="vehicle-360-command-metric__label">${escapeHtml(m.label)}</span>
      <strong class="vehicle-360-command-metric__value">${escapeHtml(m.value)}</strong>
      ${m.meta ? `<span class="vehicle-360-command-metric__meta">${escapeHtml(m.meta)}</span>` : ""}
    </article>`
    )
    .join("");

  return `<aside class="vehicle-360-command-metrics" aria-label="Komut metrikleri">${body}</aside>`;
}

function vehicle360ExecutiveHeroHtml(bundle, complianceDocs, actionIntel, predictiveMaint) {
  const { vehicle } = bundle;
  const meta = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" · ");
  const displayType = vehicleDisplayType(vehicle);
  const km = vehicle.current_km ?? vehicle.km;
  const kmStr =
    km != null && Number(km) > 0 ? `${Number(km).toLocaleString("tr-TR")} km` : null;
  const vid = vehicle.id;
  const imageSrc = vehicleImageForVehicle(vehicle);

  const mediaClass = imageSrc
    ? "vehicle-360-hero__media vehicle-360-hero__media--has-image"
    : "vehicle-360-hero__media";

  const media = imageSrc
    ? `<div class="vehicle-360-hero__image-stage"><img src="${escapeHtml(imageSrc)}" alt="" class="vehicle-360-hero__image" width="400" height="260" loading="eager" decoding="async" /></div>`
    : `<span class="vehicle-360-hero__fallback" aria-hidden="true">${vehicleEmoji(vehicle.type)}</span>`;

  const actions = [
    { href: `/vehicle-intelligence?vehicle_id=${vid}`, label: "Araç Zekâsı" },
    { href: `/maintenance?vehicle_id=${vid}`, label: "Bakım" },
    { href: `/tires?vehicle_id=${vid}`, label: "Lastik" },
    { href: `/documents?vehicle_id=${vid}`, label: "Evraklar" },
    { href: `/income/service?vehicle_id=${vid}`, label: "Gelir/Gider" },
  ]
    .map(
      (a) =>
        `<a href="${escapeHtml(a.href)}" class="vehicle-360-hero__pill">${escapeHtml(a.label)}</a>`
    )
    .join("");

  const metaLine = [
    meta || displayType,
    typeBadge(vehicle.type),
    kmStr ? `<span class="vehicle-360-hero__km">${kmStr}</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<section class="vehicle-360-hero vehicle-360-hero--command-center" aria-label="Vehicle Executive Command Center">
    <div class="${mediaClass}">${media}</div>
    <div class="vehicle-360-hero__content">
      <p class="vehicle-360-hero__eyebrow">Vehicle Executive Command Center</p>
      <h1 class="vehicle-360-hero__title">${escapeHtml(formatPlateDisplay(vehicle.plate) || vehicle.plate)}</h1>
      <p class="vehicle-360-hero__meta">${metaLine}</p>
      <div class="vehicle-360-hero__badges">
        ${activityBadge(bundle)}
        ${profitBadge(bundle)}
        ${riskBadgeHtml(bundle)}
        ${statusPill(bundle.summary)}
      </div>
      <nav class="vehicle-360-hero__actions" aria-label="Hızlı işlemler">${actions}</nav>
    </div>
    ${vehicle360CommandMetricsHtml(bundle, complianceDocs, actionIntel, predictiveMaint)}
  </section>`;
}

function vehicle360PredictiveMaintenanceHtml(bundle) {
  const intel = buildPredictiveMaintenanceIntelligence(bundle);

  const signals = intel.maintenanceSignals
    .map(
      (signal) => `<article class="predictive-maintenance__signal predictive-maintenance__signal--${signal.tone}">
      <span class="predictive-maintenance__signal-label">${escapeHtml(signal.label)}</span>
      <strong class="predictive-maintenance__signal-value">${escapeHtml(signal.value)}</strong>
      <em class="predictive-maintenance__signal-meta">${escapeHtml(signal.meta)}</em>
    </article>`
    )
    .join("");

  const riskList = intel.riskFactors.length
    ? `<ul class="predictive-maintenance__risk-list">${intel.riskFactors
        .map((factor) => `<li>${escapeHtml(factor)}</li>`)
        .join("")}</ul>`
    : `<p class="predictive-maintenance__risk-empty">Aktif bakım risk faktörü bulunmuyor.</p>`;

  return `<section class="predictive-maintenance predictive-maintenance--${intel.tone} fade-in" aria-label="Predictive Maintenance Intelligence">
    <header class="predictive-maintenance__head">
      <h2 class="predictive-maintenance__title">Predictive Maintenance Intelligence</h2>
      <p class="predictive-maintenance__desc">Bakım riski, plan disiplini ve gözden geçirme zamanı</p>
    </header>
    <div class="predictive-maintenance__grid">
      <article class="predictive-maintenance__score">
        <span class="predictive-maintenance__score-label">Bakım Risk Skoru</span>
        <strong class="predictive-maintenance__score-value">${intel.score}<small>/ 100</small></strong>
        <p class="predictive-maintenance__score-status">${escapeHtml(intel.status)}</p>
        <p class="predictive-maintenance__score-review">${escapeHtml(intel.nextReviewLabel)}</p>
      </article>
      <div class="predictive-maintenance__signals">${signals}</div>
      <div class="predictive-maintenance__side">
        ${riskList}
        <p class="predictive-maintenance__recommendation">${escapeHtml(intel.executiveRecommendation)}</p>
      </div>
    </div>
  </section>`;
}

function vehicle360ActionIntelligenceHtml(bundle, complianceDocs, options = {}) {
  const compact = Boolean(options.compact);
  const intel = buildVehicleActionIntelligence(bundle, complianceDocs);
  const cards = [
    {
      title: "Kritik Aksiyon",
      icon: "⚠",
      body: intel.criticalActions[0] || "Kritik aksiyon yok.",
      tone: intel.criticalActions.length ? "danger" : "success",
    },
    {
      title: "Finansal Aksiyon",
      icon: "₺",
      body: intel.financialActions[0] || "Finansal takip normal.",
      tone: intel.financialActions.length ? "warning" : "success",
    },
    {
      title: "Operasyonel Aksiyon",
      icon: "◎",
      body: intel.operationalActions[0] || "Operasyonel veri izlenebilir.",
      tone: intel.operationalActions.length ? "info" : "success",
    },
    {
      title: "Yönetici Önerisi",
      icon: "→",
      body: intel.executiveRecommendation,
      meta: `${intel.score} / 100 · ${intel.status}`,
      tone: intel.tone,
    },
  ];

  const body = cards
    .map((c) => {
      const text = compact ? conciseActionText(c.body, 40) : c.body;
      if (compact) {
        return `<article class="vehicle-action-card vehicle-action-card--${c.tone}">
      <span class="vehicle-action-card__icon" aria-hidden="true">${c.icon}</span>
      <h3 class="vehicle-action-card__title">${escapeHtml(c.title)}</h3>
      <p class="vehicle-action-card__body">${escapeHtml(text)}</p>
    </article>`;
      }
      return `<article class="vehicle-action-card vehicle-action-card--${c.tone}">
      <span class="vehicle-action-card__icon" aria-hidden="true">${c.icon}</span>
      <h3 class="vehicle-action-card__title">${escapeHtml(c.title)}</h3>
      <p class="vehicle-action-card__body">${escapeHtml(text)}</p>
      ${c.meta ? `<p class="vehicle-action-card__meta">${escapeHtml(c.meta)}</p>` : ""}
    </article>`;
    })
    .join("");

  const sectionClass = compact
    ? "vehicle-action-intelligence vehicle-action-intelligence--compact fade-in"
    : "vehicle-action-intelligence fade-in";
  const head = compact
    ? `<header class="vehicle-action-intelligence__head vehicle-action-intelligence__head--compact">
      <h2 class="vehicle-action-intelligence__title">Vehicle Action Intelligence</h2>
    </header>`
    : `<header class="vehicle-action-intelligence__head">
      <h2 class="vehicle-action-intelligence__title">Vehicle Action Intelligence</h2>
      <p class="vehicle-action-intelligence__desc">Bu araç için öncelikli yönetici aksiyonları</p>
    </header>`;

  return `<section class="${sectionClass}" aria-label="Vehicle Action Intelligence">
    ${head}
    <div class="vehicle-action-grid">${body}</div>
  </section>`;
}

function activitySourceLabel(source) {
  const map = {
    finance: "Gelir/Gider",
    compliance: "Evrak",
    maintenance: "Bakım",
    tire: "Lastik",
    tire_history: "Lastik",
    system: "Sistem",
    income: "Gelir",
    expense: "Gider",
  };
  return map[source] || source || "Kayıt";
}

function vehicle360HealthDashboardHtml(bundle, complianceDocs) {
  const intel = buildVehicleHealthIntelligence(bundle, complianceDocs);
  const { healthScore, riskRadar, alarms, activity, classification } = intel;

  const breakdownRows = healthScore.breakdown
    ? [
        ["Uygunluk", domainPercentFromBreakdown(healthScore.breakdown.compliance)],
        ["Bakım", domainPercentFromBreakdown(healthScore.breakdown.maintenance)],
        ["Lastik", domainPercentFromBreakdown(healthScore.breakdown.tire)],
        ["Finans", domainPercentFromBreakdown(healthScore.breakdown.finance)],
      ].filter(([, pct]) => pct != null)
    : [];

  const breakdownHtml = breakdownRows.length
    ? `<div class="vehicle-health-score-card__bars">${breakdownRows
        .map(
          ([label, pct]) => `<div class="vehicle-health-score-card__bar">
          <span>${escapeHtml(label)}</span>
          <div class="vehicle-health-score-card__track"><i style="width:${pct}%"></i></div>
          <em>${pct}%</em>
        </div>`
        )
        .join("")}</div>`
    : `<p class="vehicle-health-score-card__meta">${escapeHtml(healthScore.meta || "Skor mevcut kayıtlardan hesaplandı.")}</p>`;

  const scoreCard = `<article class="vehicle-health-score-card vehicle-health-score-card--${healthScore.tone}">
    <header class="vehicle-health-score-card__head">
      <span class="vehicle-health-score-card__label">Health Score</span>
      <strong class="vehicle-health-score-card__value">${healthScore.score ?? "—"}<small>/ 100</small></strong>
    </header>
    <p class="vehicle-health-score-card__status">${escapeHtml(healthScore.statusLabel)}</p>
    ${breakdownHtml}
  </article>`;

  const radarItems = riskRadar.domains.length
    ? riskRadar.domains
        .map(
          (domain, idx) => `<li class="vehicle-health-risk-radar__item vehicle-health-risk-radar__item--${domain.tone}">
          <span class="vehicle-health-risk-radar__rank">${idx + 1}</span>
          <div class="vehicle-health-risk-radar__body">
            <strong>${escapeHtml(domain.label)}</strong>
            <span>Risk Skoru: ${domain.riskScore}</span>
            <em>${escapeHtml(domain.reason || "")}</em>
          </div>
          <div class="vehicle-health-risk-radar__meter" aria-hidden="true"><i style="width:${domain.score}%"></i></div>
        </li>`
        )
        .join("")
    : `<li class="vehicle-health-risk-radar__item vehicle-health-risk-radar__item--success">
        <span class="vehicle-health-risk-radar__rank">—</span>
        <div class="vehicle-health-risk-radar__body">
          <strong>Aktif risk sinyali bulunmuyor</strong>
          <span>Risk Skoru: 0</span>
        </div>
      </li>`;

  const radarCard = `<article class="vehicle-health-risk-radar">
    <header class="vehicle-health-risk-radar__head">
      <h3 class="vehicle-health-risk-radar__title">Risk Radar</h3>
      <p class="vehicle-health-risk-radar__decision">${escapeHtml(riskRadar.decision)}</p>
    </header>
    <ol class="vehicle-health-risk-radar__list">${radarItems}</ol>
  </article>`;

  const classificationCard = `<article class="vehicle-health-classification vehicle-health-classification--${classification.tone}">
    <span class="vehicle-health-classification__label">Vehicle Classification</span>
    <strong class="vehicle-health-classification__value">${escapeHtml(classification.label)}</strong>
    <p class="vehicle-health-classification__desc">${escapeHtml(classification.description)}</p>
  </article>`;

  const alarmBody = alarms.length
    ? alarms
        .map(
          (alarm) => `<li class="vehicle-health-alarm vehicle-health-alarm--${alarm.tone}">
          <span class="vehicle-health-alarm__dot" aria-hidden="true"></span>
          <div class="vehicle-health-alarm__body">
            <strong>${escapeHtml(alarm.title)}</strong>
            <p>${escapeHtml(alarm.message)}</p>
          </div>
        </li>`
        )
        .join("")
    : `<li class="vehicle-health-alarm vehicle-health-alarm--success">
        <span class="vehicle-health-alarm__dot" aria-hidden="true"></span>
        <div class="vehicle-health-alarm__body">
          <strong>Aktif alarm yok</strong>
          <p>Operasyonel alarm merkezi temiz.</p>
        </div>
      </li>`;

  const alarmCard = `<article class="vehicle-health-alarm-center">
    <header class="vehicle-health-alarm-center__head">
      <h3 class="vehicle-health-alarm-center__title">Executive Alarm Center</h3>
      <span class="vehicle-health-alarm-center__count">${alarms.length} sinyal</span>
    </header>
    <ul class="vehicle-health-alarm-center__list">${alarmBody}</ul>
  </article>`;

  const activityBody = activity.length
    ? activity
        .map(
          (item) => `<li class="vehicle-health-activity vehicle-health-activity--${item.tone}">
          <div class="vehicle-health-activity__meta">
            <time>${formatDateDisplay(item.date)}</time>
            <span>${escapeHtml(activitySourceLabel(item.source))}</span>
          </div>
          <strong>${escapeHtml(item.title)}</strong>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
          ${item.amount != null ? `<em>${money(item.amount)}</em>` : ""}
        </li>`
        )
        .join("")
    : `<li class="vehicle-health-activity vehicle-health-activity--neutral">
        <div class="vehicle-health-activity__meta"><span>Son hareket</span></div>
        <strong>Henüz aktivite kaydı yok</strong>
        <p>Gelir, gider ve operasyon kayıtları burada listelenir.</p>
      </li>`;

  const activityCard = `<article class="vehicle-health-activity-stream">
    <header class="vehicle-health-activity-stream__head">
      <h3 class="vehicle-health-activity-stream__title">Recent Activity Stream</h3>
    </header>
    <ol class="vehicle-health-activity-stream__list">${activityBody}</ol>
  </article>`;

  return `<section class="vehicle-health-dashboard fade-in" aria-label="Vehicle Health Intelligence Dashboard">
    <header class="vehicle-health-dashboard__head">
      <h2 class="vehicle-health-dashboard__title">Vehicle Health Intelligence Dashboard</h2>
      <p class="vehicle-health-dashboard__desc">Sağlık skoru, risk radarı, alarmlar ve son aktivite — tek bakışta</p>
    </header>
    <div class="vehicle-health-grid">
      ${scoreCard}
      ${classificationCard}
      ${radarCard}
      ${alarmCard}
      ${activityCard}
    </div>
  </section>`;
}

function domainPercentFromBreakdown(row) {
  if (!row || !row.weight) return null;
  return Math.max(0, Math.min(100, Math.round((row.score / row.weight) * 100)));
}

function vehicle360DecisionStripHtml(bundle, complianceDocs) {
  const decision = buildDecisionStrip(bundle, complianceDocs);
  const cards = [
    {
      label: "Net Durum",
      value: decision.netStatus,
      icon: "●",
      tone: netStatusTone(decision.netStatus),
    },
    {
      label: "Ana Risk",
      value: decision.primaryRisk,
      icon: "◎",
      tone: decision.primaryRisk === "Yok" ? "success" : "warning",
    },
    {
      label: "En Büyük Maliyet",
      value: decision.topCostLabel,
      icon: "₺",
      tone: "info",
    },
    {
      label: "Yönetici Aksiyonu",
      value: conciseManagerAction(decision.managerAction),
      icon: "→",
      tone: netStatusTone(decision.netStatus),
      wide: true,
    },
  ];

  const body = cards
    .map(
      (c) => `<article class="vehicle-360-decision-card vehicle-360-decision-card--${c.tone}${c.wide ? " vehicle-360-decision-card--wide" : ""}">
      <span class="vehicle-360-decision-card__icon" aria-hidden="true">${c.icon}</span>
      <span class="vehicle-360-decision-card__label">${escapeHtml(c.label)}</span>
      <strong class="vehicle-360-decision-card__value">${escapeHtml(c.value)}</strong>
    </article>`
    )
    .join("");

  return `<section class="vehicle-360-decision-strip" aria-label="Yönetici karar şeridi">
    ${body}
  </section>`;
}

function vehicle360HeaderHtml(bundle, complianceDocs) {
  const actionIntel = buildVehicleActionIntelligence(bundle, complianceDocs);
  const healthIntel = buildVehicleHealthIntelligence(bundle, complianceDocs);
  const predictiveMaint = buildPredictiveMaintenanceIntelligence(bundle);
  return `<div class="vehicle-360-identity fade-in">
    ${vehicle360ExecutiveHeroHtml(bundle, complianceDocs, actionIntel, predictiveMaint)}
    ${vehicle360ExecutiveScoreboardHtml(bundle, complianceDocs, actionIntel, healthIntel, predictiveMaint)}
  </div>`;
}

function vehicle360SummaryHtml(bundle, complianceDocs) {
  const profit = bundle.profit || {};
  const tireExpense = sumTireExpense(bundle);
  const riskCount = complianceRiskCount(complianceDocs);

  const kpis = [
    executiveKpi({ label: "Toplam Gelir", value: money(profit.income || 0), tone: "success" }),
    executiveKpi({ label: "Toplam Gider", value: money(profit.totalExpense || 0), tone: "warning" }),
    executiveKpi({
      label: "Net Kâr",
      value: money(profit.netProfit || 0),
      tone: (profit.netProfit || 0) > 0 ? "success" : (profit.netProfit || 0) < 0 ? "danger" : "neutral",
    }),
    executiveKpi({ label: "Yakıt Gideri", value: money(profit.fuel || 0), tone: "info" }),
    executiveKpi({ label: "HGS / OGS", value: money(profit.hgs || 0), tone: "info" }),
    executiveKpi({ label: "Bakım Gideri", value: money(profit.maintenance || 0), tone: "info" }),
    executiveKpi({
      label: "Lastik Gideri",
      value: money(tireExpense),
      tone: "info",
      meta: tireExpense > 0 ? "" : "Kayıt yok",
    }),
    executiveKpi({
      label: "Uygunluk Riski",
      value: String(riskCount),
      tone: riskCount > 0 ? "danger" : "success",
      meta: riskCount > 0 ? "Aktif risk" : "Temiz",
    }),
  ].join("");

  return `<section class="v360-section vehicle-360-kpi-section" aria-label="Yönetici özet kartları"><section class="executive-kpi-grid executive-kpi-grid--compact fade-in" aria-label="Özet göstergeler">${kpis}</section></section>`;
}

function vehicle360FinancialHtml(bundle) {
  const profit = bundle.profit || {};
  const expenseRows = [
    ["Yakıt", profit.fuel],
    ["HGS / OGS", profit.hgs],
    ["Bakım", profit.maintenance],
    ["Personel", profit.personnel],
    ["Taşeron", profit.subcontractor],
    ["Diğer", profit.other],
  ].filter(([, amt]) => Number(amt) > 0);

  const breakdown =
    expenseRows.length > 0
      ? `<ul class="v360-breakdown">${expenseRows
          .map(
            ([label, amt]) =>
              `<li><span>${escapeHtml(label)}</span><strong>${money(amt)}</strong></li>`
          )
          .join("")}</ul>`
      : v360Empty("Henüz gider dağılımı oluşmadı.", "İlk gider kaydı sonrası kategori özeti görünecek.");

  const top = highestExpenseCategory(profit);
  const managerNote = buildManagerRecommendation(bundle, documentService.listByVehicle(bundle.vehicle.id));

  return `<section class="executive-panel v360-panel fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Finansal Görünüm</h2>
      <p class="executive-panel__subtitle">Gelir, gider ve net kâr özeti</p>
    </header>
    <div class="v360-finance-grid">
      <article class="v360-finance-card">
        <span>Toplam Gelir</span>
        <strong class="v360-finance-card__value v360-finance-card__value--pos">${money(profit.income || 0)}</strong>
      </article>
      <article class="v360-finance-card">
        <span>Toplam Gider</span>
        <strong class="v360-finance-card__value v360-finance-card__value--neg">${money(profit.totalExpense || 0)}</strong>
      </article>
      <article class="v360-finance-card v360-finance-card--accent">
        <span>Net Kâr</span>
        <strong class="v360-finance-card__value">${money(profit.netProfit || 0)}</strong>
      </article>
    </div>
    <div class="v360-finance-body">
      <div>
        <h3 class="v360-subtitle">Gider Dağılımı</h3>
        ${breakdown}
        ${top ? `<p class="v360-meta">En yüksek kalem: <strong>${escapeHtml(top)}</strong></p>` : ""}
      </div>
      ${executiveInsight({
        title: "Yönetici Notu",
        body: managerNote,
        tone: (profit.netProfit || 0) < 0 ? "warning" : "info",
      })}
    </div>
  </section>`;
}

function timelineSourceLabel(source) {
  const map = {
    finance: "Gelir/Gider",
    compliance: "Evrak",
    maintenance: "Bakım",
    tire: "Lastik",
    tire_history: "Lastik",
    system: "Sistem",
  };
  return map[source] || source || "Kayıt";
}

function vehicle360TimelineHtml(bundle) {
  const events = (bundle.timeline?.events || []).slice(0, 10);
  const body =
    events.length > 0
      ? `<ol class="v360-timeline">${events
          .map(
            (event) => `<li class="v360-timeline__item v360-timeline__item--${escapeHtml(event.severity || "info")}">
            <div class="v360-timeline__meta">
              <time>${formatDateDisplay(event.event_date)}</time>
              <span>${escapeHtml(timelineSourceLabel(event.source))}</span>
            </div>
            <strong>${escapeHtml(event.title || "—")}</strong>
            <p>${escapeHtml(event.description || "")}</p>
            ${event.amount != null ? `<em>${money(event.amount)}</em>` : ""}
          </li>`
          )
          .join("")}</ol>`
      : v360Empty(
          "Bu araç için operasyon zaman çizelgesi henüz oluşmadı.",
          "Gelir, gider, yakıt, HGS, bakım ve evrak kayıtları burada listelenir."
        );

  return `<section class="executive-panel v360-panel fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Operasyon Zaman Çizelgesi</h2>
      <a href="/vehicle-timeline?vehicle_id=${bundle.vehicle.id}" class="btn btn--ghost btn--sm">Tüm geçmiş →</a>
    </header>
    ${body}
  </section>`;
}

function vehicle360ComplianceHtml(vehicleId) {
  const rows = buildComplianceRows(vehicleId);
  const hasAny = rows.some((r) => r.status !== "Eksik");

  const body = hasAny
    ? `<div class="v360-compliance-grid">${rows
        .map(
          (row) => `<article class="v360-compliance-card v360-compliance-card--${row.tone}">
          <span class="v360-compliance-card__label">${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.expiry)}</strong>
          <em>${escapeHtml(row.status)}</em>
          ${
            row.days != null
              ? `<span class="v360-compliance-card__days">${row.days} gün</span>`
              : ""
          }
        </article>`
        )
        .join("")}</div>`
    : v360Empty(
        "Bu araç için uygunluk verisi eksik.",
        "Muayene, sigorta ve kasko kayıtlarını Uygunluk Merkezi üzerinden ekleyin."
      );

  return `<section class="executive-panel v360-panel fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Uygunluk Durumu</h2>
      <a href="/documents?vehicle_id=${vehicleId}" class="btn btn--ghost btn--sm">Evraklar →</a>
    </header>
    ${body}
  </section>`;
}

function vehicle360MaintenanceHtml(bundle) {
  const { vehicle, maintenanceHistory, maintenanceSchedule, upcomingMaintenance } = bundle;
  const summary = maintenanceHistory?.summary || {};
  const latest = (maintenanceHistory?.records || [])[0];
  const hasPlan = (maintenanceSchedule?.items || []).length > 0;
  const overdue = (upcomingMaintenance || []).filter((m) => m.status === "overdue");

  const body = latest
    ? `<div class="v360-maint-grid">
        <article class="v360-maint-card">
          <span>Son Bakım</span>
          <strong>${escapeHtml(latest.maintenance_type_label || "—")}</strong>
          <em>${formatDateDisplay(latest.maintenance_date)} · ${latest.cost ? money(latest.cost) : "—"}</em>
        </article>
        <article class="v360-maint-card">
          <span>Toplam Bakım Maliyeti</span>
          <strong>${money(summary.total_cost || 0)}</strong>
          <em>${Number(summary.record_count || 0).toLocaleString("tr-TR")} kayıt</em>
        </article>
        <article class="v360-maint-card">
          <span>Yaklaşan Durum</span>
          <strong>${upcomingMaintenance.length ? `${upcomingMaintenance.length} plan` : "Plan yok"}</strong>
          ${overdue.length ? `<em class="v360-warn">${overdue.length} gecikmiş</em>` : `<em>Rutin izleme</em>`}
        </article>
      </div>
      ${
        !hasPlan
          ? `<p class="v360-warn-banner">Bakım planı henüz tanımlanmamış — plan oluşturulması önerilir.</p>`
          : ""
      }`
    : v360Empty(
        "Bu araç için bakım kaydı henüz oluşturulmamış.",
        "İlk bakım kaydı sonrası maliyet ve plan özeti burada görünecek."
      );

  return `<section class="executive-panel v360-panel fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Bakım Özeti</h2>
      <a href="/maintenance?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Bakım Merkezi →</a>
    </header>
    ${body}
  </section>`;
}

function vehicle360TireHtml(bundle) {
  const { vehicle, tireStatus, tireChangeHistory, tireSeasonalStatus } = bundle;
  const onVehicle = tireStatus?.records || [];
  const lastChange = (tireChangeHistory?.records || [])[0];
  const seasonal =
    tireSeasonalStatus?.status_label ||
    tireSeasonalStatus?.current_required_season_label ||
    tireSeasonalStatus?.required_tire_season_label ||
    "—";
  const riskyStatus = new Set(["mismatch", "overdue", "critical", "warning"]);
  const tireRisk = riskyStatus.has(tireSeasonalStatus?.status)
    ? "Yüksek"
    : onVehicle.length
      ? "İzleniyor"
      : "Veri yok";

  const body =
    onVehicle.length || lastChange
      ? `<div class="v360-tire-grid">
          <article class="v360-tire-card">
            <span>Mevcut Sezon / Durum</span>
            <strong>${escapeHtml(seasonal)}</strong>
          </article>
          <article class="v360-tire-card">
            <span>Lastik Envanteri</span>
            <strong>${onVehicle.length} kayıt</strong>
            <em>Araç üzerinde</em>
          </article>
          <article class="v360-tire-card">
            <span>Lastik Riski</span>
            <strong>${escapeHtml(tireRisk)}</strong>
          </article>
          <article class="v360-tire-card">
            <span>Son Lastik Değişimi</span>
            <strong>${lastChange ? escapeHtml(lastChange.change_type_label || "Değişim") : "—"}</strong>
            <em>${lastChange ? formatDateDisplay(lastChange.change_date) : "Kayıt yok"}</em>
          </article>
        </div>`
      : v360Empty(
          "Bu araç için lastik envanteri bekleniyor.",
          "Lastik Merkezi üzerinden sezon ve değişim kayıtları eklenebilir."
        );

  return `<section class="executive-panel v360-panel fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Lastik Özeti</h2>
      <a href="/tires?vehicle_id=${vehicle.id}" class="btn btn--ghost btn--sm">Lastik Merkezi →</a>
    </header>
    ${body}
  </section>`;
}

function vehicle360RecommendationHtml(bundle, complianceDocs) {
  const profit = bundle.profit || {};
  const bullets = [];

  if ((profit.netProfit || 0) > 0) bullets.push("Araç kârlı çalışıyor — gelir koruma öncelikli.");
  else if ((profit.netProfit || 0) < 0) bullets.push("Araç zarar yazıyor — gider kalemleri acil gözden geçirilmeli.");
  else bullets.push("Kârlılık verisi sınırlı — gelir ve gider kayıtları tamamlanmalı.");

  if (!complianceDocs.length) bullets.push("Uygunluk evrakları eksik — evrak tamamlama önerilir.");
  else if (complianceRiskCount(complianceDocs) > 0)
    bullets.push("Aktif uygunluk riski var — yenileme tarihleri kontrol edilmeli.");

  if (!(bundle.tireStatus?.records || []).length) bullets.push("Lastik envanteri eksik — sezon planı oluşturulmalı.");
  if ((bundle.upcomingMaintenance || []).some((m) => m.status === "overdue"))
    bullets.push("Gecikmiş bakım var — servis planı güncellenmeli.");

  const top = highestExpenseCategory(profit);
  if (top) bullets.push(`En yüksek maliyet kalemi: ${top}.`);

  const body = bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("");

  return `<section class="executive-panel v360-panel v360-panel--recommendation fade-in">
    <header class="executive-panel__head">
      <h2 class="executive-panel__title">Yönetici Özeti & Öneri</h2>
    </header>
    <ul class="v360-recommendation-list">${body}</ul>
  </section>`;
}

function vehicle360DetailAccordionsHtml(bundle, complianceDocs) {
  return `<div class="vehicle-detail-accordions fade-in" aria-label="Vehicle 360 detay bölümleri">
    <details class="vehicle-detail-accordion" open>
      <summary class="vehicle-detail-accordion__summary">Finansal Görünüm</summary>
      <div class="vehicle-detail-accordion__body">${vehicle360FinancialHtml(bundle)}</div>
    </details>
    <details class="vehicle-detail-accordion">
      <summary class="vehicle-detail-accordion__summary">Uygunluk &amp; Evrak</summary>
      <div class="vehicle-detail-accordion__body">${vehicle360ComplianceHtml(bundle.vehicle.id)}</div>
    </details>
    <details class="vehicle-detail-accordion" open>
      <summary class="vehicle-detail-accordion__summary">Bakım &amp; Tahmin</summary>
      <div class="vehicle-detail-accordion__body">
        ${vehicle360MaintenanceHtml(bundle)}
        ${vehicle360PredictiveMaintenanceHtml(bundle)}
      </div>
    </details>
    <details class="vehicle-detail-accordion">
      <summary class="vehicle-detail-accordion__summary">Lastik Durumu</summary>
      <div class="vehicle-detail-accordion__body">${vehicle360TireHtml(bundle)}</div>
    </details>
    <details class="vehicle-detail-accordion">
      <summary class="vehicle-detail-accordion__summary">Sağlık Detayları</summary>
      <div class="vehicle-detail-accordion__body">
        ${vehicle360HealthDashboardHtml(bundle, complianceDocs)}
        ${vehicle360RecommendationHtml(bundle, complianceDocs)}
      </div>
    </details>
    <details class="vehicle-detail-accordion">
      <summary class="vehicle-detail-accordion__summary">Operasyon Zaman Çizelgesi</summary>
      <div class="vehicle-detail-accordion__body">${vehicle360TimelineHtml(bundle)}</div>
    </details>
  </div>`;
}

function vehicle360PageHtml(bundle) {
  const complianceDocs = documentService.listByVehicle(bundle.vehicle.id);

  return `<div class="dash page-enter dash--executive executive-hub vehicle-360-center vehicle-360-center--focus vehicle-360-center--scoreboard" data-vehicle-360="1">
    ${executiveHubHeader({
      eyebrow: "Vehicle 360 Center",
      description: "Operasyonel, finansal, uygunluk, bakım, lastik ve risk görünümü — tek ekran.",
    })}
    ${vehicle360HeaderHtml(bundle, complianceDocs)}
    ${vehicle360ActionIntelligenceHtml(bundle, complianceDocs, { compact: true })}
    ${vehicle360SummaryHtml(bundle, complianceDocs)}
    ${vehicle360DetailAccordionsHtml(bundle, complianceDocs)}
  </div>`;
}

module.exports = {
  vehicle360PageHtml,
  buildComplianceRows,
  buildManagerRecommendation,
  buildDecisionStrip,
  buildVehicleCommandMetrics,
  vehicle360DecisionStripHtml,
  vehicle360FocusStripHtml,
  vehicle360ExecutiveScoreboardHtml,
  buildVehicleExecutiveScoreboard: require("../intelligence/vehicleExecutiveScoreboard").buildVehicleExecutiveScoreboard,
  v360Empty,
};
