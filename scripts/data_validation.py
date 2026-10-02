"""Schema and coverage checks shared by the data builder and its rejection tests."""

import csv
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
REQUIRED = ("league", "country", "season", "team", "rank", "points", "matches_played", "ppg",
            "points_earned", "points_adjustment", "wins", "draws", "losses",
            "goals_for", "goals_against", "goal_difference")


def read_csv(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError(f"{path.name}: missing or duplicated headers")
        rows = list(reader)
    if not rows or any(None in row or None in row.values() for row in rows):
        raise ValueError(f"{path.name}: empty or malformed rows")
    return rows


def load_coverage():
    manifest = json.loads((DATA / "coverage.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1:
        raise ValueError("Unsupported coverage schema")
    digest = hashlib.sha256((DATA / "standings_reference.csv").read_bytes()).hexdigest()
    if digest != manifest["reference_sha256"]:
        raise ValueError("Reference snapshot checksum differs from coverage.json")
    return manifest["league_seasons"]


def integer(row, field, low=None, high=None):
    value = row.get(field, "")
    if not isinstance(value, str) or not re.fullmatch(r"-?\d+", value):
        raise ValueError(f"Invalid integer {field}: {row.get('team')}")
    number = int(value)
    if (low is not None and number < low) or (high is not None and number > high):
        raise ValueError(f"Out of range {field}: {row.get('team')}")
    return number


def validate_master(master, coverage):
    if not master:
        raise ValueError("Empty master dataset")
    expected = {(row["league"], row["season"]): row for row in coverage}
    if not expected or len(expected) != len(coverage):
        raise ValueError("Empty or duplicated coverage entries")
    seasons, seen = defaultdict(list), set()
    for row in master:
        if not all(field in row and row[field] is not None for field in REQUIRED):
            raise ValueError("Missing master columns or values")
        if any(not str(row[field]).strip() for field in REQUIRED):
            raise ValueError("Empty required master value")
        group = (row["league"], row["season"])
        spec = expected.get(group)
        if not spec or row["country"] != spec["country"]:
            raise ValueError(f"Unknown league-season or country: {group}")
        key = (*group, row["team"])
        if key in seen:
            raise ValueError(f"Duplicate team-season: {key}")
        seen.add(key)
        integer(row, "rank", 1, spec["team_count"])
        matches = integer(row, "matches_played", 1, spec["scheduled_matches"])
        if spec["complete"] and matches != spec["scheduled_matches"]:
            raise ValueError(f"Incomplete matches: {key}")
        points = integer(row, "points", -3 * matches, 3 * matches)
        earned = integer(row, "points_earned", 0, 3 * matches)
        adjustment = integer(row, "points_adjustment", -3 * matches, 3 * matches)
        wins, draws, losses = (integer(row, field, 0, matches) for field in ("wins", "draws", "losses"))
        if wins + draws + losses != matches or earned != 3 * wins + draws or points != earned + adjustment:
            raise ValueError(f"Invalid match or points arithmetic: {key}")
        gf, ga = (integer(row, field, 0) for field in ("goals_for", "goals_against"))
        if integer(row, "goal_difference") != gf - ga:
            raise ValueError(f"Invalid goal difference: {key}")
        try:
            ppg = float(row["ppg"])
        except ValueError as exc:
            raise ValueError(f"Invalid PPG: {key}") from exc
        if not math.isfinite(ppg) or abs(ppg - points / matches) > 0.000051:
            raise ValueError(f"Invalid PPG: {key}")
        seasons[group].append(row)
    if set(seasons) != set(expected):
        raise ValueError(f"Missing league-seasons: {sorted(set(expected) - set(seasons))}")
    for group, rows in seasons.items():
        count = expected[group]["team_count"]
        if len(rows) != count or sorted(int(row["rank"]) for row in rows) != list(range(1, count + 1)):
            raise ValueError(f"Incorrect team count or ranks: {group}")
        if sum(int(row["goals_for"]) for row in rows) != sum(int(row["goals_against"]) for row in rows):
            raise ValueError(f"Unbalanced league goals: {group}")
        if sum(int(row["wins"]) for row in rows) != sum(int(row["losses"]) for row in rows):
            raise ValueError(f"Unbalanced league results: {group}")
    return seasons


def validate_reference(master, reference):
    key = lambda row: (row["league"], row["season"], row["team"])
    lookup = {key(row): row for row in reference}
    if len(lookup) != len(reference) or set(lookup) != {key(row) for row in master}:
        raise ValueError("Reference coverage differs from master")
    for row in master:
        for field in ("rank", "points", "matches_played"):
            if row[field] != lookup[key(row)][field]:
                raise ValueError(f"Master differs from reference: {key(row)} {field}")
