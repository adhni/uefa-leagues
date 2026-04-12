# European League Parity

Static narrative website about parity across seven major European top-flight football leagues, built from the existing analysis bundle in this repo.

Live site:

- `https://adhni.github.io/uefa-leagues/`
- `https://github.com/adhni/uefa-leagues`

## What this repo contains

- `index.html` - main one-page site for GitHub Pages
- `assets/css/styles.css` - site styling
- `assets/js/main.js` - lightweight CSV loading, presets, live support views, and deterministic insight logic
- `data/` - processed CSVs and source bundle files
- `images/` - legacy exported chart PNGs kept in the repo bundle

## Project scope

This repo keeps the original analysis scope intact:

- 7 top-flight leagues
- 10 seasons from `2015/16` to `2024/25`
- points per game as the common comparison metric
- existing processed outputs reused rather than rebuilt

## Interactive chart

The page stays fully static but includes several lightweight interactive pieces:

- main Chart.js view with league filters, season range, and mode switching
- presets for `All leagues`, `Big 5`, `Non-Big-5`, `Full 10 seasons`, and `Recent seasons`
- optional focus-league highlighting against muted baselines
- live quick findings, support charts, ranking panel, and deterministic insight box

The page reads directly from the processed CSV files in `data/`:

- `data/league_team_season_master_7leagues_10seasons.csv` for season-level rank curves
- `data/league_season_gaps.csv` for top-end, mid-table, and lower-table gap comparisons

No build step or package manager is used.

## Local preview

Because this is a plain static site, you can open `index.html` directly in a browser. If your browser blocks local CSV fetches, run a tiny local server instead:

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
- Replace or extend processed data in `data/` without changing the site structure.

## Notes

- The site intentionally stays lightweight and editorial rather than becoming a full dashboard.
- The support sections are now driven by live CSV data rather than the older static image exports.
- The parity score is presented as a compact summary view, not a definitive single-number ranking.
