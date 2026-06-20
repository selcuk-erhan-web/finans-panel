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
};
