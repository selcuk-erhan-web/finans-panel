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
    lines.push(
      `${profitable.length} araç kârlı çalışıyor. En iyi performans bu dönemde görülüyor.`
    );
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

module.exports = { generateFinanceInsight };
