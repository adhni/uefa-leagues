const modes = ["avg_ppg", "gap_top", "gap_mid"];
const sortKeys = ["league", "parity_score_0_100", "avg_gap_1_4", "avg_gap_4_10", "avg_gap_10_last", "avg_ppg_sd"];
const slug = (league) => league.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function readSelection(search, leagues, seasons) {
  const params = new URLSearchParams(search);
  let selectedLeagues = [...leagues];
  if (params.has("leagues")) {
    const requested = params.get("leagues").split(",");
    const valid = leagues.filter((league) => requested.includes(slug(league)));
    if (valid.length || params.get("leagues") === "") selectedLeagues = valid;
  }
  const start = Math.max(0, seasons.indexOf(params.get("from")));
  const requestedEnd = seasons.indexOf(params.get("to"));
  const end = requestedEnd < 0 ? seasons.length - 1 : requestedEnd;
  const selectedSeasons = seasons.slice(Math.min(start, end), Math.max(start, end) + 1);
  const highlightLeague = selectedLeagues.find((league) => slug(league) === params.get("focus")) || "";
  const [key, direction] = (params.get("sort") || "").split(":");
  return { selectedLeagues, selectedSeasons, highlightLeague,
    mode: modes.includes(params.get("view")) ? params.get("view") : "avg_ppg",
    excludeIncomplete: params.get("complete") === "1",
    tableSort: sortKeys.includes(key) && ["asc", "desc"].includes(direction)
      ? { key, direction } : { key: "parity_score_0_100", direction: "desc" }
  };
}

export function selectionSearch(state, search = "") {
  const params = new URLSearchParams(search);
  for (const key of ["leagues", "from", "to", "focus", "view", "complete", "sort"]) params.delete(key);
  if (state.selectedLeagues.length !== state.allLeagues.length) {
    params.set("leagues", [...state.selectedLeagues].sort().map(slug).join(","));
  }
  if (state.selectedSeasons[0] !== state.allSeasons[0]) params.set("from", state.selectedSeasons[0]);
  if (state.selectedSeasons.at(-1) !== state.allSeasons.at(-1)) params.set("to", state.selectedSeasons.at(-1));
  if (state.highlightLeague) params.set("focus", slug(state.highlightLeague));
  if (state.mode !== "avg_ppg") params.set("view", state.mode);
  if (state.excludeIncomplete) params.set("complete", "1");
  if (state.tableSort.key !== "parity_score_0_100" || state.tableSort.direction !== "desc") {
    params.set("sort", `${state.tableSort.key}:${state.tableSort.direction}`);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
