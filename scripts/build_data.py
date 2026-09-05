#!/usr/bin/env python3
"""Validate the supplied master and reproduce derived CSVs using only the stdlib."""

import argparse
import csv
import math
import statistics
from collections import defaultdict
from pathlib import Path


DATA = Path(__file__).resolve().parents[1] / "data"
MASTER = "league_team_season_master_7leagues_10seasons.csv"
GAP_FIELDS = ("gap_1_2", "gap_1_4", "gap_4_10", "gap_10_last")


def read_csv(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def build():
    master = read_csv(DATA / MASTER)
    seasons, ranks = defaultdict(list), defaultdict(list)
    seen = set()
    for row in master:
        key = (row["league"], row["season"], row["team"])
        if key in seen:
            raise ValueError(f"Duplicate team-season: {key}")
        seen.add(key)
        ppg = float(row["ppg"])
        matches = int(row["matches_played"])
        if matches <= 0 or not math.isfinite(ppg) or abs(ppg - int(row["points"]) / matches) > 0.000051:
            raise ValueError(f"Invalid PPG: {key}")
        seasons[row["league"], row["season"]].append(row)
        ranks[row["league"], int(row["rank"])].append(ppg)

    gaps, dispersion, first_last = [], defaultdict(list), defaultdict(list)
    for (league, season), rows in sorted(seasons.items()):
        rows.sort(key=lambda row: int(row["rank"]))
        if len(rows) <= 10 or [int(row["rank"]) for row in rows] != list(range(1, len(rows) + 1)):
            raise ValueError(f"Incomplete or duplicated ranks: {league}, {season}")
        ppg = [float(row["ppg"]) for row in rows]
        first, second, fourth, tenth, last = (ppg[0], ppg[1], ppg[3], ppg[9], ppg[-1])
        gaps.append(dict(league=league, season=season, ppg_1=first, ppg_2=second,
                         ppg_4=fourth, ppg_10=tenth, ppg_last=last,
                         gap_1_2=first-second, gap_1_4=first-fourth,
                         gap_4_10=fourth-tenth, gap_10_last=tenth-last))
        dispersion[league].append(statistics.stdev(ppg))
        first_last[league].append(first-last)

    curves = [dict(league=league, rank=rank, avg_ppg=statistics.mean(values),
                   min_ppg=min(values), max_ppg=max(values),
                   sd_ppg=statistics.stdev(values) if len(values) > 1 else 0,
                   season_count=len(values))
              for (league, rank), values in sorted(ranks.items())]
    summary = []
    for league in sorted(dispersion):
        league_gaps = [row for row in gaps if row["league"] == league]
        means = {f"avg_{field}": statistics.mean(row[field] for row in league_gaps)
                 for field in GAP_FIELDS}
        sd = statistics.mean(dispersion[league])
        summary.append(dict(league=league, **means, season_count=len(league_gaps),
                            avg_ppg_sd=sd, parity_score_simple=-(sum(means.values()) + sd)))
    low = min(row["parity_score_simple"] for row in summary)
    high = max(row["parity_score_simple"] for row in summary)
    for row in summary:
        row["parity_score_0_100"] = round(100 * (row["parity_score_simple"]-low) / (high-low), 1) if high != low else 50.0
    summary.sort(key=lambda row: -row["parity_score_simple"])
    headlines = [dict(league=row["league"], parity_score_0_100=row["parity_score_0_100"],
                      **{f"avg_{field}": row[f"avg_{field}"] for field in GAP_FIELDS},
                      curve_drop=statistics.mean(first_last[row["league"]])) for row in summary]
    print(f"Validated {len(master)} team-season rows across {len(seasons)} league-seasons.")
    return {"league_season_gaps.csv": gaps, "league_rank_curve.csv": curves,
            "league_summary.csv": summary, "league_headlines.csv": headlines}


def check(path, expected):
    actual = read_csv(path)
    if len(actual) != len(expected) or list(actual[0]) != list(expected[0]):
        raise ValueError(f"{path.name}: row count or columns differ; run the builder without --check")
    for index, (saved, generated) in enumerate(zip(actual, expected), start=2):
        for field, value in generated.items():
            same = (math.isclose(float(saved[field]), value, rel_tol=1e-10, abs_tol=1e-10)
                    if isinstance(value, (float, int)) else saved[field] == value)
            if not same:
                raise ValueError(f"{path.name}:{index} {field}: stored {saved[field]}, expected {value}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check derived CSVs without writing")
    args = parser.parse_args()
    outputs = build()
    for name, rows in outputs.items():
        path = DATA / name
        if args.check:
            check(path, rows)
        else:
            # Preserve equivalent existing numeric representations to avoid
            # unnecessary CSV churn from floating-point serialization.
            if path.exists():
                try:
                    check(path, rows)
                except ValueError:
                    pass
                else:
                    print(f"Unchanged {name}")
                    continue
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
                writer.writeheader()
                writer.writerows(rows)
        print(f"{'Checked' if args.check else 'Wrote'} {name}")


if __name__ == "__main__":
    main()
