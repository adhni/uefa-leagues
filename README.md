# European League Parity

Static narrative website about parity across seven major European top-flight football leagues, built from the existing analysis bundle in this repo.

Live site:

- `https://adhni.github.io/uefa-leagues/`
- `https://github.com/adhni/uefa-leagues`

## What this repo contains

- `index.html` - main one-page site for GitHub Pages
- `assets/css/styles.css` - site styling
- `assets/js/main.js` - CSV loading, cached metrics, chart controls, mobile filter dialog, sortable comparison table and contextual takeaways
- `data/` - processed CSVs and source bundle files
- `images/` - legacy exported chart PNGs kept in the repo bundle

## Project scope

This repo keeps the original analysis scope intact:

- 7 top-flight leagues
- 10 seasons from `2015/16` to `2024/25`
- points per game as the common comparison metric
- supplied team tables as the input, with reproducible derived CSVs

## Interactive chart

The page stays fully static but includes several lightweight interactive pieces:

- chart-first layout with `Table shape`, `Top gap` and `Mid-table gap` views
- compact league chips and season selectors on desktop; a modal filter panel on mobile
- presets and focus selection under `More options`, plus a reset action
- league highlighting from the chart legend or comparison table, with muted baselines
- one takeaway that follows the selected chart mode
- sortable comparison table for relative score, top, middle and bottom gaps
- expandable chart values and methodology, accessible button states and keyboard navigation
- a clean fallback error state if the CSV files cannot be fetched

The page reads directly from the processed CSV files in `data/`:

- `data/league_team_season_master_7leagues_10seasons.csv` for season-level rank curves
- `data/league_season_gaps.csv` for top-end, mid-table, and lower-table gap comparisons

No build step or package manager is used.

## Local preview

Run a local server so the browser can fetch the CSV files:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish to GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, open `Pages`.
3. Set the source to deploy from the main branch root.
4. Save and wait for the Pages URL to build.

No build step is required.

## Editing later

- Update copy directly in `index.html`.
- Adjust colors, spacing, or layout in `assets/css/styles.css`.
- Tweak presets, chart behavior, or text logic in `assets/js/main.js`.
- Update league colors through CSS custom properties in `assets/css/styles.css`.
- After editing the master CSV, regenerate derived data and run the checks below. If the league or season coverage changes, also update the scope copy and presets.

## Data and methodology

The canonical input is `data/league_team_season_master_7leagues_10seasons.csv`: 1,336 team-season records for seven leagues over ten seasons. The original provider, source URLs, retrieval dates and collection procedure are not recorded in the supplied repository or workbook metadata. This project can reproduce calculations from those records; it cannot currently reproduce or independently verify their original collection. Do not infer provider attribution from the filenames.

The other master CSV, workbooks, image exports and findings brief are historical inputs or snapshots. The website uses the canonical master and `league_season_gaps.csv`; it does not read the workbooks or PNGs. `scripts/build_data.py` validates the canonical master and reproduces the gap, rank-curve, summary and headline CSVs. It does not scrape football records or rewrite historical workbooks/images.

- PPG uses recorded points divided by matches played, rounded to four decimals. Calculations use those supplied PPG values and ranks, including any effects of points deductions or incomplete seasons.
- Season gaps are calculated within each league-season, then averaged with equal season weights. `curve_drop` in the headline CSV now means the mean season-level first-to-last gap, not the difference between endpoints of the averaged rank curve.
- The line chart groups by absolute rank. Ligue 1 ranks 19–20 have eight seasons in the full window, while ranks 1–18 have ten. Tooltips and the accessible table show sample counts. Rank is not normalized across 18- and 20-team leagues.
- Band insights compare the average PPG gap per rank step: divide each season’s 1st–4th gap by 3, 4th–10th by 6, and 10th–last by that season’s team count minus 10, then average. The charts display total band gaps.
- For each league, let `D = mean(gap_1_2) + mean(gap_1_4) + mean(gap_4_10) + mean(gap_10_last) + mean(sample_sd_of_team_ppg)`. The legacy `parity_score_simple` field is `-D`. Sample SD uses `n - 1` in its denominator.
- The displayed score is `100 * (Dmax - D) / (Dmax - Dmin)`, where the bounds always use all seven leagues for the selected season window. Equal bounds produce 50 for every league. League visibility cannot change scores. Season selection changes the baseline, so scores are not comparable across different windows.
- The score is relative, not an absolute percentage of competitiveness. The overlapping 1st–2nd and 1st–4th gaps give the title race extra weight. PPG does not remove league-size or schedule differences, and table spread does not measure cross-league strength or turnover of champions.

Regenerate the four derived CSVs with Python 3 (standard library only):

```bash
python3 scripts/build_data.py
```

Run data consistency checks and JavaScript regression tests (Node.js 18+):

```bash
python3 scripts/build_data.py --check
node --check assets/js/main.js
node --test tests/parity.test.cjs
```

The checks cover duplicate team-season records, contiguous ranks, PPG arithmetic, derived outputs, changing league sizes, score stability across every contiguous season window, band normalization, empty selections, accessible button state, table sorting and chart-specific takeaways. They verify internal consistency, not the accuracy of the original football records.

## Notes

- The site intentionally stays lightweight and editorial rather than becoming a full dashboard.
- The chart, takeaway and comparison table share the same league and season selection. Table sorting changes only row order; clicking a league highlights it without hiding other leagues.
- The parity score is presented as a compact summary view, not a definitive single-number ranking.
