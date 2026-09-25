# Internal Handoffs

This directory contains private operational handoffs. It is never part of a
product release.

- `CURRENT_HANDOFF.md` is the one current, concise operational snapshot.
- `archive/` holds snapshots only at meaningful milestone or major-state
  transitions.
- `../docs/HANDOFF.md` remains baseline context, but it is not the current
  operational snapshot.
- `../prompts/SESSION_HANDOFF.md` is the prompt to paste into a new session or
  on another machine to continue with the same rules.
- `../prompts/MVP_SESSION.md` narrows that handoff to finishing the MVP
  (owner review fixes and release readiness).

The current handoff never overrides an approved ADR or authoritative project
specification.
