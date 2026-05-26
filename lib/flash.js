const FLASH_MESSAGES = {
  vehicle_added: "Araç başarıyla eklendi.",
  vehicle_updated: "Araç güncellendi.",
  vehicle_deleted: "Araç silindi.",
  income_added: "Gelir kaydı eklendi.",
  income_updated: "Gelir kaydı güncellendi.",
  income_deleted: "Gelir kaydı silindi.",
  expense_added: "Gider kaydı eklendi.",
  expense_updated: "Gider kaydı güncellendi.",
  expense_deleted: "Gider kaydı silindi.",
};

function redirectWithFlash(res, url, key) {
  const msg = FLASH_MESSAGES[key] || key;
  const sep = url.includes("?") ? "&" : "?";
  res.redirect(`${url}${sep}ok=${encodeURIComponent(key)}&msg=${encodeURIComponent(msg)}`);
}

function getFlashFromQuery(query) {
  if (!query.ok && !query.err) return null;
  return {
    type: query.err ? "error" : "success",
    message: query.msg || (query.err ? "Bir hata oluştu." : "İşlem başarılı."),
  };
}

module.exports = { redirectWithFlash, getFlashFromQuery, FLASH_MESSAGES };
