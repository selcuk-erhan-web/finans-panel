const db = require("../lib/db");
const tireService = require("./tireService");
const tireHistoryService = require("./tireHistoryService");
const { seasonLabel } = require("./tireService");
const { changeTypeLabel } = require("./tireHistoryService");

const STATUS_RANK = { mismatch: 0, attention: 1, unknown: 2, ready: 3 };

const STATUS_LABELS = {
  ready: "Hazır",
  attention: "Dikkat",
  mismatch: "Uyumsuz",
  unknown: "Bilinmiyor",
};

const PERIOD_LABELS = {
  summer: "Yazlık",
  winter: "Kışlık",
  transition: "Geçiş Dönemi",
};

function toDateStr(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value || "").slice(0, 10);
}

function getMonthDay(dateStr) {
  const d = toDateStr(dateStr);
  const parts = d.split("-");
  if (parts.length < 3) return 0;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return 0;
  return month * 100 + day;
}

function getSeasonPeriod(referenceDate) {
  const md = getMonthDay(referenceDate);
  if (md >= 1115 || md <= 331) return "winter";
  if (md >= 415 && md <= 1031) return "summer";
  return "transition";
}

function getUpcomingHardSeason(referenceDate) {
  const md = getMonthDay(referenceDate);
  if (md >= 401 && md <= 414) return "summer";
  if (md >= 1101 && md <= 1114) return "winter";
  return null;
}

function getHardRequiredSeason(period) {
  if (period === "winter") return "winter";
  if (period === "summer") return "summer";
  return null;
}

function getRequiredSeasonLabel(period, referenceDate) {
  if (period === "winter") return PERIOD_LABELS.winter;
  if (period === "summer") return PERIOD_LABELS.summer;
  const upcoming = getUpcomingHardSeason(referenceDate);
  if (upcoming === "summer") return `${PERIOD_LABELS.transition} · ${PERIOD_LABELS.summer} hazırlığı`;
  if (upcoming === "winter") return `${PERIOD_LABELS.transition} · ${PERIOD_LABELS.winter} hazırlığı`;
  return PERIOD_LABELS.transition;
}

function seasonMatchesRequired(tireSeason, requiredHardSeason) {
  if (!tireSeason || tireSeason === "unknown") return false;
  if (tireSeason === "all_season") return true;
  return tireSeason === requiredHardSeason;
}

function getStorageTargetSeasons(period, referenceDate) {
  if (period === "winter") return new Set(["winter", "all_season"]);
  if (period === "summer") return new Set(["summer", "all_season"]);
  const upcoming = getUpcomingHardSeason(referenceDate);
  if (upcoming === "summer") return new Set(["summer", "all_season"]);
  if (upcoming === "winter") return new Set(["winter", "all_season"]);
  return new Set(["summer", "winter", "all_season"]);
}

function sumQuantity(records) {
  return records.reduce((sum, row) => sum + (row.quantity || 0), 0);
}

function resolveOnVehicleSeason(onVehicle) {
  if (!onVehicle.length) return "unknown";
  if (onVehicle.some((t) => t.season === "all_season")) return "all_season";
  const seasons = [...new Set(onVehicle.map((t) => t.season).filter(Boolean))];
  if (seasons.length === 1) return seasons[0];
  return seasons[0] || "unknown";
}

function evaluateVehicleSeasonalStatus(vehicle, tires, history, period, referenceDate) {
  const onVehicle = tires.filter((t) => t.status === "on_vehicle");
  const inStorage = tires.filter((t) => t.status === "in_storage");
  const onVehicleQty = sumQuantity(onVehicle);
  const storageTargets = getStorageTargetSeasons(period, referenceDate);
  const storageQty = sumQuantity(inStorage.filter((t) => storageTargets.has(t.season)));
  const currentTireSeason = resolveOnVehicleSeason(onVehicle);
  const lastChange = history[0] || null;
  const hardRequired = getHardRequiredSeason(period);

  const base = {
    vehicle_id: String(vehicle.id),
    plate: vehicle.plate || "",
    current_required_season: period,
    current_tire_season: currentTireSeason,
    on_vehicle_quantity: onVehicleQty,
    storage_quantity_for_required_season: storageQty,
    last_change_date: lastChange?.change_date || null,
    last_change_type: lastChange?.change_type || null,
    last_change_type_label: lastChange ? changeTypeLabel(lastChange.change_type) : null,
  };

  if (tires.length === 0) {
    return {
      ...base,
      status: "unknown",
      message: "Lastik kaydı bulunmuyor",
    };
  }

  if (onVehicle.some((t) => t.season === "all_season")) {
    return {
      ...base,
      status: "ready",
      current_tire_season: "all_season",
      message: "4 mevsim lastik araç üzerinde",
    };
  }

  if (period === "transition") {
    const upcoming = getUpcomingHardSeason(referenceDate);

    if (onVehicle.length === 0) {
      if (storageQty > 0) {
        return {
          ...base,
          status: "attention",
          message: "Geçiş dönemi — uygun lastik depoda, montaj planlanmalı",
        };
      }
      return {
        ...base,
        status: "unknown",
        message: "Araç üzerinde lastik kaydı yok",
      };
    }

    if (upcoming) {
      const hasUpcomingOn = onVehicle.some((t) => t.season === upcoming);
      const hasWrongOn = onVehicle.some((t) => t.season !== upcoming);

      if (hasUpcomingOn && !hasWrongOn) {
        return {
          ...base,
          status: "ready",
          message: `${seasonLabel(upcoming)} lastik araç üzerinde`,
        };
      }

      if (hasWrongOn) {
        return {
          ...base,
          status: "attention",
          message: "Geçiş dönemi — sezon değişimi planlanmalı",
        };
      }
    }

    if (storageQty > 0) {
      return {
        ...base,
        status: "attention",
        message: "Geçiş dönemi — depodaki lastikler kontrol edilmeli",
      };
    }

    return {
      ...base,
      status: "attention",
      message: "Geçiş dönemi — lastik durumu kontrol edilmeli",
    };
  }

  const matchingOn = onVehicle.filter((t) => seasonMatchesRequired(t.season, hardRequired));
  const wrongOn = onVehicle.filter((t) => !seasonMatchesRequired(t.season, hardRequired));

  if (matchingOn.length > 0 && wrongOn.length === 0) {
    return {
      ...base,
      status: "ready",
      message: `${seasonLabel(hardRequired)} lastik araç üzerinde`,
    };
  }

  if (wrongOn.length > 0) {
    if (storageQty > 0) {
      return {
        ...base,
        status: "attention",
        message: "Uyumsuz lastik takılı — uygun set depoda",
      };
    }
    return {
      ...base,
      status: "mismatch",
      message: `${seasonLabel(hardRequired)} döneminde uyumsuz lastik takılı`,
    };
  }

  if (onVehicle.length === 0) {
    if (storageQty > 0) {
      return {
        ...base,
        status: "attention",
        message: `${seasonLabel(hardRequired)} lastiği depoda — montaj gerekli`,
      };
    }
    return {
      ...base,
      status: "mismatch",
      message: `${seasonLabel(hardRequired)} dönemi için uygun lastik bulunamadı`,
    };
  }

  return {
    ...base,
    status: "mismatch",
    message: "Lastik sezonu uyumsuz",
  };
}

function sortVehicles(vehicles) {
  return [...vehicles].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return String(a.plate || "").localeCompare(String(b.plate || ""), "tr");
  });
}

function buildTireSeasonalSchedule(referenceDate = new Date(), filters = {}) {
  const ref = toDateStr(referenceDate);
  const period = getSeasonPeriod(ref);

  let vehicleSql = "SELECT id, plate FROM vehicles ORDER BY plate ASC";
  const vehicleParams = [];
  if (filters.vehicle_id) {
    vehicleSql = "SELECT id, plate FROM vehicles WHERE id = ? ORDER BY plate ASC";
    vehicleParams.push(Number(filters.vehicle_id));
  }
  const vehicleRows = db.prepare(vehicleSql).all(...vehicleParams);

  const vehicles = vehicleRows.map((vehicle) => {
    const tires = tireService.listTireRecords({ vehicle_id: vehicle.id });
    const history = tireHistoryService.listTireChangeRecords({ vehicle_id: vehicle.id });
    const row = evaluateVehicleSeasonalStatus(vehicle, tires, history, period, ref);
    return {
      ...row,
      current_required_season_label: PERIOD_LABELS[period] || period,
      current_tire_season_label:
        row.current_tire_season === "unknown"
          ? "Bilinmiyor"
          : seasonLabel(row.current_tire_season),
      status_label: STATUS_LABELS[row.status] || row.status,
    };
  });

  const sorted = sortVehicles(vehicles);
  const summary = {
    total_vehicles: sorted.length,
    ready: sorted.filter((v) => v.status === "ready").length,
    attention: sorted.filter((v) => v.status === "attention").length,
    mismatch: sorted.filter((v) => v.status === "mismatch").length,
    unknown: sorted.filter((v) => v.status === "unknown").length,
  };

  return {
    reference_date: ref,
    current_season: period,
    current_season_label: PERIOD_LABELS[period] || period,
    required_tire_season_label: getRequiredSeasonLabel(period, ref),
    summary,
    vehicles: sorted,
  };
}

function getVehicleSeasonalPreview(vehicleId, referenceDate = new Date()) {
  const id = Number(vehicleId);
  if (!id || !Number.isFinite(id)) throw new Error("Araç geçersiz");

  const vehicle = db.prepare("SELECT id, plate FROM vehicles WHERE id = ?").get(id);
  if (!vehicle) throw new Error("Araç bulunamadı");

  const schedule = buildTireSeasonalSchedule(referenceDate, { vehicle_id: id });
  return schedule.vehicles[0] || null;
}

module.exports = {
  STATUS_LABELS,
  PERIOD_LABELS,
  STATUS_RANK,
  toDateStr,
  getSeasonPeriod,
  getUpcomingHardSeason,
  getRequiredSeasonLabel,
  buildTireSeasonalSchedule,
  getVehicleSeasonalPreview,
  evaluateVehicleSeasonalStatus,
};
