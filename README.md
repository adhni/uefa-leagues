# European League Parity

Static narrative website about parity across seven major European top-flight football leagues, built from the existing analysis bundle in this repo.

Live site:

- `https://adhni.github.io/uefa-leagues/`
- `https://github.com/adhni/uefa-leagues`

## What this repo contains

- `index.html` - main one-page site for GitHub Pages
- `assets/css/styles.css` - site styling
- `assets/js/main.js` - loading, controls, mobile filters, comparison and sensitivity rendering
- `assets/js/data.js` - strict CSV decoding and schema/coverage validation
- `assets/js/metrics.js` - pure parity, rank-curve and sensitivity calculations
- `assets/js/charts.js` - optional chart rendering and accessible chart values
- `assets/js/selection.js` - bookmarkable selection parameters
- `assets/vendor/` - pinned Chart.js 4.4.3 and its MIT license; no CDN dependency
- `scripts/` - standard-library data reconciliation, validation and derived CSV generation
- `tests/` - Python rejection tests, JavaScript regressions and browser smoke tests
- `data/` - processed CSVs and source bundle files
- `images/` - legacy exported chart PNGs kept in the repo bundle

## Project scope

This repo keeps the original analysis scope intact:

- 7 top-flight leagues
- 10 seasons from `2015/16` to `2024/25`
- points per game as the common comparison metric
- preserved supplied tables reconciled with a checked-in historical standings reference

## Interactive chart

The page stays fully static but includes several lightweight interactive pieces:

- chart-first layout with `Table shape`, `Top gap` and `Mid-table gap` views
- compact league chips and season selectors on desktop; a modal filter panel on mobile
- presets and focus selection under `More options`, plus a reset action
- league highlighting, distinct line patterns and visible comparison strokes
- one takeaway that follows the selected chart mode
- sortable comparison table for relative score, top, middle and bottom gaps, and PPG dispersion
- completed-season filtering and leave-one-season-out ranking sensitivity
- selections reflected in the URL, including mode, focus and sorting
- expandable chart values and methodology, accessible button states and keyboard navigation
- busy/inert controls during loading, validation errors with retry, and numeric results when charts fail

The page reads directly from the processed CSV files in `data/`:

- `data/league_team_season_master_7leagues_10seasons.csv` for season-level rank curves
- `data/league_season_gaps.csv` for top-end, mid-table, and lower-table gap comparisons
- `data/coverage.json` for expected coverage and completion status

No frontend build step or production package installation is needed. npm manages development tests only. Serve the checked-in files directly.

## Local preview

Run a local server so the browser can fetch the CSV files:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish to GitHub Pages

1. In the repository settings, open `Pages` and select **GitHub Actions** as the source.
2. Push the repository or merge the reviewed changes into `main`.
3. The `Validate and publish` workflow runs the data, JavaScript and Chromium/Firefox/WebKit checks.
4. Only a successful validation on `main` publishes the static site. Feature branches and pull requests run validation without publishing.

The workflow copies only `index.html`, `assets/` and `data/` into the Pages artifact. Development dependencies and tests are not shipped. Switching an existing branch-based Pages site to Actions is necessary to make validation gate publication. Branch-protection requirements must be configured separately in repository settings.

## Editing later

- Update copy directly in `index.html`.
- Adjust colors, spacing, or layout in `assets/css/styles.css`.
- Tweak presets, chart behavior, or text logic in `assets/js/main.js`.
- Update league colors through CSS custom properties in `assets/css/styles.css`.
- Update reviewed standings through `standings_reference.csv` and the matching checksum/coverage manifest, then reconcile and rebuild. Direct master edits must agree with the reference and reconciliation policy.
- If league or season coverage changes, update the manifest, scope copy, presets and scope-dependent tests together.

## Data and methodology

The canonical input is `data/league_team_season_master_7leagues_10seasons.csv`: 1,336 team-season records for seven leagues over ten seasons. All 70 league-seasons have been cross-checked against RSSSF historical tables, with sources and check dates recorded in `data/coverage.json`. This reconciles 341 original fields across 132 records, including 95 rank positions, 11 point totals and missing auxiliary statistics. These counts describe changes and filled blanks, not 341 independent football errors.

The exact supplied input is preserved in `data/archive/league_team_season_master_supplied.csv`; `data/standings_reference.csv` preserves the reviewed reference and `data/standings_corrections.csv` records changed fields with source URLs. See [sources, primary checks and correction policy](data/standings_sources.md), including awarded results, the pre-playoff Serie A table and the auxiliary-goals exception. The original provider and collection procedure remain unknown. RSSSF is a historical compilation; this reconciliation is not a complete audit of official match records or attribution of the original input.

The other master CSV, workbooks, image exports and findings brief remain historical snapshots and may disagree with the corrected data. The website does not read those files. Reconciliation and generation use checked-in inputs offline; they never scrape records or rewrite historical workbooks/images.

- PPG uses season-table points divided by matches played, rounded to four decimals. `points_earned = 3 * wins + draws` includes recorded awarded results; `points_adjustment = points - points_earned` makes deductions explicit. Published season-table ranks are preserved, rather than globally inferred from points/goal difference; playoff matches are excluded.
- Season gaps are calculated within each league-season, then averaged with equal season weights. `curve_drop` in the headline CSV now means the mean season-level first-to-last gap, not the difference between endpoints of the averaged rank curve.
- The line chart groups by absolute rank. Ligue 1 ranks 19–20 have eight seasons in the full window, while ranks 1–18 have ten. Tooltips and the accessible table show sample counts. Rank is not normalized across 18- and 20-team leagues.
- Band insights compare the average PPG gap per rank step: divide each season’s 1st–4th gap by 3, 4th–10th by 6, and 10th–last by that season’s team count minus 10, then average. The charts display total band gaps.
- For each league, let `D = mean(first_to_last_gap) + mean(gap_1_2) + mean(sample_sd_of_team_ppg)`. This is algebraically equivalent to the original sum of the three adjoining band gaps, the 1st–2nd gap and SD: the shared band boundaries cancel. The legacy `parity_score_simple` field is `-D`. Sample SD uses `n - 1` in its denominator.
- The displayed score is `100 * (Dmax - D) / (Dmax - Dmin)`, where the bounds always use all seven leagues for the selected season window. Equal bounds produce 50 for every league. League visibility cannot change scores. Season selection changes the baseline, so scores are not comparable across different windows.
- The score is relative, not an absolute percentage of competitiveness. The overlapping 1st–2nd and 1st–4th gaps give the title race extra weight. PPG does not remove league-size or schedule differences, and table spread does not measure cross-league strength or turnover of champions.
- Completed-season filtering excludes an entire season from every league if any covered league stopped early, preserving a common baseline. Currently that excludes 2019/20. Leave-one-season-out sensitivity recalculates all seven league rankings for each omitted season; the range is descriptive, not a confidence interval. Relative score magnitudes are not compared across those windows.

Reconcile the master and regenerate the four derived CSVs with Python 3.9+ (standard library only):

```bash
python3 scripts/reconcile_standings.py
python3 scripts/build_data.py
```

Run data and JavaScript checks (Node.js 22+, no npm installation required for these):

```bash
npm run check
```

The checks include reconciliation/reference agreement, required columns and identifiers, expected league/season/team/match coverage, points adjustments, PPG arithmetic, W/D/L and goal consistency, derived outputs, malformed CSVs and missing/stale gaps. Numerical regressions cover changing league sizes, visibility-stable scores across every contiguous season window, band normalization, empty selections, sorting, takeaways, sensitivity and URL round-trips. They verify consistency with the recorded reference, not independent historical truth.

Install and run browser tests:

```bash
npm ci --ignore-scripts
npx playwright install chromium firefox webkit
npm run test:browser
```

Playwright starts the Python preview server automatically. Tests exercise actual rendering, chart modes, filtering/reset/sort, keyboard focus, mobile resizing, loading and retry, invalid data, missing chart assets, text spacing and JavaScript-disabled access. Use `npm run test:browser -- --project=chromium` to run one browser. Current desktop Chromium, Firefox and Safari/WebKit with native modules, `dialog` and `inert` are the browser targets; Internet Explorer is not supported.

The vendored Chart.js version remains 4.4.3. Its UMD file and license come from the official npm release; upgrading it is a separate change requiring browser verification.

## Notes

- The site intentionally stays lightweight and editorial rather than becoming a full dashboard.
- The chart, takeaway and comparison table share the same league and season selection. Table sorting changes only row order; clicking a league highlights it without hiding other leagues.
- The parity score is presented as a compact summary view, not a definitive single-number ranking.
