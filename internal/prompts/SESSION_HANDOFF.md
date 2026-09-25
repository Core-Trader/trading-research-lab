# Reusable prompt: continue Trading Research Lab in a new session

Paste everything below the line into a new Claude session (or on another
machine) working in `C:\DEV\Trading_Research_Lab`. It points to the repository's
own sources instead of copying them, so it stays current. The rules written out
in full here are the ones that are not recorded anywhere else in the repository.

Written 2026-09-25. If anything below conflicts with an approved ADR or an
authoritative specification in `internal/`, the ADR or specification wins. Tell
the owner about the conflict.

---

You are continuing development of Trading Research Lab (TRL), an Obsidian
Desktop plugin with a Python Research Core, in `C:\DEV\Trading_Research_Lab`.

## 1. Orient before acting

Read these files in order:
1. `CLAUDE.md`: locked rules and the required reading list.
2. `internal/handoffs/CURRENT_HANDOFF.md`: the operational snapshot, which is
   not the source of truth. Also `internal/handoffs/README.md` and
   `internal/handoffs/HANDOFF_TEMPLATE.md`.
3. `internal/docs/HANDOFF.md`: baseline context.
4. `internal/docs/ROADMAP.md`: milestone order and status. The active
   product track is `internal/docs/MVP_FAST_TRACK.md`.
5. `internal/docs/DEVELOPMENT_PLAYBOOK.md`.
6. `internal/docs/DECISION_LOG.md`: every decision, in one table and not in
   date order. Search for an ID (for example NOTES-2 or EXEC-1) or a date
   (for example 2026-09-25).
7. `internal/docs/VAULT_DOCUMENT_CONVENTION.md`: frontmatter, generated
   blocks, and one `TRL:RECORD` block per kind of recorded check (NOTES-2).
8. `internal/references/REFERENCE_REGISTER.md` and
   `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md`.
9. The latest development-journal entry: the end of the newest file in
   `internal/development-journal/`. Entries dated 2026-09-25 were appended to
   `2026-09-24-windows-and-notes.md`.
10. The open proposals: `internal/docs/PROPOSAL_*.md`. Each file's
    **Status** line says APPROVED and BUILT, DEFERRED, or DRAFT.

Then summarise back to the owner:
- the current state
- the proposals by status (approved and built, deferred, draft)
- the owner-review items still pending in Obsidian
- the next step you recommend

**Change nothing until the owner confirms.**

## 2. Git and commit compatibility

- **Repository and remote:** `C:\DEV\Trading_Research_Lab`, branch `main`,
  which tracks `origin/main` (`https://github.com/Core-Trader/trading-research-lab`,
  private).
- **Committer email:** the GitHub noreply address already set in the
  repository config. Check it with `git config user.email`; it should be
  `333476105+Core-Trader@users.noreply.github.com`. Never change it.
- **Commit messages:** a short imperative summary line, a body if useful, and
  the `Co-Authored-By` attribution line your session is told to use.
- **Push:** run `git push` right after every commit.
- **Before each push:** confirm that no `data/raw` real data, no `.trl-*`
  files, and no `.ex5` files are staged or in the unpushed commits
  (`git diff --name-only origin/main..main`). If any are, stop and tell the
  owner.
- **Never** force-push, rewrite history, or push other branches unless the
  owner asks.
- **On a push failure** (authentication, a rejected non-fast-forward, the
  network, or a permission prompt that denies it), report the error and stop.
  No pull, no rebase, no force, and no retrying by another route.
- **Report the pushed commit hash every time.**

## 3. Working method

- **New features:**
  - write a short proposal in `internal/docs/PROPOSAL_<TOPIC>.md`, with
    numbered owner decisions and a recommendation for each
  - wait for the owner's approval before building
  - afterwards, set the proposal's Status line to APPROVED and BUILT, or
    DEFERRED
- **One calculation authority:** the Python Research Core
  (`research-core/`) does all financial calculation. The plugin
  (`plugin/`) does no maths, not even sums of two Core values; add a field to
  the Core instead.
- **Sourcing rule:**
  - every trading practice or threshold cites a verifiable source (MT5 help,
    NIST, a paper, a firm's rule page), registered in the reference register
    after you have read it yourself
  - otherwise it is labelled "user-defined" (your own threshold) or "TRL
    suggestion"
  - never invent numbers
  - the labels are S (sourced), W (the owner's workflow choice), C (TRL
    suggestion), and U (user-defined), as in
    `plugin/src/components/help/research-workflow.ts`, which also holds the
    source list
- **Interpretation and tips:**
  - they go through the shared, hideable components in
    `plugin/src/components/guidance.tsx` (GUIDE-1)
  - the wording lives in `*-model.ts` files, each with a test that sourced
    points cite registered sources
- **Tests:**
  - every quantitative, protocol, and vault-safety rule has tests
  - before committing, run both suites: Core, then plugin, then the build:

    ```bash
    cd research-core && .venv/Scripts/python.exe -m pytest -p no:cacheprovider
    ```

    ```bash
    cd plugin && npm test
    ```

    ```bash
    cd plugin && npm run build
    ```

- **The UI check:**
  - use the browser harness (`preview_start` with "ui-harness"), and state
    clearly what was verified there and what only in Obsidian
  - **Caveat:** the harness pages, stubs, and fixtures currently live only in
    the previous session's scratchpad. `.claude/launch.json` points there and
    is not tracked by git, so on a new session or machine the harness must be
    rebuilt.
  - to rebuild it: esbuild bundles of single components, an `obsidian` alias
    to a stub, and fixtures made from real Core output
  - moving the harness into the repository is a recommended follow-up (ask
    the owner first)
- **After substantial work:** update `internal/docs/DECISION_LOG.md`, the
  development journal, and `internal/handoffs/CURRENT_HANDOFF.md`.
- **External code:** record any reuse of Journalit or Strategy Factory code
  in `internal/references/EXTERNAL_CODE_USAGE_REGISTER.md` (none so far).
- **Real data checks:** the owner's development vault
  (`C:\DEV\vaults\TRL-Dev-Vault\.trl-data`) and the MT5 corpus
  (`data/raw/corpus/`) can be read to check features on real reports. Do not
  modify them; use a scratch workspace for imports.

## 4. MT5 safety rules

- **Terminal and account:** the portable FTMO terminal
  `C:\FTMO Global Markets MT5 Terminal`, account 540291482 on FTMO-Server4.
- **Before every launch,** check `Get-Process terminal64`. If MT5 is
  running, stop and ask; do not close it without the owner's permission for
  that occasion.
- **Launch:** `/portable` with a `[Tester]`-only ini and no password.
- **Never** trade, enable algo trading, attach EAs to charts, or change
  `[Experts]` or other terminal settings.
- **Files:**
  - create only `TRL_`-prefixed files
  - never edit other projects' files or the owner's original EAs (work on
    copies only)
  - after a run, remove the `TRL_*.set` presets from
    `MQL5\Profiles\Tester` once they are byte-compared with the corpus copies
- **Verify each run three ways,** as in the manifest:
  - the report exists
  - the settings and inputs match
  - the terminal log shows the account authorised
- **Log corpus runs** in `data/raw/corpus/CORPUS_MANIFEST.md` (git-ignored).
- **Never commit** `.ex5` files or real data.
- **Attaching the equity logger:** see `internal/prompts/ATTACH_EQUITY_LOGGER.md`.
- **PowerShell caution:** PowerShell variable names ignore case, so do not
  use `$c` and `$C` together.

## 5. Privacy and scope

- `internal/` is private and is never included in a release.
- The owner's personal vault, the development vault, and the repository stay
  separate.
- No telemetry, accounts, payments, licensing, or network features.

## 6. Writing for the owner

- **Style:** plain language; the owner reads the results, not the code.
- **Codes:** show plain meanings on screen, never raw codes (UIX-5,
  `plugin/src/components/plain-language.ts`).
- **Accuracy:**
  - verify every statement to the owner against the code, the tests, or
    the data
  - say what was checked and how
  - report failures and slips plainly, and correct wrong earlier statements
- **Caveats:** do not repeat a caveat or reminder the owner has already
  acknowledged. Say it once at most.
- **Decisions:** ask only for decisions that are genuinely the owner's; work
  autonomously otherwise.

## 7. Before ending a session or when context runs low

- Update `internal/handoffs/CURRENT_HANDOFF.md`: what changed, what was
  verified and how (tests, the harness, real data, or Obsidian), and what is
  next.
- Commit, check, push, and report the hash.
