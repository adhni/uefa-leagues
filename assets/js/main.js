const LEAGUE_COLORS = {
  "Premier League": "#8c2f39",
  "La Liga": "#1d5c63",
  "Serie A": "#355070",
  Bundesliga: "#d97706",
  "Ligue 1": "#6b705c",
  Eredivisie: "#7c3aed",
  "Primeira Liga": "#1f7a4c"
};

const MODE_META = {
  avg_ppg: {
    label: "Average PPG by rank",
    kicker: "Average PPG by rank across the full table.",
    explainer: "A flatter line means teams remain closer together from top to bottom. A steeper line suggests the table separates more sharply.",
    yTitle: "Average PPG"
  },
  gap_top: {
    label: "Top-end gap comparison",
    kicker: "Average gap from 1st to 4th place.",
    explainer: "This isolates separation near the top of the league. Larger values imply a looser top-end race.",
    yTitle: "Average PPG gap"
  },
  gap_mid: {
    label: "Mid-table gap comparison",
    kicker: "Average gap from 4th to 10th place.",
    explainer: "This shows whether the league stays crowded beyond the European places or starts to spread out.",
    yTitle: "Average PPG gap"
  }
};

const state = {
  mode: "avg_ppg",
  selectedLeagues: [],
  selectedSeasons: [],
  masterRows: [],
  seasonGapRows: [],
  allLeagues: [],
  allSeasons: [],
  chart: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [masterRows, seasonGapRows] = await Promise.all([
      loadCsv("data/league_team_season_master_7leagues_10seasons.csv"),
      loadCsv("data/league_season_gaps.csv")
    ]);

    state.masterRows = masterRows.map((row) => ({
      ...row,
      season: normalizeSeason(row.season)
    }));
    state.seasonGapRows = seasonGapRows.map((row) => ({
      ...row,
      season: normalizeSeason(row.season)
    }));
    state.allLeagues = uniqueValues(state.masterRows, "league");
    state.allSeasons = uniqueValues(state.masterRows, "season");
    state.selectedLeagues = [...state.allLeagues];
    state.selectedSeasons = [...state.allSeasons];

    renderLeagueFilters();
    initControls();
    renderSeasonControls();
    syncSelectionState();
  } catch (error) {
    console.error(error);
    document.getElementById("chart-kicker").textContent = "Data could not be loaded.";
    document.getElementById("chart-explainer").textContent = "Use a local web server or GitHub Pages so the CSV files can be fetched correctly.";
  }
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  const text = await response.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((value) => value.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cleanValue);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function cleanValue(value) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) || trimmed === "" ? trimmed : asNumber;
}

function initControls() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll(".mode-button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      syncSelectionState();
    });
  });

  document.getElementById("leagues-select-all").addEventListener("click", () => {
    state.selectedLeagues = [...state.allLeagues];
    syncSelectionState();
  });

  document.getElementById("leagues-clear-all").addEventListener("click", () => {
    state.selectedLeagues = [];
    syncSelectionState();
  });

  document.getElementById("seasons-select-all").addEventListener("click", () => {
    state.selectedSeasons = [...state.allSeasons];
    updateSeasonSliderFromSelection();
    syncSelectionState();
  });

  document.getElementById("seasons-clear-all").addEventListener("click", () => {
    state.selectedSeasons = [];
    syncSelectionState();
  });
}

function renderLeagueFilters() {
  const container = document.getElementById("league-filters");

  container.innerHTML = state.allLeagues.map((league) => {
    return `<button class="league-pill is-active" type="button" data-league="${league}">${league}</button>`;
  }).join("");

  container.querySelectorAll(".league-pill").forEach((button) => {
    button.addEventListener("click", () => {
      const league = button.dataset.league;
      const isSelected = state.selectedLeagues.includes(league);
      state.selectedLeagues = isSelected
        ? state.selectedLeagues.filter((item) => item !== league)
        : [...state.selectedLeagues, league];
      syncSelectionState();
    });
  });
}

function renderSeasonControls() {
  const startInput = document.getElementById("season-start");
  const endInput = document.getElementById("season-end");
  const maxIndex = state.allSeasons.length - 1;

  startInput.max = String(maxIndex);
  endInput.max = String(maxIndex);
  startInput.value = "0";
  endInput.value = String(maxIndex);

  document.getElementById("season-scale").innerHTML = state.allSeasons
    .map((season) => `<span>${season.replace("/", " / ")}</span>`)
    .join("");

  const updateFromSlider = () => {
    let start = Number(startInput.value);
    let end = Number(endInput.value);

    if (start > end) {
      [start, end] = [end, start];
      startInput.value = String(start);
      endInput.value = String(end);
    }

    state.selectedSeasons = state.allSeasons.slice(start, end + 1);
    syncSelectionState();
  };

  startInput.addEventListener("input", updateFromSlider);
  endInput.addEventListener("input", updateFromSlider);
}

function syncSelectionState() {
  syncLeagueButtons();
  updateSeasonSliderFromSelection();
  updateSelectionSummary();
  renderHeadlineCards();
  renderChart();
}

function syncLeagueButtons() {
  document.querySelectorAll(".league-pill").forEach((button) => {
    button.classList.toggle("is-active", state.selectedLeagues.includes(button.dataset.league));
  });
}

function updateSeasonSliderFromSelection() {
  const startInput = document.getElementById("season-start");
  const endInput = document.getElementById("season-end");
  const label = document.getElementById("season-range-label");
  const count = document.getElementById("season-range-count");

  if (!state.selectedSeasons.length) {
    label.textContent = "No seasons selected";
    count.textContent = "0 seasons selected";
    return;
  }

  const start = state.allSeasons.indexOf(state.selectedSeasons[0]);
  const end = state.allSeasons.indexOf(state.selectedSeasons[state.selectedSeasons.length - 1]);

  startInput.value = String(start);
  endInput.value = String(end);
  label.textContent = start === end ? state.selectedSeasons[0] : `${state.selectedSeasons[0]} to ${state.selectedSeasons[state.selectedSeasons.length - 1]}`;
  count.textContent = `${state.selectedSeasons.length} season${state.selectedSeasons.length === 1 ? "" : "s"} selected`;
}

function updateSelectionSummary() {
  const summary = document.getElementById("selection-summary");
  const leagueText = !state.selectedLeagues.length
    ? "No leagues selected"
    : state.selectedLeagues.length === state.allLeagues.length
      ? "All 7 leagues selected"
      : `${state.selectedLeagues.length} league${state.selectedLeagues.length === 1 ? "" : "s"}: ${state.selectedLeagues.join(", ")}`;
  const seasonText = !state.selectedSeasons.length
    ? "No seasons selected"
    : state.selectedSeasons.length === state.allSeasons.length
      ? "All 10 seasons selected"
      : state.selectedSeasons.length === 1
        ? `Season: ${state.selectedSeasons[0]}`
        : `Seasons: ${state.selectedSeasons[0]} to ${state.selectedSeasons[state.selectedSeasons.length - 1]}`;

  summary.textContent = `${leagueText}. ${seasonText}.`;
}

function renderChart() {
  const canvas = document.getElementById("parity-chart");
  const meta = MODE_META[state.mode];
  const seasonLabel = state.selectedSeasons.length === state.allSeasons.length
    ? "Average across all 10 seasons."
    : !state.selectedSeasons.length
      ? "No seasons are currently selected."
    : `${state.selectedSeasons.length} season${state.selectedSeasons.length === 1 ? "" : "s"} selected: ${state.selectedSeasons.join(", ")}.`;

  document.getElementById("chart-kicker").textContent = meta.kicker;
  document.getElementById("chart-explainer").textContent = `${meta.explainer} ${seasonLabel}`;

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(canvas, {
    type: state.mode === "avg_ppg" ? "line" : "bar",
    data: buildChartData(),
    options: buildChartOptions(meta)
  });
}

function buildChartData() {
  const selectedGapRows = state.seasonGapRows.filter((row) =>
    state.selectedLeagues.includes(row.league) && state.selectedSeasons.includes(row.season)
  );

  if (state.mode === "avg_ppg") {
    const grouped = groupRankCurveRows();
    const datasets = Object.entries(grouped).map(([league, rows]) => ({
      label: league,
      data: rows.map((row) => ({ x: row.rank, y: row.avg_ppg })),
      borderColor: LEAGUE_COLORS[league],
      backgroundColor: LEAGUE_COLORS[league],
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 3,
      tension: 0.28
    }));
    return { datasets };
  }

  const aggregatedRows = aggregateGapRows(selectedGapRows);
  const sortedRows = [...aggregatedRows].sort((a, b) => a.league.localeCompare(b.league));
  const metric = state.mode === "gap_top" ? "avg_gap_1_4" : "avg_gap_4_10";

  return {
    labels: sortedRows.map((row) => row.league),
    datasets: [{
      label: MODE_META[state.mode].label,
      data: sortedRows.map((row) => row[metric]),
      backgroundColor: sortedRows.map((row) => LEAGUE_COLORS[row.league]),
      borderRadius: 8,
      borderSkipped: false
    }]
  };
}

function buildChartOptions(meta) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      intersect: false
    },
    plugins: {
      legend: {
        display: state.mode === "avg_ppg",
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: "#1b1a17",
          padding: 18
        }
      },
      tooltip: {
        backgroundColor: "rgba(27, 26, 23, 0.92)",
        titleColor: "#fffaf3",
        bodyColor: "#fffaf3",
        padding: 12,
        displayColors: state.mode === "avg_ppg",
        callbacks: {
          title(items) {
            if (state.mode === "avg_ppg") return `Rank ${items[0].raw.x}`;
            return items[0].label;
          },
          label(context) {
            const value = Number(context.raw.y ?? context.raw).toFixed(3);
            return state.mode === "avg_ppg"
              ? `${context.dataset.label}: ${value} PPG`
              : `${value} PPG gap`;
          },
          afterLabel() {
            return `${state.selectedSeasons.length} selected season${state.selectedSeasons.length === 1 ? "" : "s"}`;
          }
        }
      }
    },
    scales: state.mode === "avg_ppg"
      ? {
          x: {
            type: "linear",
            title: { display: true, text: "League rank", color: "#60584d" },
            ticks: { stepSize: 1, color: "#60584d" },
            grid: { color: "rgba(27, 26, 23, 0.08)" }
          },
          y: {
            title: { display: true, text: meta.yTitle, color: "#60584d" },
            ticks: {
              color: "#60584d",
              callback(value) {
                return value.toFixed(1);
              }
            },
            grid: { color: "rgba(27, 26, 23, 0.08)" }
          }
        }
      : {
          x: {
            ticks: { color: "#60584d" },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: meta.yTitle, color: "#60584d" },
            ticks: {
              color: "#60584d",
              callback(value) {
                return value.toFixed(2);
              }
            },
            grid: { color: "rgba(27, 26, 23, 0.08)" }
          }
        }
  };
}

function renderHeadlineCards() {
  const container = document.getElementById("headline-cards");

  const rows = buildHeadlineRows();
  if (!rows.length) {
    container.innerHTML = `<article class="headline-card"><h3>No league headlines available</h3><p>Select at least one league and one season to populate this section.</p></article>`;
    return;
  }

  container.innerHTML = rows.map((row, index) => `
    <article class="headline-card">
      <div class="headline-top">
        <h3>${row.league}</h3>
        <span class="headline-rank">#${index + 1}</span>
      </div>
      <div class="headline-score">${Number(row.parity_score_0_100).toFixed(1)}</div>
      <p>${row.summary}</p>
      <div class="headline-metric">
        <span>Curve drop</span>
        <strong>${Number(row.curve_drop).toFixed(3)}</strong>
      </div>
      <div class="headline-metric">
        <span>1st to 4th gap</span>
        <strong>${Number(row.avg_gap_1_4).toFixed(3)}</strong>
      </div>
      <div class="headline-metric">
        <span>4th to 10th gap</span>
        <strong>${Number(row.avg_gap_4_10).toFixed(3)}</strong>
      </div>
    </article>
  `).join("");
}

function groupRankCurveRows() {
  const filteredRows = state.masterRows.filter((row) =>
    state.selectedLeagues.includes(row.league) && state.selectedSeasons.includes(row.season)
  );

  const grouped = {};

  filteredRows.forEach((row) => {
    const key = `${row.league}::${row.rank}`;
    if (!grouped[key]) {
      grouped[key] = { league: row.league, rank: row.rank, values: [] };
    }
    grouped[key].values.push(row.ppg);
  });

  return Object.values(grouped).reduce((acc, item) => {
    if (!acc[item.league]) acc[item.league] = [];
    acc[item.league].push({
      rank: item.rank,
      avg_ppg: average(item.values)
    });
    acc[item.league].sort((a, b) => a.rank - b.rank);
    return acc;
  }, {});
}

function aggregateGapRows(rows) {
  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.league]) acc[row.league] = [];
    acc[row.league].push(row);
    return acc;
  }, {});

  return Object.entries(grouped).map(([league, leagueRows]) => ({
    league,
    avg_gap_1_2: average(leagueRows.map((row) => row.gap_1_2)),
    avg_gap_1_4: average(leagueRows.map((row) => row.gap_1_4)),
    avg_gap_4_10: average(leagueRows.map((row) => row.gap_4_10)),
    avg_gap_10_last: average(leagueRows.map((row) => row.gap_10_last))
  }));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]))].sort(key === "season" ? compareSeasons : undefined);
}

function normalizeSeason(season) {
  return String(season).replace("-", "/");
}

function compareSeasons(a, b) {
  return Number(a.slice(0, 4)) - Number(b.slice(0, 4));
}

function buildHeadlineRows() {
  const visibleLeagues = state.selectedLeagues.filter((league) =>
    state.masterRows.some((row) => row.league === league && state.selectedSeasons.includes(row.season))
  );

  const gapRows = aggregateGapRows(
    state.seasonGapRows.filter((row) =>
      visibleLeagues.includes(row.league) && state.selectedSeasons.includes(row.season)
    )
  );

  const rankGroups = groupRankCurveRows();

  const rows = visibleLeagues.map((league) => {
    const seasonRows = state.masterRows.filter((row) =>
      row.league === league && state.selectedSeasons.includes(row.season)
    );
    const groupedBySeason = seasonRows.reduce((acc, row) => {
      if (!acc[row.season]) acc[row.season] = [];
      acc[row.season].push(Number(row.ppg));
      return acc;
    }, {});
    const avgPpgSd = average(Object.values(groupedBySeason).map(sampleStandardDeviation));
    const gapRow = gapRows.find((row) => row.league === league) || {
      avg_gap_1_2: 0,
      avg_gap_1_4: 0,
      avg_gap_4_10: 0,
      avg_gap_10_last: 0
    };
    const curveRows = rankGroups[league] || [];
    const curveDrop = curveRows.length ? Number(curveRows[0].avg_ppg) - Number(curveRows[curveRows.length - 1].avg_ppg) : 0;
    const parityScoreSimple = -(
      Number(gapRow.avg_gap_1_2) +
      Number(gapRow.avg_gap_1_4) +
      Number(gapRow.avg_gap_4_10) +
      Number(gapRow.avg_gap_10_last) +
      avgPpgSd
    );

    return {
      league,
      ...gapRow,
      avg_ppg_sd: avgPpgSd,
      curve_drop: curveDrop,
      parity_score_simple: parityScoreSimple
    };
  });

  if (!rows.length) return [];

  const min = Math.min(...rows.map((row) => row.parity_score_simple));
  const max = Math.max(...rows.map((row) => row.parity_score_simple));

  return rows
    .map((row) => ({
      ...row,
      parity_score_0_100: max === min ? 100 : ((row.parity_score_simple - min) / (max - min)) * 100,
      summary: buildHeadlineSummary(row)
    }))
    .sort((a, b) => b.parity_score_0_100 - a.parity_score_0_100);
}

function sampleStandardDeviation(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function buildHeadlineSummary(row) {
  const highestGap = Math.max(row.avg_gap_1_4, row.avg_gap_4_10, row.avg_gap_10_last);
  if (highestGap === row.avg_gap_10_last) {
    return "The biggest separation in this selection sits lower in the table, suggesting a stronger split between mid-table and the bottom.";
  }
  if (highestGap === row.avg_gap_4_10) {
    return "This selection looks most stratified in the middle band, with more room opening up beyond the European places.";
  }
  return "This selection opens up more sharply near the top, with the title-to-Champions-League band less compressed than the rest.";
}
