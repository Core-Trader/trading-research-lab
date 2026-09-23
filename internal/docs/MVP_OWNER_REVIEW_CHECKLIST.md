# MVP owner review checklist: Portfolio and Parameters pages

**Purpose:** a single guided review in Obsidian of the work only verified in
the development harness so far:

- Portfolio Lab slices 1–4 and the persistence of saved combinations (PL-007)
- parameter exploration, with single-test and forward attach
- narrow-width layout

**Time:** about 30–45 minutes.

**Setup:**
1. Rebuild the plugin (`npm run build` in `plugin/`) and reload it in the dev
   vault (`C:\DEV\vaults\TRL-Dev-Vault`).
2. Use real files from `data/raw/`.
3. Mark each item **OK**, **Issue** (with a note), or **Skip**.

## A. Portfolio Lab (page "Portfolio")

| # | Step | Expect | Result |
| --- | --- | --- | --- |
| A1 | Import `EURUSD_2025.xlsx`, `GBPUSD_2025.xlsx`, `USDJPY_2025.xlsx`, and `CADCHF_2025.xlsx` with **Import backtest reports…** | All four are listed with their event counts | |
| A2 | Click **New track** on each | Four tracks, each with an editable name | |
| A3 | Leave the capital empty and click **Combine 4 tracks** | Uses the largest initial deposit (the note says so); the combined dashboard appears | |
| A4 | Read the caveat and the per-track contribution table | The realised-balance-only warning is visible; the shares add up to the combined net | |
| A5 | Name the result and click **Save combination for comparison** | It appears in "4. Saved combinations" | |
| A6 | Untick two tracks, combine, and save | Two rows plus the return-versus-drawdown field | |
| A7 | **Close and reopen Obsidian**, then open Portfolio | Both saved combinations are still there with the same numbers | |
| A8 | Save the same setup again under a new name | The button reads "Rename saved combination"; there is still one row for that setup | |
| A9 | Click **Explore all combinations** (4 tracks) | 15 subsets on the field; clicking a point opens that combination | |
| A10 | Remove a saved combination, then reopen Obsidian | It stays removed | |
| A11 | Is the page useful for your intended decision ("which EAs together on one account")? | Your judgement: what is missing or confusing? | |

## B. Parameter exploration (page "Parameters")

| # | Step | Expect | Result |
| --- | --- | --- | --- |
| B1 | XML `EA_DCA_CENT_V1_IS_2020-2024.xml`, `.set` `EA_DCA_CENT_V1_FORWARD_IS.set`, and your real modelling mode; **Create study** | Summary: 173 tested sets out of the full grid; parameter table; the default message says "not among the tested passes" | |
| B2 | Look at the trade-off field (Equity DD % × Net profit) | Frontier points and line; hovering shows parameters; arrow keys and Enter work | |
| B3 | Add the constraint Trades ≥ 20 and **Re-evaluate** | Hollow points for sets that fail; the counts update | |
| B4 | **Attach a single-test report…** with a single test of the default (if you have one) | ★ appears on the field; the compare table's first column becomes the default | |
| B5 | **Attach forward results (.xml)…** with `EA_DCA_CENT_V1_FORWARD_2025.xml` | "Forward results 2025.01.01–2025.12.31: 11 of the tested sets paired" | |
| B6 | Set the vertical axis to **Forward: Net profit** | Only the 11 paired sets are plotted, with a note that colours are in-sample | |
| B7 | Pin two sets and compare | Parameter differences highlighted; "Forward: …" rows; "no forward match" where unpaired | |
| B8 | Select an Experiment under Research, then **Record … as my choice** with a reason | A TRL:CHOICE block in the experiment note; doing it again asks before replacing | |
| B9 | Repeat B5 with `EA_DCA_CENT_V1_2020-2025_FORWARD.xml` on a study of `EA_DCA_CENT_V1_2020-2025.xml` | "Periods overlap" warning; the forward-axis note says these are not out-of-sample | |
| B10 | Is this enough to choose a parameter set with confidence? | Your judgement: is neighbourhood analysis the next need? | |

## C. Narrow width

| # | Step | Expect | Result |
| --- | --- | --- | --- |
| C1 | Drag the TRL view into a side pane about 320–400 px wide | No sideways page scroll; wide tables scroll inside their own box | |
| C2 | Hover a point on any trade-off field while narrow | The card spans the top of the plot; the y-axis title is vertical | |
| C3 | Check Overview, Data, and Analysis while narrow | Readable; nothing cut off | |

## D. Release smoke check (optional)

| # | Step | Expect | Result |
| --- | --- | --- | --- |
| D1 | `research-core/.venv/Scripts/python.exe scripts/build_release.py` | `"status": "READY"`; folder `dist/release/trading-research-lab-0.0.1` | |
| D2 | Open `dist/release/…/docs/INSTALL.md` and `MT5_EXPORT_GUIDE.md` | Clear to a trader who is not a developer; correct MT5 menu names | |

## Decisions requested in the same pass

1. Multi-XML studies: defer (recommended) or build now?
2. Neighbourhood analysis: approve drafting a spec after the release
   (recommended)?
3. Licence and distribution (MVP-D): see `MVP_D_RELEASE_READINESS.md`.
