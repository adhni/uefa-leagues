# European League Parity

Static narrative website about parity across seven major European top-flight football leagues, built from the existing analysis bundle in this repo.

Live site:

- `https://adhni.github.io/uefa-leagues/`
- `https://github.com/adhni/uefa-leagues`

## What this repo contains

- `index.html` - main one-page site for GitHub Pages
- `assets/css/styles.css` - site styling
- `assets/js/main.js` - lightweight CSV loading and Chart.js interactivity
- `data/` - processed CSVs and source bundle files
- `images/` - existing exported chart PNGs used as supporting visuals

## Project scope

This repo keeps the original analysis scope intact:

- 7 top-flight leagues
- 10 seasons from `2015/16` to `2024/25`
- points per game as the common comparison metric
- existing processed outputs reused rather than rebuilt

## Interactive chart

The main chart is powered by Chart.js and reads directly from the processed CSV files in `data/`:

- `data/league_rank_curve.csv` for average PPG by rank
- `data/league_summary.csv` for top-end and mid-table gap comparisons
- `data/league_headlines.csv` for league headline cards

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
- Tweak chart behavior or labels in `assets/js/main.js`.
- Replace or extend processed data in `data/` without changing the site structure.

## Notes

- The site intentionally stays lightweight and editorial rather than becoming a full dashboard.
- The parity score is presented as a summary view, not a definitive single-number ranking.
