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

## T1 — Pure rotation logic (AC-3 format, AC-4, AC-5, AC-6, AC-7, AC-9, AC-12, A-6)

- Red run: `npx vitest run` against throwing stubs → 15 failed, 3 passed
  (`Error: not implemented`); exit 1. The 3 passing tests were the two constant
  checks (`INITIAL_ORIENTATION`, `SENSITIVITY`) and the pre-existing scaffold smoke
  test (`vitest runs`), which the stub already satisfied. (Corrected in the T2
  commit: the T1 commit text wrongly said "one non-throwing path".)
- Hook events: PostToolUse blocked 2 times (after writing the stub and the test file),
  both with the same 6 `@typescript-eslint/no-unused-vars` errors for the stub's
  unused parameters. Resolved by the real implementation. No pre-commit or Stop-hook
  block before the commit.
- Check runs: 1 × `npm run check`, green on first run (typecheck, lint, 18 unit
  tests, build, 2 smoke e2e).
- spec-reviewer: 1 invocation → "No violations found."
- Human intervention: none.
- Commit: `feat(cube): add pure rotation logic (AC-4, AC-5, AC-9, AC-12)`

## T2 — Scene, cube, DOM contract (AC-1, AC-2, AC-3, AC-13, AC-15)

- Red run: `npx playwright test e2e/scene.test.ts` before any implementation → all
  five new tests failed in both browsers (`element(s) not found` from
  `toBeAttached` / `toHaveAttribute`); exit 1.
- Hook events: PostToolUse blocked 4 times (3 `Write`, 1 `Edit`), always the same
  `prefer-const` error on `orientation` in `createCubeScene.ts` (it becomes `let`
  only when drag lands in T4). Fixed by making it `const`. No pre-commit or
  Stop-hook block before the commit.
- Check runs: 1 × `npm run check`, green (18 unit tests, build, 12 e2e = 6 per
  browser). The build prints a non-fatal chunk-size warning (three.js, 752 kB
  minified); exit code 0, left as is.
- Risk 2 (WebGL in headless Chromium and Firefox): resolved — canvas, rendering and
  the no-console-error test pass in both browsers with the default config.
- spec-reviewer: 1 invocation → "No violations found."
- Human intervention: none.
- Also: corrected the T1 entry (the 3 passing tests in the T1 red run were the two
  constant checks and the pre-existing scaffold smoke test).
- Commit: `feat(cube): render cube scene with testability contract (AC-1, AC-2, AC-3, AC-13, AC-15)`
