import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from data_validation import DATA, load_coverage, read_csv, validate_master, validate_reference
from reconcile_standings import reconcile


class DataValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.master = read_csv(DATA / "league_team_season_master_7leagues_10seasons.csv")
        cls.coverage = load_coverage()

    def rejects(self, rows):
        with self.assertRaises(ValueError):
            validate_master(rows, self.coverage)

    def test_current_dataset_has_full_coverage(self):
        self.assertEqual(len(validate_master(self.master, self.coverage)), 70)
        self.assertEqual(len(self.master), 1336)

    def test_rejects_missing_bottom_team(self):
        self.rejects(self.master[:-1])

    def test_rejects_missing_league_season(self):
        self.rejects([row for row in self.master if (row["league"], row["season"]) != ("Premier League", "2024/25")])

    def test_rejects_missing_league(self):
        self.rejects([row for row in self.master if row["league"] != "Premier League"])

    def test_rejects_duplicate_team_or_rank(self):
        rows = copy.deepcopy(self.master)
        rows[1]["team"] = rows[0]["team"]
        self.rejects(rows)
        rows = copy.deepcopy(self.master)
        rows[1]["rank"] = rows[0]["rank"]
        self.rejects(rows)

    def test_rejects_empty_or_missing_identifiers(self):
        for field in ("team", "league", "country", "season"):
            with self.subTest(field=field):
                rows = copy.deepcopy(self.master)
                rows[0][field] = ""
                self.rejects(rows)

    def test_rejects_impossible_consistent_ppg(self):
        rows = copy.deepcopy(self.master)
        rows[0].update(points="999", ppg="29.3824", points_earned="999")
        self.rejects(rows)

    def test_rejects_blank_nan_and_infinite_ppg(self):
        for value in ("", "NaN", "inf", "invalid"):
            with self.subTest(value=value):
                rows = copy.deepcopy(self.master)
                rows[0]["ppg"] = value
                self.rejects(rows)

    def test_rejects_incorrect_match_and_points_arithmetic(self):
        for field in ("matches_played", "wins", "points_adjustment"):
            with self.subTest(field=field):
                rows = copy.deepcopy(self.master)
                rows[0][field] = str(int(rows[0][field]) + 1)
                self.rejects(rows)

    def test_rejects_unbalanced_goals(self):
        rows = copy.deepcopy(self.master)
        rows[0]["goals_for"] = str(int(rows[0]["goals_for"]) + 1)
        rows[0]["goal_difference"] = str(int(rows[0]["goal_difference"]) + 1)
        self.rejects(rows)

    def test_known_deductions_and_exceptional_ranks(self):
        lookup = {(row["league"], row["season"], row["team"]): row for row in self.master}
        for key, points, rank, adjustment in [
            (("Premier League", "2023/24", "Everton"), "40", "15", "-8"),
            (("Premier League", "2023/24", "Nott'm Forest"), "32", "17", "-4"),
            (("Serie A", "2022/23", "Juventus"), "62", "7", "-10"),
            (("Eredivisie", "2023/24", "Vitesse"), "6", "18", "-18"),
            (("Ligue 1", "2019/20", "Strasbourg"), "38", "10", "0"),
        ]:
            with self.subTest(key=key):
                row = lookup[key]
                self.assertEqual((row["points"], row["rank"], row["points_adjustment"]), (points, rank, adjustment))

    def test_reconciliation_and_reference_agree(self):
        rows, changes = reconcile()
        self.assertEqual(rows, self.master)
        self.assertEqual(changes, read_csv(DATA / "standings_corrections.csv"))
        validate_reference(rows, read_csv(DATA / "standings_reference.csv"))


if __name__ == "__main__":
    unittest.main()
