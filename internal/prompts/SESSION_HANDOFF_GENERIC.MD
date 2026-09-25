Create a reusable session-handoff prompt for THIS project, so the work can move to a new
session (or another machine) without losing context, conventions, or git and commit
compatibility.

Do not assume any structure. Discover it first, then write a handoff prompt that fits this
project's own layout and rules.

## 1. Discover (read-only; change nothing yet)

- **Project instructions:** any CLAUDE.md or AGENTS.md (root and subfolders), README, and
  contributing guides.
- **Existing handoff and state material:** handoff notes, templates, roadmaps, decision logs,
  changelogs, journals, ADRs, TODO or status files. Note where each lives and which ones are
  authoritative.
- **Prompt or instruction folders:** whether the project already has one (for example
  `prompts/`, `docs/prompts/`, `internal/prompts/`) and how files in it are named.
- **Git:** the current branch, its upstream and remote, the configured user.email (read-only),
  the commit-message style and attribution lines from the recent log, whether commits are
  pushed and how, what .gitignore excludes, and any files that must never be committed.
- **Build and test:** how to install, build, lint and test (package manifests, scripts,
  Makefiles, CI config), and which checks must pass before a commit.
- **Working rules:**
  - safety limits, sourcing or citation rules, privacy boundaries
  - external systems the project touches, and the rules for each
  - approval gates (for example "propose, then wait for approval")
- **Rules that exist only in this conversation or in local memory**, not in the repository.
  List them explicitly: a new session or machine will not have them.

Then summarise to me what you found:
- the structure
- the rules
- the git setup
- where you propose to save the handoff prompt
- anything outdated, conflicting or missing

**Wait for my confirmation before writing.**

## 2. Write the handoff prompt

Save it in the project's existing prompts or handoff location, following its naming. If
there is none, propose a location in step 1. Make it a paste-ready prompt that tells a new
session to:

1. **Orient:** read the authoritative files in order (by path), then summarise back:
   - the current state
   - open, approved and deferred work
   - pending reviews
   - the next step

   Change nothing until the owner confirms.
2. **Keep git compatibility:**
   - the same branch, remote and committer identity (never change user.email)
   - the observed commit-message format and attribution
   - the project's push rule
   - pre-commit and pre-push checks, including files that must never be committed
   - no force-push or history rewriting unless asked
   - on a failure, report and stop
3. **Follow the project's working method:** approval gates, where decisions and progress
   are recorded, test and build commands that must pass, and how UI or behaviour is verified.
   It must say clearly what was verified and how.
4. **Keep every safety, privacy and sourcing rule** found in step 1, including the
   session-only ones, now written down.
5. **Communicate as the owner expects:** the language, tone and level of detail observed in
   this project.
6. **Before ending or when context runs low:** update the project's handoff or state file with
   what changed, what was verified, and what's next; then commit and push per the project's
   rules.

Point to files rather than copying their content, so the prompt does not go stale. Every
path you cite must exist. Keep it concise.

## 3. Finish

- Add a one-line pointer to the new prompt in the project's main handoff or state file and
  in any index or README of that folder.
- Commit and push following the project's own rules. If the project doesn't push, or the
  rules are unclear, ask first.
- Show me the final prompt text and the commit (and pushed) hash.