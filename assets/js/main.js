import { parseCsv, uniqueValues, validateDatasets, escapeHtml } from "./data.js";
import { deriveSelection, buildSensitivity, getSortedMetrics, buildTakeaway } from "./metrics.js";
import { renderMainChart, lineStyleForLeague } from "./charts.js";
import { readSelection, selectionSearch } from "./selection.js";

const BIG_FIVE = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

const MODE_META = {
  avg_ppg: {
    label: "Average PPG by rank",
    kicker: "Points per game, from first to last",
    explainer: "Each point is an average at that rank. Leagues have 18 or 20 teams. The PPG scale stays fixed across selections. Select a legend label to focus a league.",
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
  coverage: null,
  excludeIncomplete: false,
  controlsBound: false,
  charts: {
    main: null
  },
  cache: {
    key: "",
    derived: null
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("retry-data").addEventListener("click", init);
  init();
});

async function init() {
  setLoading(true);
  try {
    const [masterRows, seasonGapRows, coverage] = await Promise.all([
      loadCsv("data/league_team_season_master_7leagues_10seasons.csv"),
      loadCsv("data/league_season_gaps.csv"),
      loadJson("data/coverage.json")
    ]);
    const validated = validateDatasets(masterRows, seasonGapRows, coverage);
    state.masterRows = validated.masterRows;
    state.seasonGapRows = validated.seasonGapRows;
    state.coverage = coverage;
    state.cache = { key: "", derived: null };
    state.allLeagues = uniqueValues(state.masterRows, "league");
    state.allSeasons = uniqueValues(state.masterRows, "season");
    Object.assign(state, readSelection(window.location.search, state.allLeagues, state.allSeasons));

    renderStaticControls();
    if (!state.controlsBound) {
      bindControls();
      state.controlsBound = true;
    }
    refreshView();
  } catch (error) {
    console.error(error);
    showDataError();
  } finally {
    setLoading(false);
  }
}

async function loadCsv(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return parseCsv(await response.text());
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function setLoading(loading) {
  document.getElementById("data-loading").classList.toggle("is-hidden", !loading);
  document.getElementById("retry-data").disabled = loading;
  if (loading) document.getElementById("data-error").classList.add("is-hidden");
  document.querySelectorAll("[data-interactive]").forEach((element) => {
    element.inert = loading;
    element.setAttribute("aria-busy", String(loading));
    if (loading) element.classList.remove("is-hidden");
  });
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

  document.getElementById("exclude-incomplete").addEventListener("change", (event) => {
    state.excludeIncomplete = event.target.checked;
    refreshView();
  });
  document.getElementById("retry-chart").addEventListener("click", retryChart);
  window.addEventListener("popstate", () => {
    Object.assign(state, readSelection(window.location.search, state.allLeagues, state.allSeasons));
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
  updateChartCopy(derived);
  renderMainChart(state, derived, colorForLeague, MODE_META);
  renderChartLegend(derived.metrics);
  renderTakeaway(derived.metrics);
  renderComparisonTable(derived.metrics);
  renderSensitivity(derived);
  syncUrl();
}

function getDerivedSelection() {
  const seasons = effectiveSeasons();
  const key = `${[...state.selectedLeagues].sort().join("|")}::${seasons.join("|")}`;
  if (state.cache.key === key && state.cache.derived) {
    return state.cache.derived;
  }

  const derived = deriveSelection(state.masterRows, state.seasonGapRows, state.selectedLeagues, seasons);
  derived.sensitivity = buildSensitivity(state.masterRows, state.seasonGapRows, seasons, state.selectedLeagues);

  state.cache.key = key;
  state.cache.derived = derived;
  return derived;
}

function effectiveSeasons() {
  return state.selectedSeasons.filter((season) => !state.excludeIncomplete ||
    state.coverage.league_seasons.filter((row) => row.season === season).every((row) => row.complete));
}

function syncUrl() {
  const query = selectionSearch(state, window.location.search);
  if (query !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${query}${window.location.hash}`);
}

async function retryChart() {
  const button = document.getElementById("retry-chart");
  button.disabled = true;
  try {
    if (typeof globalThis.Chart !== "function") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `assets/vendor/chart.umd.js?retry=${Date.now()}`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    refreshView();
  } catch (error) {
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function updateSelectionSummary() {
  const seasons = state.selectedSeasons;
  const count = effectiveSeasons().length;
  const period = seasons.length === 1 ? seasons[0] : seasons.length ? `${seasons[0]}–${seasons[seasons.length - 1]}` : "No seasons";
  document.getElementById("selection-summary").textContent = `${period}${count !== seasons.length ? " · Completed seasons only" : ""}${state.highlightLeague ? ` · Focus: ${state.highlightLeague}` : ""}`;
  document.getElementById("mobile-filter-summary").textContent = `${state.selectedLeagues.length} league${state.selectedLeagues.length === 1 ? "" : "s"} · ${count} season${count === 1 ? "" : "s"}`;
}

function updateChartCopy(derived) {
  const meta = MODE_META[state.mode];
  const curves = derived.rankCurves["Ligue 1"];
  const mixedCounts = curves && new Set(curves.map((row) => row.season_count)).size > 1;
  document.getElementById("chart-kicker").textContent = meta.kicker;
  document.getElementById("chart-explainer").textContent = `${meta.explainer}${state.mode === "avg_ppg" && mixedCounts ? " Ligue 1 ranks 19–20 cover fewer selected seasons; sample counts are shown in the chart values." : ""}`;
  document.getElementById("parity-chart").setAttribute("aria-label", `${meta.label}. ${state.selectedLeagues.length} leagues, ${effectiveSeasons().length} seasons. Values are available in View chart data below.`);
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
      state.excludeIncomplete = false;
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
      syncUrl();
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
    const controls = [...dialog.querySelectorAll("button, input, select, summary, a[href], [tabindex]")]
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
    if (!controls.length) return;
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
    <button class="legend-button" type="button" data-focus="${row.league}" aria-label="Highlight ${row.league}" aria-pressed="${state.highlightLeague === row.league}" style="--league-color: ${colorForLeague(row.league, true)}"><svg class="legend-line" width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="${lineStyleForLeague(row.league).join(" ")}"/></svg>${escapeHtml(row.league)}</button>
  `).join("");
}

function renderTakeaway(metrics) {
  document.getElementById("takeaway-text").innerHTML = buildTakeaway(metrics, state.mode);
}

function renderComparisonTable(metrics) {
  document.querySelectorAll("[data-sort]").forEach((button) => {
    const active = button.dataset.sort === state.tableSort.key;
    button.closest("th").setAttribute("aria-sort", active ? (state.tableSort.direction === "asc" ? "ascending" : "descending") : "none");
    button.querySelector(".sort-icon").textContent = active ? (state.tableSort.direction === "asc" ? "↑" : "↓") : "↕";
  });
  document.getElementById("comparison-body").innerHTML = metrics.length ? getSortedMetrics(metrics, state.tableSort).map((row) => `
    <tr class="${state.highlightLeague === row.league ? "is-focused" : ""}" style="--league-color: ${colorForLeague(row.league, false)}">
      <td><button class="table-league" type="button" data-focus="${row.league}" aria-label="Highlight ${row.league} in the chart" aria-pressed="${state.highlightLeague === row.league}"><span class="league-dot" aria-hidden="true"></span>${row.league}</button></td>
      <td><div class="score-cell"><span class="score-track" aria-hidden="true"><span style="width: ${row.parity_score_0_100.toFixed(1)}%"></span></span><span class="score-value">${row.parity_score_0_100.toFixed(1)}</span></div></td>
      <td>${row.avg_gap_1_4.toFixed(3)}</td><td>${row.avg_gap_4_10.toFixed(3)}</td><td>${row.avg_gap_10_last.toFixed(3)}</td><td>${row.avg_ppg_sd.toFixed(3)}</td>
    </tr>
  `).join("") : '<tr><td colspan="6">No data selected. Reset the view or choose a league and season.</td></tr>';
}

function renderSensitivity(derived) {
  const seasons = effectiveSeasons();
  const exceptional = uniqueValues(state.coverage.league_seasons.filter((row) => !row.complete && seasons.includes(row.season)), "season");
  document.getElementById("season-context").textContent = exceptional.length
    ? `${exceptional.join(", ")} includes curtailed seasons. Explore the ranking sensitivity below or use completed seasons only in More options.`
    : state.excludeIncomplete ? "Completed seasons only: a curtailed season is excluded for every league." : "All selected seasons were completed.";
  document.getElementById("sensitivity-note").textContent = seasons.length > 1
    ? "Leave out each selected season in turn and recalculate the ranking across all seven leagues. The range shows how much the rank changes; it is a descriptive check, not a confidence interval."
    : "Select at least two completed or included seasons to compare rankings when a season is left out.";
  document.getElementById("sensitivity-body").innerHTML = derived.sensitivity.length
    ? derived.sensitivity.map((row) => `<tr><th scope="row">${escapeHtml(row.league)}</th><td>${row.rank}</td><td>${seasons.length > 1 ? (row.best === row.worst ? row.best : `${row.best}–${row.worst}`) : "—"}</td></tr>`).join("")
    : '<tr><td colspan="3">Choose a league and a season to see the ranking.</td></tr>';
}

function syncSeasonControls() {
  const startSelect = document.getElementById("season-start-select");
  const endSelect = document.getElementById("season-end-select");
  const count = document.getElementById("season-range-count");
  startSelect.value = state.selectedSeasons[0] || "";
  endSelect.value = state.selectedSeasons[state.selectedSeasons.length - 1] || "";
  const included = effectiveSeasons().length;
  count.textContent = `${included}${included !== state.selectedSeasons.length ? ` of ${state.selectedSeasons.length}` : ""} season${included === 1 ? "" : "s"}`;
  document.getElementById("exclude-incomplete").checked = state.excludeIncomplete;
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
    return "#7b756c";
  }
  return baseColor;
}

function showDataError() {
  document.getElementById("data-error").classList.remove("is-hidden");
  document.querySelectorAll("[data-interactive]").forEach((element) => {
    element.classList.add("is-hidden");
  });
}
