const { formatDateDisplay } = require("../utils/date");
const {
  MAINTENANCE_TYPES,
  LEGACY_MAINTENANCE_TYPES,
  TIRE_SEASONS,
  TIRE_STATUSES,
  TIRE_POSITIONS,
  TIRE_CHANGE_TYPES,
} = require("../lib/constants");

const FIELD_LABELS = {
  cost: "Maliyet",
  amount: "Maliyet",
  total_cost: "Toplam Maliyet",
  odometer_km: "KM",
  last_odometer_km: "Son KM",
  km: "KM",
  maintenance_type: "Bakım Türü",
  maintenance_date: "Bakım Tarihi",
  vendor: "Servis / Tedarikçi",
  description: "Açıklama",
  season: "Sezon",
  status: "Durum",
  position: "Pozisyon",
  brand: "Marka",
  model: "Model",
  size: "Ebat",
  dot: "DOT",
  tread_depth_mm: "Diş Derinliği",
  quantity: "Adet",
  change_type: "İşlem Türü",
  change_date: "Değişim Tarihi",
  expiration_date: "Bitiş Tarihi",
  expiry_date: "Bitiş Tarihi",
  effective_date: "Başlangıç Tarihi",
  issue_date: "Başlangıç Tarihi",
  purchase_date: "Satın Alma Tarihi",
  document_type: "Evrak Türü",
  policy_number: "Poliçe No",
  insurance_company: "Sigorta Şirketi",
  insurer: "Sigorta Şirketi",
  premium_amount: "Prim",
  file_name: "Dosya",
  file_path: "Dosya Yolu",
  station: "İstasyon",
  result: "Sonuç",
  title: "Başlık",
  note: "Not",
  notes: "Notlar",
  plate: "Plaka",
  vehicle_id: "Araç",
  tire_id: "Lastik",
  reminder_days: "Hatırlatma Günü",
};

const CURRENCY_FIELDS = new Set(["cost", "amount", "total_cost", "premium_amount"]);
const KM_FIELDS = new Set(["odometer_km", "last_odometer_km", "km"]);

const IMPORTANT_FIELDS = new Set([
  "cost",
  "amount",
  "total_cost",
  "odometer_km",
  "last_odometer_km",
  "km",
  "maintenance_date",
  "expiration_date",
  "expiry_date",
  "effective_date",
  "issue_date",
  "status",
  "season",
  "change_type",
]);

const GROUP_ORDER = ["Finans", "Tarih / KM", "Durum / Sezon", "Evrak", "Genel"];

const GROUP_FIELD_MAP = {
  Finans: new Set(["cost", "amount", "total_cost", "premium_amount"]),
  "Tarih / KM": new Set([
    "odometer_km",
    "last_odometer_km",
    "km",
    "maintenance_date",
    "change_date",
    "issue_date",
    "purchase_date",
    "effective_date",
    "expiration_date",
    "expiry_date",
  ]),
  "Durum / Sezon": new Set(["season", "status", "position", "change_type"]),
  Evrak: new Set([
    "document_type",
    "policy_number",
    "insurer",
    "insurance_company",
    "file_name",
    "file_path",
    "station",
    "result",
    "title",
    "expiration_date",
    "expiry_date",
    "effective_date",
    "issue_date",
  ]),
};

const ENUM_MAP = buildEnumMap();

function buildEnumMap() {
  const map = {};
  const add = (field, entries) => {
    if (!map[field]) map[field] = {};
    entries.forEach(([key, label]) => {
      map[field][key] = label;
    });
  };
  add("season", TIRE_SEASONS);
  add("status", TIRE_STATUSES);
  add("position", TIRE_POSITIONS);
  add("change_type", TIRE_CHANGE_TYPES);
  add("maintenance_type", [...MAINTENANCE_TYPES, ...LEGACY_MAINTENANCE_TYPES]);
  return map;
}

function lookupEnum(field, value) {
  if (value == null) return null;
  const key = String(value);
  if (ENUM_MAP[field]?.[key]) return ENUM_MAP[field][key];
  if (field === "document_type") {
    try {
      const { DOCUMENT_TYPES } = require("./documentService");
      return DOCUMENT_TYPES?.[key] || null;
    } catch {
      return null;
    }
  }
  return null;
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function fallbackFieldLabel(field) {
  return String(field || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fieldLabel(field) {
  return FIELD_LABELS[field] || fallbackFieldLabel(field);
}

function detectChangeType(oldValue, newValue) {
  const oldEmpty = isEmptyValue(oldValue);
  const newEmpty = isEmptyValue(newValue);
  if (oldEmpty && !newEmpty) return "added";
  if (!oldEmpty && newEmpty) return "removed";
  return "modified";
}

function isDateField(field) {
  return (
    field.endsWith("_date") ||
    field === "created_at" ||
    field === "updated_at" ||
    field === "expiration_date" ||
    field === "effective_date" ||
    field === "expiry_date" ||
    field === "issue_date"
  );
}

function formatFieldValue(field, value) {
  if (isEmptyValue(value)) return "—";

  if (CURRENCY_FIELDS.has(field)) {
    const n = Number(value);
    if (Number.isFinite(n)) return `${n.toLocaleString("tr-TR")} TL`;
  }

  if (KM_FIELDS.has(field)) {
    const n = Number(value);
    if (Number.isFinite(n)) return `${n.toLocaleString("tr-TR")} km`;
  }

  if (isDateField(field)) {
    return formatDateDisplay(String(value).slice(0, 10));
  }

  const enumLabel = lookupEnum(field, value);
  if (enumLabel) return enumLabel;

  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function isPastDate(value) {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < new Date().toISOString().slice(0, 10);
}

function resolveImportance(field, _oldValue, newValue) {
  if (field === "status" && String(newValue) === "disposed") return "critical";
  if (field === "status" && String(newValue) === "expired") return "critical";
  if ((field === "expiry_date" || field === "expiration_date") && isPastDate(newValue)) {
    return "critical";
  }
  if (IMPORTANT_FIELDS.has(field)) return "important";
  return "normal";
}

function resolveGroup(field) {
  if (GROUP_FIELD_MAP.Finans.has(field)) return "Finans";
  if (GROUP_FIELD_MAP["Tarih / KM"].has(field)) return "Tarih / KM";
  if (GROUP_FIELD_MAP["Durum / Sezon"].has(field)) return "Durum / Sezon";
  if (GROUP_FIELD_MAP.Evrak.has(field)) return "Evrak";
  if (field.endsWith("_date")) return "Tarih / KM";
  return "Genel";
}

function formatAuditChanges(changes = [], _options = {}) {
  if (!Array.isArray(changes)) return [];

  return changes
    .filter((row) => row && row.field)
    .map((row) => {
      const field = String(row.field);
      const old_value = row.old_value === undefined ? null : row.old_value;
      const new_value = row.new_value === undefined ? null : row.new_value;
      const change_type = detectChangeType(old_value, new_value);

      return {
        field,
        label: fieldLabel(field),
        old_value,
        new_value,
        old_display: formatFieldValue(field, old_value),
        new_display: formatFieldValue(field, new_value),
        change_type,
        importance: resolveImportance(field, old_value, new_value),
      };
    });
}

function groupAuditChanges(formattedChanges = []) {
  const grouped = new Map();
  for (const change of formattedChanges || []) {
    const group = resolveGroup(change.field);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(change);
  }

  return GROUP_ORDER.filter((name) => grouped.has(name)).map((group) => ({
    group,
    changes: grouped.get(group),
  }));
}

function enrichAuditDiff(record) {
  const changes = record?.metadata?.changes;
  if (!Array.isArray(changes) || !changes.length) {
    return {
      formatted_changes: [],
      change_groups: [],
      change_count: 0,
    };
  }

  const formatted_changes = formatAuditChanges(changes);
  const change_groups = groupAuditChanges(formatted_changes);
  return {
    formatted_changes,
    change_groups,
    change_count: formatted_changes.length,
  };
}

module.exports = {
  FIELD_LABELS,
  fieldLabel,
  formatFieldValue,
  detectChangeType,
  formatAuditChanges,
  groupAuditChanges,
  enrichAuditDiff,
};
