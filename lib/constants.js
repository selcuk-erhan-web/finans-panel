const { getCategoryNames } = require("../lib/expenseCategoryMap");

module.exports = {
  INCOME_CATEGORIES: ["Servis Geliri", "Turizm Geliri", "Diğer Gelir"],
  get EXPENSE_CATEGORIES() {
    return getCategoryNames();
  },
  MAINTENANCE_TYPES: [
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
