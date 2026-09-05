const BIG_FIVE = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

const MODE_META = {
  avg_ppg: {
    label: "Average PPG by rank",
    kicker: "Average PPG by rank across the selected league tables.",
    explainer: "Each point averages PPG at that rank over the selected seasons. Leagues have 18 or 20 teams, so endpoints differ; ranks 19–20 in Ligue 1 cover only its 20-team seasons. Hover for the season count.",
    yTitle: "Average PPG"
  },
  gap_top: {
    label: "Top-end gap comparison",
    kicker: "Average gap from 1st to 4th place.",
    explainer: "This measures the total PPG gap between first and fourth place. Larger values mean a wider top-four band.",
    yTitle: "Average PPG gap"
  },
  gap_mid: {
    label: "Mid-table gap comparison",
    kicker: "Average gap from 4th to 10th place.",
    explainer: "This shows whether the middle of the table stays crowded or starts to stratify quickly.",
    yTitle: "Average PPG gap"
  }
};

const state = {
  mode: "avg_ppg",
  selectedLeagues: [],
  selectedSeasons: [],
  highlightLeague: "",
  allLeagues: [],
  allSeasons: [],
  masterRows: [],
  seasonGapRows: [],
  charts: {
    main: null,
    topGap: null,
    bottomGap: null
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
  renderSeasonScale();
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

  document.getElementById("seasons-select-all").addEventListener("click", () => {
    state.selectedSeasons = [...state.allSeasons];
    refreshView();
  });

  document.getElementById("seasons-clear-all").addEventListener("click", () => {
    state.selectedSeasons = [];
    refreshView();
  });

  document.getElementById("highlight-league").addEventListener("change", (event) => {
    state.highlightLeague = event.target.value;
    refreshView();
  });

  bindSeasonSelects();
}

function renderLeagueButtons() {
  const container = document.getElementById("league-filters");
  container.innerHTML = state.allLeagues
    .map((league) => `<button class="league-pill is-active" type="button" aria-pressed="true" data-league="${league}">${league}</button>`)
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

function renderSeasonScale() {
  document.getElementById("season-scale").innerHTML = state.allSeasons
    .map((season) => `<span>${season.replace("/", " / ")}</span>`)
    .join("");
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
  updateSelectionSummary(derived);
  updateChartCopy(derived);
  renderQuickFindings(derived.metrics);
  renderMainChart(derived);
  renderSupportCharts(derived.metrics);
  renderInsightBox(derived);
  renderRankingPanel(derived.metrics);
  renderHeadlineCards(derived.metrics);
}

// The derived selection is the expensive part of the page. Cache it against the
// active league and season filters so mode/highlight changes can reuse the same data.
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

function updateSelectionSummary(derived) {
  const summary = document.getElementById("selection-summary");
  const leagueText = !state.selectedLeagues.length
    ? "No leagues selected"
    : state.selectedLeagues.length === state.allLeagues.length
      ? "All 7 leagues selected"
      : `${state.selectedLeagues.length} leagues: ${state.selectedLeagues.join(", ")}`;
  const seasonText = !state.selectedSeasons.length
    ? "No seasons selected"
    : state.selectedSeasons.length === state.allSeasons.length
      ? "All 10 seasons selected"
      : state.selectedSeasons.length === 1
        ? `Season: ${state.selectedSeasons[0]}`
        : `Seasons: ${state.selectedSeasons[0]} to ${state.selectedSeasons[state.selectedSeasons.length - 1]}`;
  const highlightText = state.highlightLeague ? `Focus league: ${state.highlightLeague}.` : "No league is highlighted against baselines.";

  summary.textContent = `${leagueText}. ${seasonText}. ${highlightText} ${derived.metrics.length ? `${derived.metrics.length} league profiles are active in this view.` : "Adjust the filters to populate the charts."}`;
}

function updateChartCopy(derived) {
  const meta = MODE_META[state.mode];
  const seasonLabel = state.selectedSeasons.length === state.allSeasons.length
    ? "Average across all 10 seasons."
    : !state.selectedSeasons.length
      ? "No seasons are currently selected."
      : `${state.selectedSeasons.length} selected season${state.selectedSeasons.length === 1 ? "" : "s"}.`;
  const highlightText = state.highlightLeague && derived.metrics.some((row) => row.league === state.highlightLeague)
    ? ` ${state.highlightLeague} is highlighted against muted baselines.`
    : "";

  document.getElementById("chart-kicker").textContent = meta.kicker;
  document.getElementById("chart-explainer").textContent = `${meta.explainer} ${seasonLabel}${highlightText}`;
}

function renderQuickFindings(metrics) {
  const container = document.getElementById("quick-findings");
  if (!metrics.length) {
    container.innerHTML = `<article class="quick-finding"><span class="quick-finding-label">No active selection</span><strong>Choose at least one league and one season</strong><span>The quick findings row updates from the live filters.</span></article>`;
    return;
  }

  const mostEven = metrics[0];
  const steepestCurve = [...metrics].sort((a, b) => b.curve_drop - a.curve_drop)[0];
  const widestTopGap = [...metrics].sort((a, b) => b.avg_gap_1_4 - a.avg_gap_1_4)[0];
  const tightestMid = [...metrics].sort((a, b) => a.avg_gap_4_10 - b.avg_gap_4_10)[0];

  container.innerHTML = [
    quickFindingCard("Highest score shown", mostEven.league, `Relative parity score ${mostEven.parity_score_0_100.toFixed(1)} / 100`),
    quickFindingCard("Largest first-to-last gap", steepestCurve.league, `Average gap ${steepestCurve.curve_drop.toFixed(3)} PPG`),
    quickFindingCard("Widest top-end gap", widestTopGap.league, `1st to 4th gap ${widestTopGap.avg_gap_1_4.toFixed(3)} PPG`),
    quickFindingCard("Tightest mid-table", tightestMid.league, `4th to 10th gap ${tightestMid.avg_gap_4_10.toFixed(3)} PPG`)
  ].join("");
}

function quickFindingCard(label, title, detail) {
  return `<article class="quick-finding"><span class="quick-finding-label">${label}</span><strong>${title}</strong><span>${detail}</span></article>`;
}

function renderMainChart(derived) {
  const canvas = document.getElementById("parity-chart");
  if (state.charts.main) {
    state.charts.main.destroy();
  }

  const data = buildMainChartData(derived);
  state.charts.main = new Chart(canvas, {
    type: state.mode === "avg_ppg" ? "line" : "bar",
    data,
    options: buildMainChartOptions()
  });

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
          data: rows.map((row) => ({ x: row.rank, y: row.avg_ppg, seasonCount: row.season_count })),
          borderColor: useMuted ? "rgba(102, 93, 82, 0.35)" : colorForLeague(league, false),
          backgroundColor: useMuted ? "rgba(102, 93, 82, 0.35)" : colorForLeague(league, false),
          borderWidth: isHighlighted ? 4 : 3,
          pointRadius: 0,
          pointHoverRadius: isHighlighted ? 5 : 3,
          tension: 0.28
        };
      });
    return { datasets };
  }

  const metricKey = state.mode === "gap_top" ? "avg_gap_1_4" : "avg_gap_4_10";
  return {
    labels: derived.metrics.map((row) => row.league),
    datasets: [{
      label: MODE_META[state.mode].label,
      data: derived.metrics.map((row) => row[metricKey]),
      backgroundColor: derived.metrics.map((row) => colorForLeague(row.league, true)),
      borderRadius: 10,
      borderSkipped: false
    }]
  };
}

function buildMainChartOptions() {
  const meta = MODE_META[state.mode];
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: {
        display: state.mode === "avg_ppg",
        position: "bottom",
        labels: { usePointStyle: true, color: "#1d1915", boxWidth: 10, padding: 18 }
      },
      tooltip: {
        backgroundColor: "rgba(29, 25, 21, 0.93)",
        titleColor: "#fffaf3",
        bodyColor: "#fffaf3",
        padding: 12,
        displayColors: state.mode === "avg_ppg",
        callbacks: {
          title(items) {
            return state.mode === "avg_ppg" ? `Rank ${items[0].raw.x}` : items[0].label;
          },
          label(context) {
            const value = Number(context.raw.y ?? context.raw).toFixed(3);
            return state.mode === "avg_ppg"
              ? `${context.dataset.label}: ${value} PPG (${context.raw.seasonCount} season${context.raw.seasonCount === 1 ? "" : "s"})`
              : `${value} PPG gap`;
          }
        }
      }
    },
    scales: state.mode === "avg_ppg" ? {
      x: {
        type: "linear",
        title: { display: true, text: "League rank", color: "#665d52" },
        ticks: { stepSize: 1, color: "#665d52" },
        grid: { color: "rgba(29, 25, 21, 0.08)" }
      },
      y: {
        title: { display: true, text: meta.yTitle, color: "#665d52" },
        ticks: {
          color: "#665d52",
          callback(value) {
            return value.toFixed(1);
          }
        },
        grid: { color: "rgba(29, 25, 21, 0.08)" }
      }
    } : {
      x: { ticks: { color: "#665d52" }, grid: { display: false } },
      y: {
        beginAtZero: true,
        title: { display: true, text: meta.yTitle, color: "#665d52" },
        ticks: {
          color: "#665d52",
          callback(value) {
            return value.toFixed(2);
          }
        },
        grid: { color: "rgba(29, 25, 21, 0.08)" }
      }
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

function renderSupportCharts(metrics) {
  renderSupportChart("topGap", "support-top-gap-chart", metrics, "avg_gap_1_4");
  renderSupportChart("bottomGap", "support-bottom-gap-chart", metrics, "avg_gap_10_last");
}

function renderSupportChart(chartKey, canvasId, metrics, metricKey) {
  const canvas = document.getElementById(canvasId);
  if (state.charts[chartKey]) {
    state.charts[chartKey].destroy();
  }

  state.charts[chartKey] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: metrics.map((row) => row.league),
      datasets: [{
        data: metrics.map((row) => row[metricKey]),
        backgroundColor: metrics.map((row) => colorForLeague(row.league, true)),
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(29, 25, 21, 0.93)",
          titleColor: "#fffaf3",
          bodyColor: "#fffaf3",
          padding: 10,
          callbacks: {
            label(context) {
              return `${Number(context.raw).toFixed(3)} PPG gap`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#665d52" }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#665d52",
            callback(value) {
              return value.toFixed(2);
            }
          },
          grid: { color: "rgba(29, 25, 21, 0.08)" }
        }
      }
    }
  });
}

function renderInsightBox(derived) {
  const container = document.getElementById("insight-box");
  if (!derived.metrics.length) {
    container.innerHTML = "<p>Select at least one league and one season to see the findings.</p>";
    return;
  }

  if (derived.metrics.length === 1) {
    const league = derived.metrics[0];
    container.innerHTML = `<ul>
      <li>${league.league} is the only active league, so the current view reads as a profile rather than a comparison.</li>
      <li>Its average first-to-last gap is ${league.curve_drop.toFixed(3)} PPG, calculated within each season before averaging.</li>
      <li>The largest average gap per rank step is ${dominantGapLabel(league)}. This adjusts for the different numbers of positions in each band.</li>
    </ul>`;
    return;
  }

  const mostEven = derived.metrics[0];
  const leastEven = [...derived.metrics].sort((a, b) => a.parity_score_0_100 - b.parity_score_0_100)[0];
  const flattest = [...derived.metrics].sort((a, b) => a.curve_drop - b.curve_drop)[0];
  const lowestTableSplit = [...derived.metrics].sort((a, b) => b.avg_gap_10_last - a.avg_gap_10_last)[0];
  const averageMidGap = average(derived.metrics.map((row) => row.avg_gap_4_10));

  container.innerHTML = `<ul>
    <li>${mostEven.league} comes out as the most even selection here, while ${leastEven.league} sits at the other end of the current ranking.</li>
    <li>${flattest.league} has the smallest average first-to-last gap at ${flattest.curve_drop.toFixed(3)} PPG, calculated within each season before averaging.</li>
    <li>${lowestTableSplit.league} has the largest total lower-table gap, averaging ${lowestTableSplit.avg_gap_10_last.toFixed(3)} PPG from 10th to last. This band spans eight or ten rank steps depending on league size.</li>
    <li>Across the active leagues, the average 4th-to-10th gap is ${averageMidGap.toFixed(3)} PPG.</li>
  </ul>`;
}

function renderRankingPanel(metrics) {
  const container = document.getElementById("ranking-panel");
  if (!metrics.length) {
    container.innerHTML = "<h3>Selected ranking</h3><p>No ranking is available until at least one league and one season are active.</p>";
    return;
  }

  container.innerHTML = `<h3>Selected ranking</h3>
    <p>Relative parity score out of 100, compared with all seven leagues over the selected seasons. Higher means more even by this formula. Hiding leagues does not change scores; changing seasons resets the comparison. <a href="#method">See the formula and limits.</a></p>
    <div class="ranking-list">
      ${metrics.map((row, index) => `
        <div class="ranking-row">
          <div class="ranking-row-top">
            <strong>#${index + 1} ${row.league}</strong>
            <small>${row.parity_score_0_100.toFixed(1)}</small>
          </div>
          <div class="ranking-bar"><span style="width: ${row.parity_score_0_100.toFixed(1)}%"></span></div>
        </div>
      `).join("")}
    </div>`;
}

function renderHeadlineCards(metrics) {
  const container = document.getElementById("headline-cards");
  if (!metrics.length) {
    container.innerHTML = `<article class="headline-card"><h3>No league headlines available</h3><p>Select at least one league and one season to populate this section.</p></article>`;
    return;
  }

  container.innerHTML = metrics.map((row, index) => `
    <article class="headline-card">
      <div class="headline-top">
        <h3>${row.league}</h3>
        <span class="headline-rank">#${index + 1}</span>
      </div>
      <div class="headline-score">${row.parity_score_0_100.toFixed(1)}</div>
      <p>${row.summary}</p>
      <div class="headline-metric">
        <span>1st to last gap</span>
        <strong>${row.curve_drop.toFixed(3)}</strong>
      </div>
      <div class="headline-metric">
        <span>1st to 4th gap</span>
        <strong>${row.avg_gap_1_4.toFixed(3)}</strong>
      </div>
      <div class="headline-metric">
        <span>10th to last gap</span>
        <strong>${row.avg_gap_10_last.toFixed(3)}</strong>
      </div>
    </article>
  `).join("");
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

function syncSeasonControls() {
  const startSelect = document.getElementById("season-start-select");
  const endSelect = document.getElementById("season-end-select");
  const label = document.getElementById("season-range-label");
  const count = document.getElementById("season-range-count");

  if (!state.selectedSeasons.length) {
    label.textContent = "No seasons selected";
    count.textContent = "0 seasons selected";
    return;
  }

  startSelect.value = state.selectedSeasons[0];
  endSelect.value = state.selectedSeasons[state.selectedSeasons.length - 1];
  label.textContent = state.selectedSeasons.length === 1
    ? state.selectedSeasons[0]
    : `${state.selectedSeasons[0]} to ${state.selectedSeasons[state.selectedSeasons.length - 1]}`;
  count.textContent = `${state.selectedSeasons.length} season${state.selectedSeasons.length === 1 ? "" : "s"} selected`;
}

function syncHighlightSelect() {
  const select = document.getElementById("highlight-league");
  if (state.highlightLeague && !state.selectedLeagues.includes(state.highlightLeague)) {
    state.highlightLeague = "";
  }
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
