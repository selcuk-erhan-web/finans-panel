const { PDFParse } = require("pdf-parse");

/** pdf-parse v2 — buffer → düz metin */
async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    if (typeof result === "string") return result;
    if (result && typeof result.text === "string") return result.text;
    return String(result || "");
  } finally {
    await parser.destroy();
  }
}

module.exports = { extractPdfText };
