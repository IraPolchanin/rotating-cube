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

## T3 — Resize (AC-10, AC-11, FR-6)

- Red run: `npx playwright test e2e/resize.test.ts` before implementation → 4 passed,
  2 failed. AC-10 and AC-11 were **green on arrival** in both browsers: the CSS
  (`width: 100%` on a fixed full-viewport wrapper, from T2) already makes the canvas
  follow the viewport. The only red tests were the extra FR-6 drawing-buffer test
  (`canvas.width` not following the viewport) in Chromium and Firefox. AC-11 on its
  own therefore does not prove the resize code; the FR-6 test does.
- Hook events: none (no PostToolUse, pre-commit or Stop-hook block).
- Check runs: 2 × `npm run check`, both green (the second after the reviewer fix).
- spec-reviewer: 1 finding (low): the FR-6 test divided by the raw
  `devicePixelRatio` while the renderer caps it at 2 → fixed in the test with
  `Math.min(devicePixelRatio, 2)`. No other findings.
- Human intervention: none.
- Commit: `feat(cube): resize canvas with viewport (AC-10, AC-11)`

## T4 — Mouse and touch drag (AC-4, AC-5, AC-6, AC-7, AC-12; FR-2, FR-3, FR-4)

- Red run: `npx playwright test e2e/drag.test.ts` before implementation → 12 failed
  (6 tests × 2 browsers), all `toHaveAttribute` / `not.toHaveAttribute` failures
  because the attributes never changed; exit 1.
- Hook events: PostToolUse blocked 4 times on TypeScript errors (`TS2304` missing
  `capturePointer` / `applyDrag`, `TS2588` assign to const `orientation`). These were
  transient: the implementation was applied as five separate edits, and the hook ran
  after each before the set was complete. The final state had none.
  No pre-commit or Stop-hook block before the commit.
- Check runs: 2 × `npm run check`, both green (the second after the reviewer fix);
  30 e2e tests (15 per browser).
- Touch input: simulated with synthetic `PointerEvent` (`pointerType: "touch"`);
  Playwright's mouse API cannot produce touch pointers. A cleaner option than
  `try/catch` was considered: branching on `event.isTrusted` would put test-aware
  logic in production code, CDP touch works in Chromium only, and `hasPointerCapture`
  cannot predict whether `setPointerCapture` will throw. Kept `try/catch`, catching
  only `DOMException` `NotFoundError` (comment in `capturePointer`).
  Real pointer capture is **not** exercised by these touch tests; it is verified by
  AC-14 with Playwright's mouse (T6).
- spec-reviewer: 1 finding (low): the touch AC-12 test checked only the final value,
  not the bound during the drag → fixed by firing each touch event in its own
  `page.evaluate` and sampling `data-cube-rx` after every step. The `try/catch` was
  judged justified and narrowly scoped. No other findings.
- Human intervention: none.
- Commit: `feat(cube): rotate cube mesh on pointer drag (AC-4, AC-5, AC-6, AC-7, AC-12)`

## T5 — Reset button (AC-8, AC-9; FR-5)

- Red run: `npx playwright test e2e/reset.test.ts e2e/drag.test.ts` before
  implementation → reset tests failed in both browsers (AC-8 `toBeVisible` failed;
  the four AC-9 tests timed out at 30 s on the missing button); the refactored drag
  tests passed (12). Total 8 failed, 12 passed.
- Refactor: shared e2e helpers extracted to `e2e/helpers.ts`; `drag.test.ts` now
  imports them. Verified with `git show HEAD:e2e/drag.test.ts` vs the working file:
  same 6 tests and identical `expect` lines (the reviewer could not run git and
  said so; this check was done by the agent).
- Hook events: PostToolUse blocked 2 times on TypeScript errors (`TS2741` missing
  `reset` in the returned object, `TS2552` unknown `resetOrientation`), transient
  between separate edits of `createCubeScene.ts`. No pre-commit or Stop-hook block
  before the commit.
- Check runs: 1 × `npm run check`, green (18 unit tests, 38 e2e = 19 per browser).
- spec-reviewer: 1 invocation → "No violations found." (with the git-diff caveat above).
- Human intervention: none.
- Commit: `feat(reset): restore initial orientation on button click (AC-8, AC-9)`
