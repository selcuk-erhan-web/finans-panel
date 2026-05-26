function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function transactionsToCsv(rows, type) {
  const headers = ["ID", "Araç", "Tip", "Kategori", "Tutar", "Açıklama", "Tarih"];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.id,
        r.plate || "-",
        type === "income" ? "Gelir" : "Gider",
        r.category || "-",
        r.amount,
        r.note || "",
        String(r.date || "").slice(0, 19),
      ]
        .map(escapeCsv)
        .join(",")
    );
  });
  return "\uFEFF" + lines.join("\n");
}

module.exports = { transactionsToCsv };
