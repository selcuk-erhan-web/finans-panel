/** Paylaşılan Chart.js seçenekleri — performans için hafif */
const MODERN_LEGEND = {
  position: "top",
  align: "end",
  labels: { usePointStyle: true, padding: 18, font: { size: 12, weight: "600" } },
};

const MODERN_TOOLTIP = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  titleFont: { size: 13, weight: "700" },
  bodyFont: { size: 12 },
  padding: 14,
  cornerRadius: 10,
  displayColors: true,
};

const MODERN_SCALES_Y = {
  beginAtZero: true,
  grid: { color: "rgba(15, 23, 42, 0.05)" },
  border: { display: false },
  ticks: { font: { size: 11 } },
};

const MODERN_SCALES_X = {
  grid: { display: false },
  border: { display: false },
  ticks: { font: { size: 11 } },
};

function chartOpts(extra = {}) {
  return JSON.stringify({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: MODERN_LEGEND, tooltip: MODERN_TOOLTIP },
    scales: { x: MODERN_SCALES_X, y: MODERN_SCALES_Y },
    ...extra,
  });
}

module.exports = { chartOpts, MODERN_LEGEND, MODERN_TOOLTIP };
