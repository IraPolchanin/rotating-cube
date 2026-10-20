# Phase 4 — Evidence of Autonomy

Append-only log. Each entry is filled from real tool output at the time of the
event. Raw transcripts: `docs/sessions/*.txt`.

Template per task:

- Red run: command and failing test names / exit code (or "green on arrival" and why)
- Hook events: PostToolUse blocks, pre-commit blocks, Stop-hook blocks
- Check runs: number of `npm run check` runs; failures before success
- spec-reviewer: findings and their disposition
- Human intervention
- Commit

---

## T0 — Push confirmation guardrail (no AC)

- Red run: n/a (configuration change). Verification by deliberate probe instead:
  `git push origin main` with nothing to push.
- Probe result: permission prompt appeared ("Ask rule Bash(git push*) overrides
  auto mode"); the human declined it; the command did not run.
- Hook events: none recorded (only `.json` and `.md` files edited).
- Check runs: none for T0 (no `src/` or `e2e/` change; pre-commit hook runs on commit).
- spec-reviewer: not run (no `src/` or `e2e/` change).
- Human intervention: declined the push prompt as planned (the verification step
  itself); also approved the plan with two changes (T0 added; narrower
  `setPointerCapture` handling).
- Commit: `chore(settings): require confirmation for git push`
