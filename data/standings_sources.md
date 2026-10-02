# Standings sources and correction policy

Checked on **3 October 2026**. The original provider and collection procedure of the supplied files remain unknown. All 70 league-seasons have now been cross-checked against RSSSF historical season tables. RSSSF is an independent historical compilation, not an official league feed; this cross-check does not establish the original provider or claim a complete official-record audit.

## Reproducible inputs

- `archive/league_team_season_master_supplied.csv` preserves the exact supplied canonical CSV before reconciliation.
- `standings_reference.csv` captures the 1,336 season-table records used for reconciliation. `reference_team` preserves the source label; `team` maps it to the existing project label, including different names in 2024/25. The snapshot is factual table data, not the full source articles.
- `coverage.json` records a source URL and check date for each league-season, expected team and match counts, completion status, and a SHA-256 checksum of the reference snapshot.
- `standings_corrections.csv` records every changed original field, its previous value, its replacement and its source URL. The two new points columns are not counted as corrections.

`scripts/reconcile_standings.py` reproduces the canonical master and correction log offline from these preserved inputs. It never downloads or scrapes pages. To update coverage, review a new source table, update the reference and manifest together, then reconcile and rebuild. Do not regenerate ranks by globally sorting points or goal difference: head-to-head rules, PPG rankings and tied relegation playoffs differ by competition.

The reference tables were extracted from the first top-flight season table in each linked RSSSF page, excluding playoff matches and cup competitions. Team identity was matched using the existing W/D/L and goal records, then checked aliases for incomplete records and awarded results. Thirty-six 2024/25 Eredivisie and Primeira Liga records lacked W/D/L and goal fields; those are filled from the reference. Portuguese source labels contain some historical encoding defects; the existing project team labels are retained.

## Points and rank policy

`points` is the season-table total after recorded adjustments; `ppg` is `points / matches_played`, rounded to four decimals. `points_earned` is `3 * wins + draws` using the recorded season results, including awarded results. `points_adjustment = points - points_earned` makes deductions explicit. `rank` is the position in the published season table, rather than a newly inferred ordering.

Ranks describe the regular season table; playoff matches are excluded. In particular, the 2022/23 Serie A reference lists Spezia 17th and Verona 18th before their relegation playoff. Both have 31 points in 38 matches, so this tied ordering does not affect the PPG calculations. It should not be used to infer which club ultimately stayed up.

## Primary checks for exceptional records

The historical tables were also checked against these primary statements for the discrepancies identified in the review:

- Everton 2023/24: 40 points and 15th in the [Premier League table](https://www.premierleague.com/en/news/3932287).
- Juventus 2022/23: the [FIGC's ten-point sanction](https://www.figc.it/it/federazione/news/caso-plusvalenze-dieci-punti-di-penalizzazione-per-la-juventus-da-scontare-nella-corrente-stagione-sportiva-nkac3p2i).
- Vitesse 2023/24: the [KNVB's eighteen-point sanction](https://www.knvb.nl/node/69055).
- Nice 2021/22: the [club's 66-point season total](https://www.ogcnice.com/fr/article/121551/le-classement-le-nombre-de-points-ou-se-situe-le-gym-2021-22.html).
- Ligue 1 2019/20: [LFP board minutes, page 11](https://www.lfp.fr/assets/20200430_PV_Conseil_Administration_LFP_e824a457fa.pdf#page=11), confirming PPG ranking, Strasbourg tenth, Angers eleventh, Nice fifth and Reims sixth.
- Chievo 2018/19: [FIGC's decision rejecting the appeal against its three-point deduction](https://www.figc.it/it/federazione/news/inammissibili-i-ricorsi-di-catania-siena-e-pro-vercelli-respinti-quelli-sul-caso-chievo-cesena-foei3m9o).
- Roma–Verona 2020/21: [Roma's statement about the awarded 3–0 result](https://www.asroma.com/en/news/59181/roma-to-appeal-against-decision-on-verona-result), reflected in the historical final table. The supplied table used the original drawn result.

Additional recorded corrections include Twente 2015/16, Nottingham Forest 2023/24, Lyon 2021/22 and Montpellier 2023/24 adjustments, plus tie-break positions across several leagues. Their season-table sources are in the correction log and coverage manifest.

One auxiliary-statistics exception is preserved: the 2016/17 RSSSF table gives Lyon 77 goals for and Bastia 54 goals against, excluding the awarded Bastia–Lyon score. The supplied dataset includes it (80 / 57), and those supplied goal fields are retained. These fields do not enter parity calculations; their difference from the reference is intentional.

## Remaining limits

Sources can contain errors. Preserve this trail so discrepancies can be investigated, rather than treating a checksum or arithmetic test as proof of historical truth. A future audit can replace individual compilation references with league-issued tables while retaining the correction history. The original workbooks, older five-league CSV, findings brief and PNG exports remain historical snapshots and are not synchronized with this reconciliation.

Source availability is not a grant of reuse rights. No broader dataset license is asserted here. Chart.js is distributed under its own MIT license in `assets/vendor/Chart.js.LICENSE.md`.
