// Pure calculations; no browser, fetch or chart dependencies.
export function buildRankCurves(rows) {
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

export function buildLeagueMetrics(masterRows, gapRows) {
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
    const gapSeasons = new Set(leagueGapRows.map((row) => row.season));
    if (leagueGapRows.length !== Object.keys(perSeasonRows).length || gapSeasons.size !== leagueGapRows.length ||
        Object.keys(perSeasonRows).some((season) => !gapSeasons.has(season))) {
      throw new Error(`Missing or duplicated gap records for ${league}`);
    }
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
      season_count: seasonMetrics.length,
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
      // The three adjoining band gaps telescope to first-to-last.
      parity_score_simple: -(metrics.curve_drop + metrics.avg_gap_1_2 + metrics.avg_ppg_sd)
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
    .sort((a, b) => b.parity_score_0_100 - a.parity_score_0_100 || a.league.localeCompare(b.league));
}

export function dominantGapLabel(row) {
  return [
    ["near the top of the table", row.avg_step_top],
    ["through the middle of the table", row.avg_step_mid],
    ["lower down the table", row.avg_step_bottom]
  ].sort((a, b) => b[1] - a[1])[0][0];
}

export function buildHeadlineSummary(row) {
  return `The largest average PPG gap per rank step is ${dominantGapLabel(row)}, after adjusting each band for the number of positions it spans.`;
}

export function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

export function sampleStandardDeviation(values) {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  const squaredDistanceSum = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0);
  return Math.sqrt(squaredDistanceSum / (values.length - 1));
}

export function deriveSelection(masterRows, gapRows, leagues, seasons) {
  const seasonMasterRows = masterRows.filter((row) => seasons.includes(row.season));
  const seasonGapRows = gapRows.filter((row) => seasons.includes(row.season));
  const filteredMasterRows = seasonMasterRows.filter((row) => leagues.includes(row.league));
  const metrics = buildLeagueMetrics(seasonMasterRows, seasonGapRows).filter((row) => leagues.includes(row.league));
  return { filteredMasterRows, rankCurves: buildRankCurves(filteredMasterRows), metrics };
}

export function buildSensitivity(masterRows, gapRows, seasons, leagues) {
  const selectedMaster = masterRows.filter((row) => seasons.includes(row.season));
  const selectedGaps = gapRows.filter((row) => seasons.includes(row.season));
  const full = buildLeagueMetrics(selectedMaster, selectedGaps);
  const rank = (row, rows) => 1 + rows.filter((other) => other.parity_score_simple > row.parity_score_simple + 1e-9).length;
  const ranges = new Map(full.map((row) => [row.league, { league: row.league, rank: rank(row, full), ranks: [] }]));
  if (seasons.length > 1) {
    for (const omitted of seasons) {
      const rows = buildLeagueMetrics(selectedMaster.filter((row) => row.season !== omitted), selectedGaps.filter((row) => row.season !== omitted));
      rows.forEach((row) => ranges.get(row.league).ranks.push(rank(row, rows)));
    }
  }
  return [...ranges.values()].filter((row) => leagues.includes(row.league)).map((row) => ({
    league: row.league, rank: row.rank,
    best: row.ranks.length ? Math.min(...row.ranks) : row.rank,
    worst: row.ranks.length ? Math.max(...row.ranks) : row.rank
  }));
}

export function getSortedMetrics(metrics, sort = { key: "parity_score_0_100", direction: "desc" }) {
  return [...metrics].sort((a, b) => {
    const difference = sort.key === "league" ? a.league.localeCompare(b.league) : a[sort.key] - b[sort.key];
    return (sort.direction === "asc" ? difference : -difference) || a.league.localeCompare(b.league);
  });
}

export function buildTakeaway(metrics, mode) {
  if (!metrics.length) return "Choose at least one league and one season to explore the comparison.";
  const key = mode === "avg_ppg" ? "curve_drop" : mode === "gap_top" ? "avg_gap_1_4" : "avg_gap_4_10";
  const band = mode === "avg_ppg" ? "first-to-last" : mode === "gap_top" ? "1st-to-4th" : "4th-to-10th";
  const rows = [...metrics].sort((a, b) => a[key] - b[key]);
  const first = rows[0], last = rows.at(-1);
  if (rows.length === 1) return `<strong>${first.league}</strong> has an average ${band} gap of <strong>${first[key].toFixed(3)} PPG</strong> over the selected seasons. Add another league to compare.`;
  if (last[key].toFixed(3) === first[key].toFixed(3)) return `The selected leagues have the same average ${band} gap to three decimals: <strong>${first[key].toFixed(3)} PPG</strong>.`;
  return `<strong>${first.league}</strong> has the smallest average ${band} gap among the selected leagues: <strong>${first[key].toFixed(3)} PPG</strong>, compared with <strong>${last[key].toFixed(3)}</strong> in ${last.league}.`;
}
