const fs = require("fs");
const path = require("path");

const ROADMAP_PATH = path.join(__dirname, "..", "data", "roadmap", "v1.1-roadmap.json");

const FALLBACK_ROADMAP = {
  version: "1.1.0",
  codename: "Vehicle Intelligence & Operational Control",
  status: "planning",
  base_version: "1.0.1",
  branch: "v1.1-planning",
  created_at: null,
  primary_goal: "Turn vehicle-level data into executive intelligence and operational control.",
  pillars: [
    "Vehicle Intelligence",
    "Vehicle Health Scoring",
    "Vehicle Operational Timeline",
    "Profit/Risk Fusion",
    "Executive Vehicle Intelligence Dashboard",
  ],
  phases: [],
  out_of_scope: [],
};

function getV11Roadmap() {
  try {
    const raw = fs.readFileSync(ROADMAP_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...FALLBACK_ROADMAP };
    return {
      ...FALLBACK_ROADMAP,
      ...parsed,
      pillars: Array.isArray(parsed.pillars) ? parsed.pillars : FALLBACK_ROADMAP.pillars,
      phases: Array.isArray(parsed.phases) ? parsed.phases : [],
      out_of_scope: Array.isArray(parsed.out_of_scope) ? parsed.out_of_scope : [],
    };
  } catch {
    return { ...FALLBACK_ROADMAP };
  }
}

module.exports = {
  getV11Roadmap,
  FALLBACK_ROADMAP,
};
