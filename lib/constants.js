const { getCategoryNames } = require("../lib/expenseCategoryMap");
const { getCategoryNames: getIncomeCategoryNames } = require("../lib/incomeCategoryMap");

module.exports = {
  get INCOME_CATEGORIES() {
    return getIncomeCategoryNames();
  },
  get EXPENSE_CATEGORIES() {
    return getCategoryNames();
  },
  MAINTENANCE_TYPES: [
    ["engine_oil", "Motor Yağı"],
    ["oil_filter", "Yağ Filtresi"],
    ["air_filter", "Hava Filtresi"],
    ["fuel_filter", "Yakıt Filtresi"],
    ["brake_pads", "Fren Balatası"],
    ["brake_discs", "Fren Diski"],
    ["battery", "Akü"],
    ["tires", "Lastik"],
    ["periodic_maintenance", "Periyodik Bakım"],
    ["general_repair", "Genel Onarım"],
    ["inspection", "Muayene"],
    ["other", "Diğer"],
  ],
  /** Legacy maintenance type keys — kept for existing records */
  LEGACY_MAINTENANCE_TYPES: [
    ["yag_bakimi", "Yağ Bakımı"],
    ["lastik", "Lastik"],
    ["fren", "Fren"],
    ["muayene", "Muayene"],
    ["sigorta", "Sigorta"],
    ["periyodik", "Periyodik Bakım"],
    ["diger", "Diğer"],
  ],
  VEHICLE_TARGET: 9,
  UPCOMING_DAYS: 30,
  TIRE_SEASONS: [
    ["summer", "Yazlık"],
    ["winter", "Kışlık"],
    ["all_season", "4 Mevsim"],
  ],
  TIRE_STATUSES: [
    ["on_vehicle", "Araç Üzerinde"],
    ["in_storage", "Depoda"],
    ["disposed", "Hurda / Kullanım Dışı"],
    ["unknown", "Bilinmiyor"],
  ],
  TIRE_POSITIONS: [
    ["front", "Ön"],
    ["rear", "Arka"],
    ["full_set", "Takım"],
    ["spare", "Stepne"],
    ["unknown", "Bilinmiyor"],
  ],
};
