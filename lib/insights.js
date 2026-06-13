const { money } = require("./finance");

function generateFinanceInsight({ totals, summaries, servis, turizm, expenseByCat }) {
  const lines = [];

  if (!summaries.length) {
    return "Henüz araç tanımlı değil. Filo oluşturduktan sonra gelir ve gider kayıtlarıyla analiz üretilebilir.";
  }

  const profitable = summaries.filter((v) => v.net > 0);
  const losing = summaries.filter((v) => v.net < 0);
  const empty = summaries.filter((v) => v.income === 0 && v.expense === 0);

  if (totals.balance >= 0) {
    lines.push(
      `Genel filo net kârda: ${money(totals.balance)}. Gelirler giderleri karşılıyor.`
    );
  } else {
    lines.push(
      `Dikkat: Toplam net zarar ${money(Math.abs(totals.balance))}. Giderleri gözden geçirmeniz önerilir.`
    );
  }

  if (profitable.length) {
    try {
      const profitabilityService = require("../services/profitabilityService");
      const best = profitabilityService.getMostProfitableVehicle();
      if (best.plate && best.plate !== "—" && best.netProfit != null) {
        lines.push(
          `En karlı araç ${best.plate}: net ${money(best.netProfit)} (gelir ${money(best.income || 0)}, gider ${money(best.totalExpense || 0)}).`
        );
      } else {
        lines.push(`${profitable.length} araç kârlı çalışıyor. En iyi performans bu dönemde görülüyor.`);
      }
    } catch {
      lines.push(`${profitable.length} araç kârlı çalışıyor. En iyi performans bu dönemde görülüyor.`);
    }
  }

  if (losing.length) {
    const names = losing.map((v) => v.plate).join(", ");
    lines.push(
      `${losing.length} araç zararda (${names}). Bu araçların gelir kaydı veya gider kalemleri incelenmeli.`
    );
  }

  if (empty.length) {
    lines.push(
      `${empty.length} araçta henüz işlem yok; kayıt girilmeden analiz eksik kalır.`
    );
  }

  if (servis.count && turizm.count) {
    if (servis.net > turizm.net) {
      lines.push(
        `Servis filosu (${money(servis.net)}) turizm filosundan (${money(turizm.net)}) daha güçlü net üretiyor.`
      );
    } else if (turizm.net > servis.net) {
      lines.push(
        `Turizm filosu nette önde. Servis tarafında gelir artışı veya gider kontrolü değerlendirilebilir.`
      );
    } else {
      lines.push("Servis ve turizm filoları benzer net performans gösteriyor.");
    }
  }

  const topExpense = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1])[0];
  if (topExpense && topExpense[1] > 0) {
    const share = totals.expense
      ? Math.round((topExpense[1] / totals.expense) * 100)
      : 0;
    lines.push(
      `En yüksek gider kalemi "${topExpense[0]}" (${money(topExpense[1])}, yaklaşık %${share} pay).`
    );
  }

  if (totals.income > 0 && totals.expense > totals.income) {
    lines.push(
      "Gider/gelir oranı %100 üzerinde; yakıt, bakım ve sigorta kalemlerinde tasarruf fırsatı olabilir."
    );
  }

  const totalV = summaries.length;
  if (totalV > 0) {
    const greenPct = Math.round((profitable.length / totalV) * 100);
    const redPct = Math.round((losing.length / totalV) * 100);
    lines.push(
      `Durum analizi: Filonun %${greenPct}'i kârlı (yeşil), %${redPct}'i zararlı (kırmızı) görünüyor.`
    );
    if (redPct > 40) {
      lines.push(
        "Kırmızı bölge uyarısı: Zararlı araç oranı yüksek; gelir artışı veya ortak gider optimizasyonu önceliklendirilmeli."
      );
    }
    if (greenPct >= 60 && totals.balance >= 0) {
      lines.push(
        "Yeşil bölge: Filo genel olarak sağlıklı; mevcut performansı korumak için kayıt disiplinini sürdürün."
      );
    }
  }

  return lines.join(" ");
}

function generateExecutiveProfitComment({
  summary,
  mostProfitable,
  leastProfitable,
  expenseBreakdown,
  hasData,
  vehicleCount,
}) {
  if (!vehicleCount) {
    return "Kârlılık analizi için araç bazlı gelir ve gider verisi gerekli.";
  }
  if (!hasData) {
    return "Araç eşleştirmesi yapılınca sonuçlar burada görünecek. Gelir/gider kayıtları eklendikçe yönetici özeti oluşacak.";
  }

  const parts = [];
  if (summary.totalNet > 0) {
    parts.push(`Filoda net kâr pozitif (${money(summary.totalNet)}).`);
  } else if (summary.totalNet < 0) {
    parts.push(`Filoda net zarar var (${money(Math.abs(summary.totalNet))}).`);
  } else {
    parts.push("Filoda net durum dengede.");
  }

  if (mostProfitable?.plate && mostProfitable.plate !== "—" && mostProfitable.netProfit != null) {
    parts.push(
      `En güçlü katkı ${mostProfitable.plate} aracından geliyor (${money(mostProfitable.netProfit)}).`
    );
  }

  if (
    leastProfitable?.plate &&
    leastProfitable.plate !== "—" &&
    leastProfitable.netProfit != null &&
    leastProfitable.netProfit < 0
  ) {
    parts.push(`Riskli araç: ${leastProfitable.plate} (${money(leastProfitable.netProfit)}).`);
  }

  const expenseEntries = Object.entries(expenseBreakdown || {}).filter(([, v]) => v > 0);
  if (expenseEntries.length) {
    const labels = { fuel: "yakıt", hgs: "HGS/OGS", maintenance: "bakım", other: "diğer giderler" };
    expenseEntries.sort((a, b) => b[1] - a[1]);
    const [topKey] = expenseEntries[0];
    parts.push(`En yüksek gider kalemi ${labels[topKey] || topKey}.`);
  }

  return parts.join(" ");
}

module.exports = { generateFinanceInsight, generateExecutiveProfitComment };
