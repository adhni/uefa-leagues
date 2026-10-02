import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { parseCsv, validateDatasets, uniqueValues } from "../assets/js/data.js";
import { buildLeagueMetrics, deriveSelection, buildSensitivity, getSortedMetrics, buildTakeaway, dominantGapLabel } from "../assets/js/metrics.js";
import { readSelection, selectionSearch } from "../assets/js/selection.js";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("data/coverage.json"));
const rawMaster = parseCsv(read("data/league_team_season_master_7leagues_10seasons.csv"));
const rawGaps = parseCsv(read("data/league_season_gaps.csv"));
const { masterRows: master, seasonGapRows: gaps } = validateDatasets(rawMaster, rawGaps, manifest);
const leagues = uniqueValues(master, "league"), seasons = uniqueValues(master, "season");
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const derive = (selectedLeagues = leagues, selectedSeasons = seasons) => deriveSelection(master, gaps, selectedLeagues, selectedSeasons);

test("CSV decodes commas, escaped quotes, multiline fields, BOM and CRLF", () => {
  assert.deepEqual(parseCsv('\uFEFFteam,ppg\r\n"A, ""B""\nC",1.25\r\n'), [{ team: 'A, "B"\nC', ppg: "1.25" }]);
});

test("CSV rejects empty, header-only, duplicated headers and malformed records", () => {
  for (const text of ["", "league,ppg\n", "league,league\nA,B", 'league,ppg\n"unclosed,1', "league,ppg\nA", 'league,ppg\n"A"B,1']) {
    assert.throws(() => parseCsv(text));
  }
});

test("dataset validation rejects empty gap rows and incomplete coverage", () => {
  assert.throws(() => validateDatasets(rawMaster, [], manifest), /Empty/);
  assert.throws(() => validateDatasets(rawMaster.slice(0, -1), rawGaps, manifest), /count|ranks/);
  assert.throws(() => validateDatasets(rawMaster.filter((row) => row.league !== "Premier League"), rawGaps, manifest), /Missing/);
  assert.throws(() => validateDatasets(rawMaster, rawGaps.slice(1), manifest), /Missing/);
});

test("dataset validation rejects stale gaps, duplicate records and missing numbers", () => {
  const stale = structuredClone(rawGaps); stale[0].gap_1_4 = "0";
  assert.throws(() => validateDatasets(rawMaster, stale, manifest), /Stale/);
  assert.throws(() => validateDatasets(rawMaster, [...rawGaps, rawGaps[0]], manifest), /duplicated/);
  const missing = structuredClone(rawMaster); missing[0].ppg = "";
  assert.throws(() => validateDatasets(missing, rawGaps, manifest), /Missing ppg/);
  assert.throws(() => validateDatasets([...rawMaster, rawMaster[0]], rawGaps, manifest), /Duplicate/);
});

test("metrics cannot turn missing gap records into zero measurements", () => {
  assert.throws(() => buildLeagueMetrics(master, []), /Missing/);
});

test("first-to-last gaps use season endpoints when Ligue 1 changes size", () => {
  const selected = ["2022/23", "2023/24", "2024/25"];
  const derived = derive(["Ligue 1"], selected);
  const expected = gaps.filter((row) => row.league === "Ligue 1" && selected.includes(row.season));
  near(derived.metrics[0].curve_drop, expected.reduce((sum, row) => sum + row.ppg_1 - row.ppg_last, 0) / 3);
  assert.equal(derived.rankCurves["Ligue 1"].find((row) => row.rank === 20).season_count, 1);
  assert.equal(derived.rankCurves["Ligue 1"].find((row) => row.rank === 18).season_count, 3);
});

test("league visibility cannot change scores across every contiguous season window", () => {
  for (let start = 0; start < seasons.length; start++) {
    for (let end = start; end < seasons.length; end++) {
      const selected = seasons.slice(start, end + 1);
      for (const expected of derive(leagues, selected).metrics) {
        const actual = derive([expected.league], selected).metrics[0];
        near(actual.parity_score_0_100, expected.parity_score_0_100);
        assert.ok(Object.values(actual).every((value) => typeof value !== "number" || Number.isFinite(value)));
      }
    }
  }
});

test("band insights normalize by rank steps within each season", () => {
  assert.equal(dominantGapLabel({ avg_step_top: .6 / 3, avg_step_mid: .9 / 6, avg_step_bottom: 1 / 10 }), "near the top of the table");
  const selected = ["2022/23", "2023/24", "2024/25"];
  const expected = gaps.filter((row) => row.league === "Ligue 1" && selected.includes(row.season))
    .reduce((sum, row) => sum + row.gap_10_last / (row.season === "2022/23" ? 10 : 8), 0) / 3;
  near(derive(["Ligue 1"], selected).metrics[0].avg_step_bottom, expected);
});

test("full-window metrics agree with Python-generated CSV outputs", () => {
  const summary = parseCsv(read("data/league_summary.csv")), headlines = parseCsv(read("data/league_headlines.csv"));
  for (const actual of derive().metrics) {
    const expected = summary.find((row) => row.league === actual.league);
    near(actual.parity_score_simple, Number(expected.parity_score_simple));
    assert.equal(Number(actual.parity_score_0_100.toFixed(1)), Number(expected.parity_score_0_100));
    near(actual.curve_drop, Number(headlines.find((row) => row.league === actual.league).curve_drop));
  }
});

test("the adjoining gaps telescope to the simplified score formula", () => {
  for (const row of derive().metrics) {
    near(-row.parity_score_simple, row.curve_drop + row.avg_gap_1_2 + row.avg_ppg_sd);
    near(row.curve_drop, row.avg_gap_1_4 + row.avg_gap_4_10 + row.avg_gap_10_last);
  }
});

test("empty selections produce no metrics and a tied score baseline is neutral", () => {
  assert.deepEqual(derive([]).metrics, []);
  assert.deepEqual(derive(leagues, []).metrics, []);
  near(buildLeagueMetrics(master.filter((r) => r.league === "La Liga"), gaps.filter((r) => r.league === "La Liga"))[0].parity_score_0_100, 50);
});

test("table sorting is numeric, reversible and leaves metrics unchanged", () => {
  const metrics = derive().metrics, before = structuredClone(metrics);
  const asc = getSortedMetrics(metrics, { key: "avg_gap_1_4", direction: "asc" });
  const desc = getSortedMetrics(metrics, { key: "avg_gap_1_4", direction: "desc" });
  assert.equal(asc[0].league, "Serie A"); assert.equal(desc[0].league, "Bundesliga");
  assert.deepEqual(asc.map((row) => row.league).reverse(), desc.map((row) => row.league));
  assert.deepEqual(metrics, before);
  assert.equal(getSortedMetrics(metrics, { key: "league", direction: "asc" })[0].league, "Bundesliga");
});

test("takeaway follows chart mode and handles single and empty selections", () => {
  assert.match(buildTakeaway(derive().metrics, "avg_ppg"), /La Liga.*first-to-last/);
  assert.match(buildTakeaway(derive().metrics, "gap_top"), /Serie A.*1st-to-4th/);
  assert.match(buildTakeaway(derive().metrics, "gap_mid"), /Ligue 1.*4th-to-10th/);
  assert.match(buildTakeaway(derive(["Premier League"]).metrics, "gap_top"), /Add another league/);
  assert.match(buildTakeaway([], "avg_ppg"), /Choose at least one/);
});

test("sensitivity ranks retain the all-league baseline when leagues are hidden", () => {
  const full = buildSensitivity(master, gaps, seasons, leagues);
  const focused = buildSensitivity(master, gaps, seasons, ["Ligue 1"]);
  assert.deepEqual(focused[0], full.find((row) => row.league === "Ligue 1"));
  assert.ok(full.every((row) => row.best >= 1 && row.worst <= 7 && row.best <= row.worst));
  assert.equal(buildSensitivity(master, gaps, [seasons[0]], leagues)[0].best,
    buildSensitivity(master, gaps, [seasons[0]], leagues)[0].rank);
});

test("shared URL round-trips selections, completed-season filter, focus and sorting", () => {
  const selection = { selectedLeagues: ["Serie A", "La Liga"], selectedSeasons: seasons.slice(3, 8),
    mode: "gap_top", highlightLeague: "Serie A", excludeIncomplete: true, tableSort: { key: "avg_ppg_sd", direction: "asc" } };
  const query = selectionSearch({ ...selection, allLeagues: leagues, allSeasons: seasons }, "?campaign=test");
  assert.deepEqual(readSelection(query, leagues, seasons), { ...selection, selectedLeagues: ["La Liga", "Serie A"] });
  assert.ok(query.includes("campaign=test"));
});

test("shared URL preserves an empty league selection and rejects unknown values", () => {
  assert.deepEqual(readSelection("?leagues=", leagues, seasons).selectedLeagues, []);
  const restored = readSelection("?leagues=unknown&view=invalid&focus=unknown&from=bad&sort=bad:bad", leagues, seasons);
  assert.deepEqual(restored.selectedLeagues, leagues);
  assert.deepEqual(restored.selectedSeasons, seasons);
  assert.equal(restored.mode, "avg_ppg"); assert.equal(restored.highlightLeague, "");
  assert.deepEqual(restored.tableSort, { key: "parity_score_0_100", direction: "desc" });
});
