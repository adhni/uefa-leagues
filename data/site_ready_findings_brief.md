# European League Parity — site-ready findings brief

## What this draft does
This note converts the current CSV outputs into a tighter website narrative.
It is not the final copy. It is the bridge between analysis and web build.

## Recommended headline
**Some leagues are not just stronger — they are structurally less even from top to bottom.**

## Recommended subhead
Across seven major European top flights and ten seasons, points-per-game patterns suggest clear differences in how steep, compressed, or stratified league tables are.

## 5 strongest findings from the current outputs
1. La Liga comes out as the strongest overall parity performer in the current summary, with the highest parity_score_0_100 (100.0) and relatively low average dispersion across the table.
2. The Premier League ranks lowest on the current simple parity score (0.0), driven especially by the largest average 10th-to-last gap (0.803).
3. Bundesliga and Ligue 1 show the biggest average 1st-to-2nd gaps (Ligue 1: 0.358; Bundesliga: 0.329), suggesting less title-race parity.
4. Ligue 1 has the tightest average 4th-to-10th gap (0.453), while Primeira Liga has the loosest (0.771).
5. On average table shape, La Liga has the flattest rank-to-PPG curve (drop of 1.689 from 1st to last), while Premier League has the steepest (1.861).

## Recommended website structure

### 1. Hero
- Headline above
- One-sentence explanation:
  This project compares parity across seven European top-flight leagues using ten seasons of team-level table data and points per game.

### 2. What is being measured
- Top flights only
- Seven leagues
- Ten seasons
- PPG used for comparability across leagues with different season lengths

### 3. Main chart
Use `chart_avg_ppg_by_rank.png`
- Main interpretation:
  flatter league curve = more parity
  steeper league curve = less parity

### 4. Where the gaps are
Use:
- `chart_gap_1_4.png`
- `chart_gap_4_10.png`

Suggested copy:
- Top-end gaps show how quickly a league separates at the top.
- Mid-table gaps show whether the league stays crowded beyond the European places.

### 5. League ranking / summary
Use `league_summary.csv`
- But do not oversell the simple parity score as definitive.
- Frame it as a compact summary measure, not the whole story.

### 6. Caveats
- The parity score is a simplification.
- Different leagues can look more or less competitive depending on whether you care most about title races, European-place battles, or bottom-end survival.
- PPG improves comparability, but it does not remove every structural difference.

## What should happen next
Do not build a big website yet.
Do only these two tasks next:
1. Turn the current PNGs into nicer, cleaner versions.
2. Build a one-page HTML prototype using only 3–4 charts and short text blocks.

That is enough for a strong v1.
