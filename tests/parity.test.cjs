const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function app(document = { addEventListener() {} }) {
  const context = vm.createContext({ document });
  vm.runInContext(read("assets/js/main.js"), context);
  context.masterText = read("data/league_team_season_master_7leagues_10seasons.csv");
  context.gapText = read("data/league_season_gaps.csv");
  vm.runInContext(`
    state.masterRows = parseCsv(masterText);
    state.seasonGapRows = parseCsv(gapText);
    state.allLeagues = uniqueValues(state.masterRows, "league");
    state.allSeasons = uniqueValues(state.masterRows, "season");
    state.selectedLeagues = [...state.allLeagues];
    state.selectedSeasons = [...state.allSeasons];
  `, context);
  return (code) => vm.runInContext(code, context);
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("first-to-last gaps use each season's endpoint when Ligue 1 changes size", () => {
  const run = app();
  run('state.selectedSeasons = ["2022/23", "2023/24", "2024/25"]; state.selectedLeagues = ["Ligue 1"];');
  const metric = run("getDerivedSelection().metrics[0]");
  const expected = run(`average(state.seasonGapRows.filter(row => row.league === "Ligue 1" && state.selectedSeasons.includes(row.season)).map(row => row.ppg_1 - row.ppg_last))`);
  near(metric.curve_drop, expected);
  assert.equal(metric.curve_drop.toFixed(3), "1.754");
  assert.equal(run('getDerivedSelection().rankCurves["Ligue 1"].find(row => row.rank === 20).season_count'), 1);
  assert.equal(run('getDerivedSelection().rankCurves["Ligue 1"].find(row => row.rank === 18).season_count'), 3);
});

test("league visibility cannot change scores, across every season window", () => {
  const run = app();
  for (let start = 0; start < 10; start++) {
    for (let end = start; end < 10; end++) {
      run(`state.selectedSeasons = state.allSeasons.slice(${start}, ${end + 1}); state.selectedLeagues = [...state.allLeagues];`);
      const all = run("getDerivedSelection().metrics");
      for (const expected of all) {
        run(`state.selectedLeagues = [${JSON.stringify(expected.league)}];`);
        const actual = run("getDerivedSelection().metrics[0]");
        near(actual.parity_score_0_100, expected.parity_score_0_100);
        assert.ok(Object.values(actual).every(value => typeof value !== "number" || Number.isFinite(value)));
      }
    }
  }
  run('state.selectedSeasons = [...state.allSeasons]; state.selectedLeagues = ["Premier League"];');
  near(run("getDerivedSelection().metrics[0].parity_score_0_100"), 0);
});

test("band insights use the mean of within-season gaps per rank step", () => {
  const run = app();
  assert.equal(run(`dominantGapLabel({avg_step_top: 0.6 / 3, avg_step_mid: 0.9 / 6, avg_step_bottom: 1.0 / 10})`), "near the top of the table");
  run('state.selectedSeasons = ["2022/23", "2023/24", "2024/25"];');
  const expected = run(`average(state.seasonGapRows.filter(row => row.league === "Ligue 1" && state.selectedSeasons.includes(row.season)).map(row => row.gap_10_last / (row.season === "2022/23" ? 10 : 8)))`);
  near(run('getDerivedSelection().metrics.find(row => row.league === "Ligue 1").avg_step_bottom'), expected);
});

test("full-window metrics agree with independently rebuilt CSV summaries", () => {
  const run = app();
  const summary = run(`parseCsv(${JSON.stringify(read("data/league_summary.csv"))})`);
  const headlines = run(`parseCsv(${JSON.stringify(read("data/league_headlines.csv"))})`);
  for (const actual of run("getDerivedSelection().metrics")) {
    const expected = summary.find(row => row.league === actual.league);
    near(actual.parity_score_simple, expected.parity_score_simple);
    assert.equal(Number(actual.parity_score_0_100.toFixed(1)), expected.parity_score_0_100);
    near(actual.curve_drop, headlines.find(row => row.league === actual.league).curve_drop);
  }
});

test("empty filters produce no metrics, and a tied baseline is neutral", () => {
  const run = app();
  run("state.selectedLeagues = [];");
  assert.equal(run("getDerivedSelection().metrics.length"), 0);
  run("state.selectedLeagues = [...state.allLeagues]; state.selectedSeasons = [];");
  assert.equal(run("getDerivedSelection().metrics.length"), 0);
  near(run('buildLeagueMetrics(state.masterRows.filter(r => r.league === "La Liga"), state.seasonGapRows.filter(r => r.league === "La Liga"))[0].parity_score_0_100'), 50);
});

test("league and mode buttons expose their selected states after updates", () => {
  const button = (dataset) => ({ dataset, attributes: {}, active: false,
    classList: { toggle(name, active) { this.active = active; } },
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const leagues = [button({ league: "La Liga" }), button({ league: "Premier League" })];
  const modes = [button({ mode: "avg_ppg" }), button({ mode: "gap_top" })];
  const run = app({ addEventListener() {}, querySelectorAll: selector => selector === ".league-pill" ? leagues : modes });
  run('state.selectedLeagues = ["La Liga"]; state.mode = "gap_top"; syncLeagueButtons(); syncModeButtons();');
  assert.deepEqual(leagues.map(b => b.attributes["aria-pressed"]), ["true", "false"]);
  assert.deepEqual(modes.map(b => b.attributes["aria-pressed"]), ["false", "true"]);
  run('state.selectedLeagues = ["Premier League"]; state.mode = "avg_ppg"; syncLeagueButtons(); syncModeButtons();');
  assert.deepEqual(leagues.map(b => b.attributes["aria-pressed"]), ["false", "true"]);
  assert.deepEqual(modes.map(b => b.attributes["aria-pressed"]), ["true", "false"]);
});
