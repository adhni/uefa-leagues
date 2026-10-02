#!/usr/bin/env python3
"""Reconcile the preserved input with the checked-in historical table snapshot."""

import argparse
import csv
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
MASTER = "league_team_season_master_7leagues_10seasons.csv"


def read(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def reconcile():
    supplied = read(DATA / "archive" / "league_team_season_master_supplied.csv")
    reference = read(DATA / "standings_reference.csv")
    sources = json.loads((DATA / "coverage.json").read_text())["league_seasons"]
    urls = {(row["league"], row["season"]): row["source_url"] for row in sources}
    key = lambda row: (row["league"], row["season"], row["team"])
    lookup = {key(row): row for row in reference}
    if len(lookup) != len(reference) or set(lookup) != {key(row) for row in supplied}:
        raise ValueError("The reference and supplied input must contain the same team-seasons")

    corrected, changes = [], []
    for original in supplied:
        row = dict(original)
        verified = lookup[key(row)]
        # The 2016/17 RSSSF goals exclude the awarded Bastia–Lyon score.
        # Preserve the supplied 80 Lyon GF / 57 Bastia GA; points/ranks agree.
        preserve_goals = row["league"] == "Ligue 1" and row["season"] == "2016/17" and row["team"] in {"Lyon", "Bastia"}
        for field in ("rank", "points", "matches_played", "wins", "draws", "losses",
                      "goals_for", "goals_against", "goal_difference"):
            if preserve_goals and field.startswith("goal"):
                continue
            row[field] = verified[field]
        points, matches = int(row["points"]), int(row["matches_played"])
        if points != int(original["points"]) or matches != int(original["matches_played"]):
            row["ppg"] = f"{points / matches:.4f}"
        row["points_earned"] = str(3 * int(row["wins"]) + int(row["draws"]))
        row["points_adjustment"] = str(points - int(row["points_earned"]))
        for field in original:
            if row[field] != original[field]:
                changes.append(dict(league=row["league"], season=row["season"], team=row["team"],
                                    field=field, old_value=original[field], new_value=row[field],
                                    source_url=urls[row["league"], row["season"]]))
        corrected.append(row)
    corrected.sort(key=lambda row: (row["league"], row["season"], int(row["rank"])))
    return corrected, changes


def write_or_check(path, rows, check):
    if check:
        if read(path) != rows:
            raise ValueError(f"{path.name} differs; run scripts/reconcile_standings.py")
    else:
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows, changes = reconcile()
    write_or_check(DATA / MASTER, rows, args.check)
    write_or_check(DATA / "standings_corrections.csv", changes, args.check)
    print(f"{'Checked' if args.check else 'Reconciled'} {len(rows)} records; {len(changes)} field corrections.")


if __name__ == "__main__":
    main()
