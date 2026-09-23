# MetaTrader 5 Backtesting & Optimization — Best Practices

> A portable reference for running MT5 Strategy Tester (headless or GUI) and
> designing sound backtest/optimization studies, distilled from real,
> confirmed failure modes hit while automating this workflow via Claude Code.
> Nothing here is theoretical — every item was either a silent failure that
> produced a wrong-but-normal-looking result, or a methodology gap that
> materially changed a study's conclusion. Written to be dropped into any
> MT5 project, not tied to a specific EA or broker.

---

## 1. Compiling

MetaEditor resolves standard-library `#include`s (e.g. `<Trade\Trade.mqh>`)
from one fixed shared terminal folder, not from wherever the source file
lives. Always compile through the actual portable install of the terminal
the EA will run in — don't assume a generic MetaEditor install resolves the
same includes:

```
"<path>\MetaEditor64.exe" /portable /compile:"<path>\MQL5\Experts\<name>.mq5" /log:"<logfile>"
```

If invoking this from PowerShell, plain `&`-invocation of a GUI-subsystem
`.exe` like `MetaEditor64.exe` does not reliably block — `$LASTEXITCODE`
comes back empty and the log file may not exist yet when the next command
runs. Use `Start-Process -FilePath ... -Wait` instead, which blocks
correctly.

Never commit `.ex5`/`.ex4` binaries to source control — only `.mq5` source.
Each terminal should compile its own binary locally; a binary built on one
machine/build isn't guaranteed portable to another.

## 2. Before running anything: verify the `.set` file, not just the EA

**The single most dangerous failure mode in this whole workflow is a `.set`
file that silently doesn't match what you think it does** — copied from an
older reference, hand-edited once and never re-diffed, or just stale. This
is *not* caught by the Tester (it will run happily and produce a completely
normal-looking report) and is easy to never notice, especially when a `.set`
is reused as the "default" baseline for a whole new study.

Concretely: `input` declarations in `.mq5` source can change their compiled
default across commits (an enum's default value change, a threshold tuned
during development, etc.) without anyone updating the `.set` files built
against an earlier version. If a study's "default" `.set` was copied from an
old backtest/reference folder, it can silently encode a stale default for
months, invalidating every result built on it.

**Mitigation**: build (or reuse) a small script that parses every `input`
declaration and its compiled default directly out of the `.mq5` source
(including resolving custom `enum` types defined in the same file, and
common native enums like `ENUM_APPLIED_PRICE`, `ENUM_MA_METHOD`,
`ENUM_TIMEFRAMES` to their integer values), then diffs a candidate `.set`
against it field-by-field. Run this:

- Before starting any new study.
- Any time a new "default"/baseline `.set` is created by copying from an
  older reference file.
- Any time you're not 100% sure a `.set` still matches the EA's current
  compiled defaults.

The script should just report every difference, not judge which ones are
intentional — some are deliberate (a lower risk cap for one account type,
say), but every one of them needs to be a **conscious** choice by whoever
built the `.set`, not silently inherited. Exit non-zero if any differences
are found, so it's easy to wire into a pre-study checklist.

## 3. Running headless (`terminal64.exe /config:`)

`terminal64.exe /portable /config:"<ini>"` runs a config-driven backtest or
optimization without the GUI. It has several silent-failure modes — none of
them produce an error, all of them produce a normal-looking "successfully
finished" report with wrong data behind it. **Always verify, never assume.**

### 3.1 Only one instance per data folder
MT5 allows only one running instance per data folder. If the terminal (or a
previous headless run) is already open/running, a second launch **silently
does nothing** — exits fast, no report, no error. Check for a running
process before launching:

```bash
ps aux | grep -q "[t]erminal64" && echo "already running"
```

(`pgrep` does not exist in Git Bash/MSYS — it returns "command not found",
exit 127, which is falsy-but-not-actually-checked in a naive `while pgrep
...; do sleep; done` wait loop. That loop will silently do **zero** actual
waiting and immediately launch the next job into an already-busy terminal.
Use the `ps aux | grep -q "[bracket-trick]"` form instead, which avoids
matching its own grep process and actually works.)

If chaining multiple sequential headless launches, verify the wait
mechanism actually blocks (check elapsed time, or watch the log advance)
rather than trusting that a loop "looks right."

If you kill a `terminal64.exe` that was launched from inside a still-running
shell loop (e.g. a background task mid-loop), the loop's next iteration will
immediately relaunch a new instance — this can look exactly like
unexplained "auto-restart" behavior (a new PID appears within seconds no
matter how the old one was killed). Check whether one of your own
background tasks is still mid-loop before chasing a phantom
crash-recovery-mechanism theory.

### 3.2 `ExpertParameters=` must be a bare filename, present in `Profiles\Tester\`, right now
- Pass `ExpertParameters=<bare filename>.set` — **not an absolute path**
  (confirmed to silently fail, same as omitting it entirely).
- The `.set` file must actually be copied into `MQL5\Profiles\Tester\`
  first.
- **Two distinct silent-failure modes, not one**:
  1. **No `ExpertParameters` given, or an absolute path given**: the Tester
     silently reuses whatever `.set` was last associated with an Expert of
     that exact name — which, in a long-lived project with many prior test
     iterations (including other AI-assisted sessions sharing the same
     environment), is very often a stale preset from something else
     entirely. It will **not** fall back to the `.mq5`'s compiled-in
     defaults in this case.
  2. **The bare filename doesn't currently exist in
     `MQL5\Profiles\Tester\`** (e.g. it was copied there in an earlier
     session and has since been removed, or was simply never copied this
     session): the Tester does **not** error and does **not** reuse a
     stale `.set` either — it silently runs with the `.mq5`'s **raw
     compiled-in defaults**. A confirmed real case: an EA produced a
     completely normal "successfully finished" report at exactly its
     plain baseline numbers when the intended `.set` had fallen out of
     that folder — no error, no warning, values simply reverted to
     hardcoded `input` defaults.
- **Always verify the report's own Settings section shows the parameter
  values you intended**, and confirm the `.set` file is actually present
  in `Profiles\Tester\` *right now* — not "was copied there earlier this
  project."

### 3.3 Use "Every tick based on real ticks" (`Model=4`) for anything with intrabar exit logic
If the EA reads live bid/ask on every tick for exits (touch-mode stops,
trailing logic, etc.), `Model=1`'s synthetic intrabar tick path can produce
a materially different trade history than `Model=4` or a manual GUI run —
even though both "complete successfully" with plausible-looking numbers.
`Model=4` reproducing a manual GUI run's deal log exactly (down to the
second, across 100+ deals) is the standard to test against if in doubt.
`Model=4` headless runs are not inherently slow or prone to hanging — don't
assume `Model=1` is a safe default "for speed" without checking whether it
actually changes results for your specific EA's logic.

### 3.4 Pass the config path as a literal, fully-backslash Windows path — never build it with `/`
Passing `/config:"<ini>"` with **any** forward-slash segment in the path —
even a single one, even from a shell variable that's otherwise a correct
Windows path (e.g. `"$SCRATCH/name.ini"` where `$SCRATCH` itself is
backslash-correct) — causes `terminal64.exe` to **silently ignore the
config entirely**. No error. The confusing part: the terminal can still
complete some **leftover/stale** simulation from a previous run (a real
"Test passed" + final balance appears in the log) without ever loading your
intended `.set`/`Report=` name — so a report file under your intended name
simply never appears, but the log alone looks superficially like a
successful run.

**Always verify the report file was actually created under the exact name
you passed** (the `Report=` value in the `.ini`) before trusting anything
in the log. The log's own `Terminal: launched with ...` line is a fast
sanity check — if a mixed-slash path was silently mangled, this line will
show it was truncated at the last all-backslash segment (e.g. printing only
up to `...\Temp\claude`, with the filename silently dropped). If that line
doesn't show your full intended filename, the config wasn't loaded, full
stop — don't infer success from "the process ran and exited 0."

Build the whole config path as one literal, fully-backslash string with no
shell-side path joining using `/` for even one segment — write out each
`.ini`'s full path explicitly rather than concatenating a variable with a
`/`.

### 3.5 "Cloud servers switched off" is benign
This line in the log, followed immediately by "cloud network mode is off"
and the run proceeding normally on local agents, appears on essentially
every headless run in most environments (even fully successful ones). It is
not diagnostic of anything going wrong — don't chase it.

### 3.6 Verify the authorized account, every time
If a terminal's stored account list has ever picked up a stray account from
a different project or a misdirected launch (e.g. a `.ini` accidentally
pointed at the wrong terminal executable), that account can become a cached
default — `Login=` in the `.ini` silently stops taking effect, even with an
explicit `Server=` override, and the run authorizes as the wrong account
instead. This produces a normal-looking "successfully finished" report with
a real (just wrong) dataset behind it. **Always verify the report's own log
shows the intended account authorized** (the `authorized on <server>` line),
the same way you verify the Settings section and the `.set` values. Fix, if
it happens: open the terminal GUI and remove the stray account from its own
stored account list.

### 3.7 Run config-driven launches in the foreground
Launch with the actual literal command in the foreground (no `&`, no
background-mode execution) so the calling process actually waits for
completion instead of returning as soon as the terminal is merely launched.
A backgrounded launch that returns immediately gives no signal about
whether the run — let alone the correct run — actually happened.

### 3.8 Minimal working reference `.ini`
```ini
[Tester]
Login=<account>
Expert=<ExpertsSubfolder>\<ExpertName>
ExpertParameters=<bare filename>.set
Symbol=EURUSD
Period=H4
Model=4
Optimization=0
FromDate=2025.01.01
ToDate=2026.01.22
ForwardMode=0
Deposit=100000
Currency=USD
Leverage=30
ExecutionMode=0
Report=<report name>
ReplaceReport=1
ShutdownTerminal=1
Visual=0
```
`Server=<broker server>` is worth adding explicitly under `[Tester]` too if
you've ever seen account/login drift (§3.6).

## 4. Optimization modes — know which one you're actually running

- `Optimization=0` — single run with the given parameters. What most
  "did it work" checks should use.
- `Optimization=1` — slow/exhaustive: evaluates every combination in the
  parameter grid.
- `Optimization=2` — "fast genetic": for a genuinely large search space this
  subsamples, but for a **small** grid (tens to low hundreds of
  combinations) it may simply evaluate the full grid anyway — don't assume
  "genetic" implies "sampled" without checking the actual number of passes
  reported.
- `Optimization=3` — "all symbols selected in Market Watch": reruns one
  fixed, non-optimized configuration once per symbol in Market Watch. This
  is a *symbol sweep*, not a parameter search — useful for fast
  cross-symbol screening with a fixed baseline config, not for tuning.

## 5. Study design: don't let one clean window fool you

These aren't MT5-specific gotchas so much as backtest-methodology
disciplines that turned out to matter a great deal in practice — several
real, materially wrong conclusions were only caught by applying them.

- **A single in-sample window is not validation.** A strategy/symbol/
  parameter set that looks clean over one screening window can be hiding a
  real adverse episode that window simply didn't contain. Always follow a
  promising screening result with genuine out-of-sample windows (data the
  screen never touched) before trusting it.
- **Balance and Equity diverge, and Balance lies by omission.** Balance
  only updates on realized (closed) trades; Equity reflects floating P&L.
  A strategy that averages into an adverse trend (DCA, martingale-style
  grids, any no-fixed-stop averaging design) can show a flat, reassuring
  Balance curve for weeks while Equity is deeply underwater — a real,
  live risk that a Balance-only report or a cursory glance completely
  hides. Always check Equity Drawdown, not just Balance Drawdown, and treat
  a large gap between the two as a finding in its own right, not noise.
- **Check for hidden parameter-space cliffs near anything you're about to
  deploy.** An attractive-looking optimum can sit immediately next to a
  catastrophic one. Before trusting a "best" parameter combination, run a
  denser grid in its immediate neighborhood (finer step size, centered on
  the candidate) and confirm the result is a stable plateau, not an
  isolated spike — a strategy whose profitability collapses from one grid
  step to the next is not robust, however good the exact optimum looks.
- **Walk-forward with fixed (non-reoptimized) parameters still tells you
  something important**, even for a strategy that isn't meant to be
  re-tuned per period: split the full history into sequential windows and
  confirm the *deployed*, fixed configuration holds up in each one, not
  just in the aggregate. A strategy that's net profitable overall but loses
  money in one out of five sequential half-year windows is a different risk
  profile than one that's clean in all five, even with identical aggregate
  numbers.
- **Trade-resampling Monte Carlo measures ordering risk, not total risk.**
  Bootstrap-resampling a deal log's closed-trade P&Ls (with replacement) to
  build many simulated equity paths tells you how much *sequencing* of the
  same historical trades matters — a cheap, useful sanity check that
  doesn't require new backtests. But if you build this by parsing only the
  deal-level "Profit" column, you will silently **exclude Swap** (and
  Commission, if it's a separate column) from every simulated path. For a
  strategy that holds positions for extended periods, accumulated swap can
  be a real and substantial cost that has nothing to do with trade
  ordering — it's a function of holding time, not luck — so a Monte Carlo
  built this way will be systematically optimistic versus the strategy's
  true realized-P&L distribution. Decide deliberately whether to include
  swap/commission in the pooled P&L or note the exclusion explicitly; don't
  let it happen by accident of which HTML column got parsed.
- **A correlation/diversification claim needs an actual combined-portfolio
  measurement, not just a low pairwise correlation number.** Two low-
  correlation symbols can still share a real, overlapping drawdown episode
  under specific conditions (e.g. correlated moves during a macro event)
  that a static correlation coefficient doesn't capture. Actually construct
  the combined equity curve for candidate portfolio combinations and
  measure its drawdown directly before treating "low correlation" as
  sufficient evidence of diversification benefit.
- **Before trusting *any* backtest report, verify it three ways, every
  time**: (1) the report's own Settings section shows the symbol, date
  range, and key parameter values you intended; (2) the account/login
  authorized matches what you specified; (3) if the run depended on a
  `.set` file, that its values match what you expect (§2). None of these
  are one-time checks — every one of the failure modes in §3 produces a
  report that looks completely normal until you check.
