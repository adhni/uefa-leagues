// The chart is optional: numeric values render even when the library fails.
const LINE_STYLES = {
  "Bundesliga": [], "Eredivisie": [8, 3], "La Liga": [3, 3],
  "Ligue 1": [12, 3, 3, 3], "Premier League": [14, 4],
  "Primeira Liga": [5, 3, 1, 3], "Serie A": [2, 4]
};
export const lineStyleForLeague = (league) => LINE_STYLES[league] || [];

export function renderMainChart(state, derived, colorForLeague, modeMeta) {
  const canvas = document.getElementById("parity-chart");
  const type = state.mode === "avg_ppg" ? "line" : "bar";
  const data = buildMainChartData(state, derived, colorForLeague, modeMeta);
  const empty = !derived.metrics.length;
  const emptyPanel = document.getElementById("chart-empty");
  const excludedRange = state.excludeIncomplete && state.selectedSeasons.length > 0;
  emptyPanel.classList.toggle("is-hidden", !empty);
  emptyPanel.querySelector("strong").textContent = !state.selectedLeagues.length
    ? "No leagues selected" : excludedRange ? "No completed seasons selected" : "No seasons selected";
  emptyPanel.querySelector("p").textContent = !state.selectedLeagues.length
    ? "Choose a league in Filters, or reset the view."
    : excludedRange ? "Choose another season range or turn off completed seasons only in More options."
    : "Reset the view to bring the comparison back.";
  canvas.setAttribute("aria-hidden", String(empty));
  renderChartDataTable(state, data, modeMeta);
  try {
    if (typeof globalThis.Chart !== "function") throw new Error("Chart library unavailable");
    if (state.charts.main && state.charts.main.config.type === type) {
      state.charts.main.data = data;
      state.charts.main.options = buildMainChartOptions(state);
      state.charts.main.update("none");
    } else {
      if (state.charts.main) state.charts.main.destroy();
      state.charts.main = new globalThis.Chart(canvas, { type, data, options: buildMainChartOptions(state) });
    }
    document.getElementById("chart-error").classList.add("is-hidden");
    canvas.hidden = false;
  } catch (error) {
    console.error(error);
    try { globalThis.Chart?.getChart?.(canvas)?.destroy(); } catch { /* Leave the values usable. */ }
    canvas.hidden = true;
    document.getElementById("chart-error").classList.toggle("is-hidden", empty);
    document.querySelector(".chart-data").open = true;
    state.charts.main = null;
  }
}

function buildMainChartData(state, derived, colorForLeague, modeMeta) {
  if (state.mode === "avg_ppg") {
    const datasets = Object.entries(derived.rankCurves)
      .sort(([a], [b]) => {
        if (a === state.highlightLeague) return 1;
        if (b === state.highlightLeague) return -1;
        return a.localeCompare(b);
      })
      .map(([league, rows]) => {
        const isHighlighted = state.highlightLeague === league;
        const useMuted = !!state.highlightLeague && !isHighlighted;
        return {
          label: league,
          order: isHighlighted ? -1 : 0,
          data: rows.map((row) => ({ x: row.rank, y: row.avg_ppg, seasonCount: row.season_count })),
          borderColor: useMuted ? "#7b756c" : colorForLeague(league, false),
          backgroundColor: useMuted ? "#7b756c" : colorForLeague(league, false),
          borderWidth: isHighlighted ? 3.5 : 2,
          borderDash: lineStyleForLeague(league),
          pointRadius: 0,
          pointHoverRadius: isHighlighted ? 5 : 3,
          tension: 0.28
        };
      });
    return { datasets };
  }

  const metricKey = state.mode === "gap_top" ? "avg_gap_1_4" : "avg_gap_4_10";
  const rows = [...derived.metrics].sort((a, b) => a[metricKey] - b[metricKey]);
  return {
    labels: rows.map((row) => row.league),
    datasets: [{
      label: modeMeta[state.mode].label,
      data: rows.map((row) => row[metricKey]),
      backgroundColor: rows.map((row) => colorForLeague(row.league, true)),
      borderRadius: 3,
      maxBarThickness: 26,
      borderSkipped: false
    }]
  };
}

function buildMainChartOptions(state) {
  const isLine = state.mode === "avg_ppg";
  const tickStyle = { color: "#706e63", font: { size: 12 } };
  const gridStyle = { color: "#eeece5", drawTicks: false };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: isLine ? "x" : "y",
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#292923", titleColor: "#fffdf8", bodyColor: "#fffdf8",
        padding: 12, displayColors: isLine,
        callbacks: {
          title(items) { return isLine ? `Rank ${items[0].raw.x}` : items[0].label; },
          label(context) {
            const value = Number(context.raw.y ?? context.raw).toFixed(3);
            return isLine ? `${context.dataset.label}: ${value} PPG (${context.raw.seasonCount} season${context.raw.seasonCount === 1 ? "" : "s"})` : `${value} PPG gap`;
          }
        }
      }
    },
    scales: isLine ? {
      x: { type: "linear", min: 1, title: { display: true, text: "League rank", color: "#706e63", font: { size: 12 } }, ticks: { ...tickStyle, stepSize: 1, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } },
      y: { min: 0, max: 3, title: { display: true, text: "Points per game", color: "#706e63", font: { size: 12 } }, ticks: { ...tickStyle, callback: value => value.toFixed(1) }, grid: gridStyle, border: { display: false } }
    } : {
      x: { beginAtZero: true, title: { display: true, text: "PPG gap", color: "#706e63", font: { size: 12 } }, ticks: { ...tickStyle, maxTicksLimit: 5 }, grid: gridStyle, border: { display: false } },
      y: { ticks: tickStyle, grid: { display: false }, border: { display: false } }
    }
  };
}

function renderChartDataTable(state, data, modeMeta) {
  const table = document.getElementById("chart-data-table");
  if (state.mode === "avg_ppg") {
    table.innerHTML = `
      <caption>Main chart data table: average PPG by rank</caption>
      <thead><tr><th scope="col">League</th><th scope="col">Rank</th><th scope="col">Average PPG</th><th scope="col">Seasons</th></tr></thead>
      <tbody>
        ${data.datasets.flatMap((dataset) =>
          dataset.data.map((point) => `<tr><td>${dataset.label}</td><td>${point.x}</td><td>${point.y.toFixed(3)}</td><td>${point.seasonCount}</td></tr>`)
        ).join("")}
      </tbody>
    `;
    return;
  }

  table.innerHTML = `
    <caption>Main chart data table: ${modeMeta[state.mode].label.toLowerCase()}</caption>
    <thead><tr><th scope="col">League</th><th scope="col">${modeMeta[state.mode].label}</th></tr></thead>
    <tbody>
      ${data.labels.map((label, index) => `<tr><td>${label}</td><td>${Number(data.datasets[0].data[index]).toFixed(3)}</td></tr>`).join("")}
    </tbody>
  `;
}
