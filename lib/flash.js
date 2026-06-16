const FLASH_MESSAGES = {
  vehicle_added: "Araç başarıyla eklendi.",
  vehicle_updated: "Araç güncellendi.",
  vehicle_deleted: "Araç silindi.",
  vehicle_add_failed: "Araç eklenemedi.",
  vehicle_update_failed: "Araç güncellenemedi.",
  income_added: "Gelir kaydı eklendi.",
  income_updated: "Gelir kaydı güncellendi.",
  income_deleted: "Gelir kaydı silindi.",
  expense_added: "Gider kaydı eklendi.",
  expense_updated: "Gider kaydı güncellendi.",
  expense_deleted: "Gider kaydı silindi.",
  maintenance_added: "Bakım kaydı eklendi.",
  maintenance_updated: "Bakım kaydı güncellendi.",
  maintenance_deleted: "Bakım kaydı silindi.",
  maintenance_done: "Bakım tamamlandı olarak işaretlendi.",
  fuel_added: "Yakıt kaydı eklendi.",
  fuel_updated: "Yakıt kaydı güncellendi.",
  fuel_deleted: "Yakıt kaydı silindi.",
  fuel_imported: "Yakıt Excel dosyası başarıyla içe aktarıldı.",
  fuel_add_failed: "Yakıt kaydı eklenemedi.",
  fuel_update_failed: "Yakıt kaydı güncellenemedi.",
  hakedis_imported: "Hakediş PDF başarıyla içe aktarıldı.",
  demo_purged: "Demo/test verileri temizlendi. Yedek backups/ klasörüne alındı.",
  demo_purge_failed: "Temizlik başarısız.",
  password_updated: "Şifre güncellendi.",
};

function redirectWithFlash(res, url, key) {
  const msg = FLASH_MESSAGES[key] || key;
  const sep = url.includes("?") ? "&" : "?";
  res.redirect(`${url}${sep}ok=${encodeURIComponent(key)}&msg=${encodeURIComponent(msg)}`);
}

function redirectWithError(res, url, message, key = "error") {
  const sep = url.includes("?") ? "&" : "?";
  res.redirect(
    `${url}${sep}err=1&msg=${encodeURIComponent(message || FLASH_MESSAGES[key] || "Bir hata oluştu.")}`
  );
}

function getFlashFromQuery(query) {
  if (!query.ok && !query.err) return null;
  return {
    type: query.err ? "error" : "success",
    message: query.msg || (query.err ? "Bir hata oluştu." : "İşlem başarılı."),
  };
}

module.exports = { redirectWithFlash, redirectWithError, getFlashFromQuery, FLASH_MESSAGES };
