/** Canonical vehicle id for detail routes (vehicles.id). */
function vehicleRecordId(record) {
  const raw = record?.id ?? record?.vehicle_id ?? record?.vehicleId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

/** Detail page path — always uses numeric vehicles.id. */
function vehicleDetailPath(recordOrId) {
  if (recordOrId != null && typeof recordOrId === "object") {
    const id = vehicleRecordId(recordOrId);
    return id ? `/vehicle/${id}` : "/vehicles";
  }
  const id = Number(recordOrId);
  return Number.isFinite(id) && id > 0 ? `/vehicle/${Math.trunc(id)}` : "/vehicles";
}

module.exports = { vehicleRecordId, vehicleDetailPath };
