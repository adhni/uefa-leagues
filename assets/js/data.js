// CSV decoding and dataset validation are independent of the DOM and chart library.
export function parseCsv(text) {
  const input = String(text).replace(/^\uFEFF/, "");
  const records = [];
  let fields = [], value = "", quoted = false, closedQuote = false;
  const finishField = () => { fields.push(value.trim()); value = ""; closedQuote = false; };
  const finishRecord = () => {
    finishField();
    if (fields.some((field) => field !== "")) records.push(fields);
    fields = [];
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else value += char;
    } else if (char === '"') {
      if (value !== "" || closedQuote) throw new Error("Unexpected quote in CSV");
      quoted = true;
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      finishRecord();
    } else {
      if (closedQuote && !/\s/.test(char)) throw new Error("Text after a quoted CSV field");
      if (!closedQuote) value += char;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV field");
  if (value || fields.length || closedQuote) finishRecord();
  if (!records.length) throw new Error("Empty CSV");
  const [headers, ...rows] = records;
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error("Missing or duplicated CSV headers");
  }
  if (!rows.length) throw new Error("CSV has no records");
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of fields`);
    return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
  });
}

export function normalizeSeason(season) {
  return String(season).replace("-", "/");
}

export function compareSeasons(a, b) {
  return Number(a.slice(0, 4)) - Number(b.slice(0, 4));
}

export function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]))].sort(key === "season" ? compareSeasons : undefined);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function number(row, field, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const raw = row[field];
  if (raw === undefined || raw === null || String(raw).trim() === "") throw new Error(`Missing ${field}`);
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw new Error(`Invalid ${field}`);
  }
  row[field] = value;
  return value;
}

function groupKey(row) { return `${row.league}::${row.season}`; }

export function validateDatasets(masterInput, gapInput, manifest) {
  const coverage = manifest?.league_seasons;
  if (manifest?.schema_version !== 1 || !Array.isArray(coverage) || !coverage.length) throw new Error("Invalid coverage manifest");
  const expected = new Map();
  for (const spec of coverage) {
    if (typeof spec.league !== "string" || !spec.league.trim() || typeof spec.country !== "string" ||
        !/^\d{4}\/\d{2}$/.test(spec.season) || !Number.isInteger(spec.team_count) || spec.team_count <= 10 ||
        spec.scheduled_matches !== 2 * (spec.team_count - 1) || typeof spec.complete !== "boolean") {
      throw new Error("Invalid coverage entry");
    }
    const key = groupKey(spec);
    if (expected.has(key)) throw new Error("Duplicated coverage entry");
    expected.set(key, spec);
  }
  if (!masterInput.length || !gapInput.length) throw new Error("Empty dataset");
  const groups = new Map(), teams = new Set();
  const masterRows = masterInput.map((input) => {
    const row = { ...input, season: normalizeSeason(input.season) };
    const key = groupKey(row), spec = expected.get(key);
    if (!spec || row.country !== spec.country || typeof row.team !== "string" || !row.team.trim()) {
      throw new Error("Unknown league-season, country, or empty team");
    }
    const teamKey = `${key}::${row.team}`;
    if (teams.has(teamKey)) throw new Error("Duplicate team-season");
    teams.add(teamKey);
    number(row, "rank", { integer: true, min: 1, max: spec.team_count });
    const matches = number(row, "matches_played", { integer: true, min: 1, max: spec.scheduled_matches });
    if (spec.complete && matches !== spec.scheduled_matches) throw new Error("Incomplete match count");
    const points = number(row, "points", { integer: true, min: -3 * matches, max: 3 * matches });
    const earned = number(row, "points_earned", { integer: true, min: 0, max: 3 * matches });
    const adjustment = number(row, "points_adjustment", { integer: true, min: -3 * matches, max: 3 * matches });
    const [wins, draws, losses] = ["wins", "draws", "losses"].map((field) => number(row, field, { integer: true, min: 0, max: matches }));
    if (wins + draws + losses !== matches || earned !== 3 * wins + draws || points !== earned + adjustment) {
      throw new Error("Inconsistent matches or points adjustment");
    }
    const [gf, ga] = ["goals_for", "goals_against"].map((field) => number(row, field, { integer: true, min: 0 }));
    if (number(row, "goal_difference", { integer: true }) !== gf - ga) throw new Error("Inconsistent goal difference");
    const ppg = number(row, "ppg", { min: -3, max: 3 });
    if (Math.abs(ppg - points / matches) > 0.000051) throw new Error("Inconsistent PPG");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return row;
  });
  if (groups.size !== expected.size) throw new Error("Missing league-seasons");
  for (const [key, rows] of groups) {
    rows.sort((a, b) => a.rank - b.rank);
    if (rows.length !== expected.get(key).team_count || rows.some((row, i) => row.rank !== i + 1)) {
      throw new Error("Incomplete or duplicated league ranks");
    }
    if (rows.reduce((sum, row) => sum + row.goals_for - row.goals_against, 0) !== 0 ||
        rows.reduce((sum, row) => sum + row.wins - row.losses, 0) !== 0) throw new Error("Unbalanced league results");
  }
  const gapKeys = new Set();
  const seasonGapRows = gapInput.map((input) => {
    const row = { ...input, season: normalizeSeason(input.season) };
    const key = groupKey(row), ranked = groups.get(key);
    if (!ranked || gapKeys.has(key)) throw new Error("Unknown or duplicated gap league-season");
    gapKeys.add(key);
    const [first, second, fourth, tenth, last] = [ranked[0], ranked[1], ranked[3], ranked[9], ranked.at(-1)].map((item) => item.ppg);
    const values = { ppg_1: first, ppg_2: second, ppg_4: fourth, ppg_10: tenth, ppg_last: last,
      gap_1_2: first - second, gap_1_4: first - fourth, gap_4_10: fourth - tenth, gap_10_last: tenth - last };
    for (const [field, value] of Object.entries(values)) {
      if (Math.abs(number(row, field) - value) > 1e-9) throw new Error(`Stale or inconsistent ${field}`);
    }
    return row;
  });
  if (gapKeys.size !== expected.size) throw new Error("Missing gap league-seasons");
  return { masterRows, seasonGapRows };
}
