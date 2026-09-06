const BIG_FIVE = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

const MODE_META = {
  avg_ppg: {
    label: "Average PPG by rank",
    kicker: "Points per game, from first to last",
    explainer: "Each point is an average at that rank. Leagues have 18 or 20 teams; Ligue 1 ranks 19–20 cover fewer seasons. Select a legend label to focus a league.",
    yTitle: "Average PPG"
  },
  gap_top: {
    label: "Top-end gap comparison",
    kicker: "The distance between first and fourth",
    explainer: "Average total PPG gap from 1st to 4th. A shorter bar means the top four are closer together.",
    yTitle: "Average PPG gap"
  },
  gap_mid: {
    label: "Mid-table gap comparison",
    kicker: "How far the middle of the table spreads",
    explainer: "Average total PPG gap from 4th to 10th. A shorter bar means a more closely grouped middle of the table.",
    yTitle: "Average PPG gap"
  }
};

const state = {
  mode: "avg_ppg",
  selectedLeagues: [],
  selectedSeasons: [],
  highlightLeague: "",
  tableSort: { key: "parity_score_0_100", direction: "desc" },
  allLeagues: [],
  allSeasons: [],
  masterRows: [],
  seasonGapRows: [],
  charts: {
    main: null
  },
  cache: {
    key: "",
    derived: null
  }
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

    renderStaticControls();
    bindControls();
    refreshView();
  } catch (error) {
    console.error(error);
    showDataError();
  }
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return parseCsv(await response.text());
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

function renderStaticControls() {
  renderLeagueButtons();
  renderSeasonSelects();
  renderHighlightOptions();
}

function bindControls() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      refreshView();
    });
  });

  document.querySelectorAll("[data-league-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.leaguePreset === "all") {
        state.selectedLeagues = [...state.allLeagues];
      } else if (button.dataset.leaguePreset === "big5") {
        state.selectedLeagues = state.allLeagues.filter((league) => BIG_FIVE.includes(league));
      } else {
        state.selectedLeagues = state.allLeagues.filter((league) => !BIG_FIVE.includes(league));
      }
      refreshView();
    });
  });

  document.querySelectorAll("[data-season-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSeasons = button.dataset.seasonPreset === "recent"
        ? state.allSeasons.slice(-4)
        : [...state.allSeasons];
      refreshView();
    });
  });

  document.getElementById("leagues-select-all").addEventListener("click", () => {
    state.selectedLeagues = [...state.allLeagues];
    refreshView();
  });

  document.getElementById("leagues-clear-all").addEventListener("click", () => {
    state.selectedLeagues = [];
    refreshView();
  });

  document.getElementById("highlight-league").addEventListener("change", (event) => {
    state.highlightLeague = event.target.value;
    refreshView();
  });

  bindSeasonSelects();
  bindComparisonControls();
  bindFilterDialog();
}

function renderLeagueButtons() {
  const container = document.getElementById("league-filters");
  container.innerHTML = state.allLeagues
    .map((league) => `<button class="league-pill is-active" type="button" aria-pressed="true" data-league="${league}" style="--league-color: ${colorForLeague(league, false)}"><span class="league-dot" aria-hidden="true"></span>${league}</button>`)
    .join("");

  container.querySelectorAll(".league-pill").forEach((button) => {
    button.addEventListener("click", () => {
      const league = button.dataset.league;
      state.selectedLeagues = state.selectedLeagues.includes(league)
        ? state.selectedLeagues.filter((item) => item !== league)
        : [...state.selectedLeagues, league].sort();
      refreshView();
    });
  });
}

function renderSeasonSelects() {
  const options = state.allSeasons
    .map((season) => `<option value="${season}">${season}</option>`)
    .join("");
  document.getElementById("season-start-select").innerHTML = options;
  document.getElementById("season-end-select").innerHTML = options;
}

function bindSeasonSelects() {
  const startSelect = document.getElementById("season-start-select");
  const endSelect = document.getElementById("season-end-select");

  const updateFromSelects = () => {
    let startIndex = state.allSeasons.indexOf(startSelect.value);
    let endIndex = state.allSeasons.indexOf(endSelect.value);

    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startSelect.value = state.allSeasons[startIndex];
      endSelect.value = state.allSeasons[endIndex];
    }

    state.selectedSeasons = state.allSeasons.slice(startIndex, endIndex + 1);
    refreshView();
  };

  startSelect.addEventListener("change", updateFromSelects);
  endSelect.addEventListener("change", updateFromSelects);
}

function renderHighlightOptions() {
  const select = document.getElementById("highlight-league");
  select.innerHTML = [
    `<option value="">No highlight</option>`,
    ...state.allLeagues.map((league) => `<option value="${league}">${league}</option>`)
  ].join("");
}

function refreshView() {
  const derived = getDerivedSelection();
  syncLeagueButtons();
  syncModeButtons();
  syncSeasonControls();
  syncHighlightSelect();
  updateSelectionSummary();
  updateChartCopy();
  renderMainChart(derived);
  renderChartLegend(derived.metrics);
  renderTakeaway(derived.metrics);
  renderComparisonTable(derived.metrics);
}

function getDerivedSelection() {
  const key = `${[...state.selectedLeagues].sort().join("|")}::${[...state.selectedSeasons].join("|")}`;
  if (state.cache.key === key && state.cache.derived) {
    return state.cache.derived;
  }

  const seasonMasterRows = state.masterRows.filter((row) => state.selectedSeasons.includes(row.season));
  const seasonGapRows = state.seasonGapRows.filter((row) => state.selectedSeasons.includes(row.season));
  const filteredMasterRows = seasonMasterRows.filter((row) => state.selectedLeagues.includes(row.league));
  const filteredGapRows = seasonGapRows.filter((row) => state.selectedLeagues.includes(row.league));

  const rankCurves = buildRankCurves(filteredMasterRows);
  // Keep the score baseline across all leagues for this season window, even when
  // a league is hidden. League filters affect visibility, not the score itself.
  const metrics = buildLeagueMetrics(seasonMasterRows, seasonGapRows)
    .filter((row) => state.selectedLeagues.includes(row.league));
  const derived = { filteredMasterRows, filteredGapRows, rankCurves, metrics };

  state.cache.key = key;
  state.cache.derived = derived;
  return derived;
}

function buildRankCurves(rows) {
  const grouped = {};

  rows.forEach((row) => {
    const key = `${row.league}::${row.rank}`;
    if (!grouped[key]) {
      grouped[key] = { league: row.league, rank: Number(row.rank), values: [] };
    }
    grouped[key].values.push(Number(row.ppg));
  });

  return Object.values(grouped).reduce((acc, item) => {
    if (!acc[item.league]) {
      acc[item.league] = [];
    }
    acc[item.league].push({
      rank: item.rank,
      avg_ppg: average(item.values),
      season_count: item.values.length
    });
    acc[item.league].sort((a, b) => a.rank - b.rank);
    return acc;
  }, {});
}

function buildLeagueMetrics(masterRows, gapRows) {
  const visibleLeagues = [...new Set(masterRows.map((row) => row.league))];
  const groupedGapRows = gapRows.reduce((acc, row) => {
    if (!acc[row.league]) {
      acc[row.league] = [];
    }
    acc[row.league].push(row);
    return acc;
  }, {});

  const rows = visibleLeagues.map((league) => {
    const leagueGapRows = groupedGapRows[league] || [];
    const leagueSeasonRows = masterRows.filter((row) => row.league === league);
    const perSeasonRows = leagueSeasonRows.reduce((acc, row) => {
      if (!acc[row.season]) {
        acc[row.season] = [];
      }
      acc[row.season].push(row);
      return acc;
    }, {});
    const seasonMetrics = Object.values(perSeasonRows).map((seasonRows) => {
      const ranked = [...seasonRows].sort((a, b) => a.rank - b.rank);
      const first = Number(ranked[0].ppg);
      const fourth = Number(ranked[3].ppg);
      const tenth = Number(ranked[9].ppg);
      const last = Number(ranked[ranked.length - 1].ppg);
      return {
        firstLastGap: first - last,
        topStep: (first - fourth) / 3,
        midStep: (fourth - tenth) / 6,
        bottomStep: (tenth - last) / (ranked.length - 10),
        sd: sampleStandardDeviation(ranked.map((row) => Number(row.ppg)))
      };
    });

    const metrics = {
      league,
      avg_gap_1_2: average(leagueGapRows.map((row) => row.gap_1_2)),
      avg_gap_1_4: average(leagueGapRows.map((row) => row.gap_1_4)),
      avg_gap_4_10: average(leagueGapRows.map((row) => row.gap_4_10)),
      avg_gap_10_last: average(leagueGapRows.map((row) => row.gap_10_last)),
      avg_ppg_sd: average(seasonMetrics.map((row) => row.sd)),
      // Average season endpoints, not endpoints of a curve with mixed samples.
      curve_drop: average(seasonMetrics.map((row) => row.firstLastGap)),
      avg_step_top: average(seasonMetrics.map((row) => row.topStep)),
      avg_step_mid: average(seasonMetrics.map((row) => row.midStep)),
      avg_step_bottom: average(seasonMetrics.map((row) => row.bottomStep))
    };

    return {
      ...metrics,
      parity_score_simple: -(
        metrics.avg_gap_1_2 +
        metrics.avg_gap_1_4 +
        metrics.avg_gap_4_10 +
        metrics.avg_gap_10_last +
        metrics.avg_ppg_sd
      )
    };
  });

  if (!rows.length) {
    return [];
  }

  const min = Math.min(...rows.map((row) => row.parity_score_simple));
  const max = Math.max(...rows.map((row) => row.parity_score_simple));

  return rows
    .map((row) => ({
      ...row,
      parity_score_0_100: max === min ? 50 : ((row.parity_score_simple - min) / (max - min)) * 100,
      summary: buildHeadlineSummary(row)
    }))
    .sort((a, b) => b.parity_score_0_100 - a.parity_score_0_100);
}

function updateSelectionSummary() {
  const seasons = state.selectedSeasons;
  const period = seasons.length === 1 ? seasons[0] : seasons.length ? `${seasons[0]}–${seasons[seasons.length - 1]}` : "No seasons";
  document.getElementById("selection-summary").textContent = `${period}${state.highlightLeague ? ` · Focus: ${state.highlightLeague}` : ""}`;
  document.getElementById("mobile-filter-summary").textContent = `${state.selectedLeagues.length} league${state.selectedLeagues.length === 1 ? "" : "s"} · ${seasons.length} season${seasons.length === 1 ? "" : "s"}`;
}

function updateChartCopy() {
  const meta = MODE_META[state.mode];
  document.getElementById("chart-kicker").textContent = meta.kicker;
  document.getElementById("chart-explainer").textContent = meta.explainer;
  document.getElementById("parity-chart").setAttribute("aria-label", `${meta.label}. ${state.selectedLeagues.length} leagues, ${state.selectedSeasons.length} seasons. Values are available in View chart data below.`);
}

function renderMainChart(derived) {
  const canvas = document.getElementById("parity-chart");
  const type = state.mode === "avg_ppg" ? "line" : "bar";
  const data = buildMainChartData(derived);
  const empty = !derived.metrics.length;
  document.getElementById("chart-empty").classList.toggle("is-hidden", !empty);
  document.getElementById("chart-empty").querySelector("strong").textContent = state.selectedLeagues.length ? "No seasons selected" : "No leagues selected";
  document.getElementById("chart-empty").querySelector("p").textContent = state.selectedLeagues.length ? "Reset the view to bring the comparison back." : "Choose a league in Filters, or reset the view.";
  canvas.setAttribute("aria-hidden", String(empty));
  if (state.charts.main && state.charts.main.config.type === type) {
    state.charts.main.data = data;
    state.charts.main.options = buildMainChartOptions();
    state.charts.main.update("none");
  } else {
    if (state.charts.main) state.charts.main.destroy();
    state.charts.main = new Chart(canvas, { type, data, options: buildMainChartOptions() });
  }
  renderChartDataTable(data);
}

function buildMainChartData(derived) {
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
          borderColor: useMuted ? "rgba(102, 93, 82, 0.35)" : colorForLeague(league, false),
          backgroundColor: useMuted ? "rgba(102, 93, 82, 0.35)" : colorForLeague(league, false),
          borderWidth: isHighlighted ? 3.5 : 2,
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
      label: MODE_META[state.mode].label,
      data: rows.map((row) => row[metricKey]),
      backgroundColor: rows.map((row) => colorForLeague(row.league, true)),
      borderRadius: 3,
      maxBarThickness: 26,
      borderSkipped: false
    }]
  };
}

function buildMainChartOptions() {
  const isLine = state.mode === "avg_ppg";
  const tickStyle = { color: "#706e63", font: { size: 10 } };
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
      x: { type: "linear", min: 1, title: { display: true, text: "League rank", color: "#706e63", font: { size: 10 } }, ticks: { ...tickStyle, stepSize: 1, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } },
      y: { title: { display: false }, ticks: { ...tickStyle, callback: value => value.toFixed(1) }, grid: gridStyle, border: { display: false } }
    } : {
      x: { beginAtZero: true, title: { display: true, text: "PPG gap", color: "#706e63", font: { size: 10 } }, ticks: { ...tickStyle, maxTicksLimit: 5 }, grid: gridStyle, border: { display: false } },
      y: { ticks: tickStyle, grid: { display: false }, border: { display: false } }
    }
  };
}

function renderChartDataTable(data) {
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
    <caption>Main chart data table: ${MODE_META[state.mode].label.toLowerCase()}</caption>
    <thead><tr><th scope="col">League</th><th scope="col">${MODE_META[state.mode].label}</th></tr></thead>
    <tbody>
      ${data.labels.map((label, index) => `<tr><td>${label}</td><td>${Number(data.datasets[0].data[index]).toFixed(3)}</td></tr>`).join("")}
    </tbody>
  `;
}

function syncLeagueButtons() {
  document.querySelectorAll(".league-pill").forEach((button) => {
    const selected = state.selectedLeagues.includes(button.dataset.league);
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function syncModeButtons() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    const selected = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function bindComparisonControls() {
  document.querySelectorAll("[data-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLeagues = [...state.allLeagues];
      state.selectedSeasons = [...state.allSeasons];
      state.highlightLeague = "";
      state.mode = "avg_ppg";
      state.tableSort = { key: "parity_score_0_100", direction: "desc" };
      document.getElementById("more-options").open = false;
      refreshView();
    });
  });

  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      state.tableSort = {
        key,
        direction: state.tableSort.key === key
          ? (state.tableSort.direction === "asc" ? "desc" : "asc")
          : (key === "parity_score_0_100" ? "desc" : "asc")
      };
      renderComparisonTable(getDerivedSelection().metrics);
      document.getElementById("table-sort-status").textContent = `Table sorted by ${button.firstChild.textContent.trim()}, ${state.tableSort.direction === "asc" ? "ascending" : "descending"}.`;
    });
  });

  ["comparison-body", "chart-legend"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (event) => {
      const button = event.target.closest("button[data-focus]");
      if (!button) return;
      const league = button.dataset.focus;
      state.highlightLeague = state.highlightLeague === league ? "" : league;
      refreshView();
      // The row/legend buttons are redrawn; retain keyboard focus on the action.
      [...document.getElementById(id).querySelectorAll("[data-focus]")]
        .find((item) => item.dataset.focus === league)?.focus({ preventScroll: true });
    });
  });
}

function bindFilterDialog() {
  const dialog = document.getElementById("filter-dialog");
  const panel = document.getElementById("filters-panel");
  const mobile = window.matchMedia("(max-width: 720px)");
  const placeControls = () => {
    if (!mobile.matches && dialog.open) dialog.close();
    document.getElementById(mobile.matches ? "mobile-filters" : "desktop-filters").append(panel);
  };
  placeControls();
  mobile.addEventListener("change", placeControls);
  document.getElementById("open-filters").addEventListener("click", () => dialog.showModal());
  ["close-filters", "apply-filters"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button, select, summary, a[href], [tabindex]")]
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.checkVisibility());
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

function renderChartLegend(metrics) {
  const container = document.getElementById("chart-legend");
  container.classList.toggle("is-hidden", state.mode !== "avg_ppg" || !metrics.length);
  container.innerHTML = [...metrics].sort((a, b) => a.league.localeCompare(b.league)).map((row) => `
    <button class="legend-button" type="button" data-focus="${row.league}" aria-label="Highlight ${row.league}" aria-pressed="${state.highlightLeague === row.league}" style="--league-color: ${colorForLeague(row.league, true)}"><span class="league-dot" aria-hidden="true"></span>${row.league}</button>
  `).join("");
}

function buildTakeaway(metrics, mode) {
  if (!metrics.length) return "Choose at least one league and one season to explore the comparison.";
  const key = mode === "avg_ppg" ? "curve_drop" : mode === "gap_top" ? "avg_gap_1_4" : "avg_gap_4_10";
  const band = mode === "avg_ppg" ? "first-to-last" : mode === "gap_top" ? "1st-to-4th" : "4th-to-10th";
  const rows = [...metrics].sort((a, b) => a[key] - b[key]);
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (rows.length === 1) return `<strong>${first.league}</strong> has an average ${band} gap of <strong>${first[key].toFixed(3)} PPG</strong> over the selected seasons. Add another league to compare.`;
  if (last[key].toFixed(3) === first[key].toFixed(3)) return `The selected leagues have the same average ${band} gap to three decimals: <strong>${first[key].toFixed(3)} PPG</strong>.`;
  return `<strong>${first.league}</strong> has the smallest average ${band} gap among the selected leagues: <strong>${first[key].toFixed(3)} PPG</strong>, compared with <strong>${last[key].toFixed(3)}</strong> in ${last.league}.`;
}

function renderTakeaway(metrics) {
  document.getElementById("takeaway-text").innerHTML = buildTakeaway(metrics, state.mode);
}

function getSortedMetrics(metrics, sort = state.tableSort) {
  return [...metrics].sort((a, b) => {
    const difference = sort.key === "league" ? a.league.localeCompare(b.league) : a[sort.key] - b[sort.key];
    return (sort.direction === "asc" ? difference : -difference) || a.league.localeCompare(b.league);
  });
}

function renderComparisonTable(metrics) {
  document.querySelectorAll("[data-sort]").forEach((button) => {
    const active = button.dataset.sort === state.tableSort.key;
    button.closest("th").setAttribute("aria-sort", active ? (state.tableSort.direction === "asc" ? "ascending" : "descending") : "none");
    button.querySelector(".sort-icon").textContent = active ? (state.tableSort.direction === "asc" ? "↑" : "↓") : "↕";
  });
  document.getElementById("comparison-body").innerHTML = metrics.length ? getSortedMetrics(metrics).map((row) => `
    <tr class="${state.highlightLeague === row.league ? "is-focused" : ""}" style="--league-color: ${colorForLeague(row.league, false)}">
      <td><button class="table-league" type="button" data-focus="${row.league}" aria-label="Highlight ${row.league} in the chart" aria-pressed="${state.highlightLeague === row.league}"><span class="league-dot" aria-hidden="true"></span>${row.league}</button></td>
      <td><div class="score-cell"><span class="score-track" aria-hidden="true"><span style="width: ${row.parity_score_0_100.toFixed(1)}%"></span></span><span class="score-value">${row.parity_score_0_100.toFixed(1)}</span></div></td>
      <td>${row.avg_gap_1_4.toFixed(3)}</td><td>${row.avg_gap_4_10.toFixed(3)}</td><td>${row.avg_gap_10_last.toFixed(3)}</td>
    </tr>
  `).join("") : '<tr><td colspan="5">No data selected. Reset the view or choose a league and season.</td></tr>';
}

function syncSeasonControls() {
  const startSelect = document.getElementById("season-start-select");
  const endSelect = document.getElementById("season-end-select");
  const count = document.getElementById("season-range-count");
  startSelect.value = state.selectedSeasons[0] || "";
  endSelect.value = state.selectedSeasons[state.selectedSeasons.length - 1] || "";
  count.textContent = `${state.selectedSeasons.length} season${state.selectedSeasons.length === 1 ? "" : "s"}`;
}

function syncHighlightSelect() {
  const select = document.getElementById("highlight-league");
  if (state.highlightLeague && !state.selectedLeagues.includes(state.highlightLeague)) {
    state.highlightLeague = "";
  }
  [...select.options].forEach((option) => {
    option.disabled = !!option.value && !state.selectedLeagues.includes(option.value);
  });
  select.value = state.highlightLeague;
}

function colorForLeague(league, allowMuted) {
  const rootStyles = getComputedStyle(document.documentElement);
  const slug = league.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cssColor = rootStyles.getPropertyValue(`--league-${slug}`).trim();
  const baseColor = cssColor || "#665d52";

  if (allowMuted && state.highlightLeague && league !== state.highlightLeague) {
    return "rgba(102, 93, 82, 0.35)";
  }
  return baseColor;
}

function dominantGapLabel(row) {
  return [
    ["near the top of the table", row.avg_step_top],
    ["through the middle of the table", row.avg_step_mid],
    ["lower down the table", row.avg_step_bottom]
  ].sort((a, b) => b[1] - a[1])[0][0];
}

function buildHeadlineSummary(row) {
  return `The largest average PPG gap per rank step is ${dominantGapLabel(row)}, after adjusting each band for the number of positions it spans.`;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function sampleStandardDeviation(values) {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  const squaredDistanceSum = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0);
  return Math.sqrt(squaredDistanceSum / (values.length - 1));
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

function showDataError() {
  document.getElementById("data-error").classList.remove("is-hidden");
  document.querySelectorAll("[data-interactive]").forEach((element) => {
    element.classList.add("is-hidden");
  });
}
