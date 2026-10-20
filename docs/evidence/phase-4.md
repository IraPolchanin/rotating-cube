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
- Risk 2 (WebGL in headless Chromium and Firefox): verified **only on the Windows
  development machine** — canvas, rendering and the no-console-error test passed in
  both browsers there. This entry originally said "resolved"; that was wrong, because
  Linux CI was not exercised. CI later failed for Firefox (see "CI follow-up").
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

## T6 — Pointer capture over the Reset button + mutation checks (AC-14, AC-15, AC-12)

- Red run: **green on arrival** — `npx playwright test e2e/capture.test.ts` passed in
  both browsers, because pointer capture already existed from T4. The test was
  therefore validated by deliberate mutations, each reverted afterwards:
  - M1 — disabled `setPointerCapture` (`if (pointerId < 0) …`): AC-14 failed in
    Chromium and Firefox (`not.toHaveAttribute` failed). The test keeps moving the
    pointer inside the button, so it depends on capture; a version that only
    dragged up to the button would not have failed.
  - M2 — `touch-action: none` → `auto`: AC-15 failed in both browsers
    (`Expected: "none"`, `Received: "auto"`).
  - M3 — `clampX` returned its input unchanged: 2 unit tests failed (`applyDrag`
    AC-12, `clampX` AC-12) and 4 e2e AC-12 tests failed (mouse and touch × 2
    browsers).
- After reverting, `git status` showed only the new `e2e/capture.test.ts` and
  `git diff -- src` was empty, so no experiment artefacts remained.
- Hook events: M3 triggered a PostToolUse block (`TS6133` / `no-unused-vars` for the
  now-unused `MAX_X`) — a side effect of the mutation, not of the final code. No
  pre-commit or Stop-hook block before the commit.
- Check runs: 1 × `npm run check` after reverting, green (18 unit tests, 40 e2e).
- spec-reviewer: 1 invocation → "No violations found."
- Human intervention: none.
- Commit: `test(e2e): verify pointer capture over reset button (AC-14)`

## T7 — Phase close-out

- Final `npm run check` on a clean tree: green (typecheck, lint, 18 unit tests,
  build, 40 e2e = 20 per browser). After adding two unit tests below: 20 unit tests.
- spec-reviewer on the cumulative Phase 4 code: "No violations found." It listed
  weakly covered areas; two were closed with unit tests (`applyDrag` wiring to
  `normaliseY`; leaving the X clamp when the drag reverses). Remaining, accepted:
  - AC-6 / AC-7: synthetic touch only; real pointer capture for touch is not
    exercised (spec §3; real devices are a manual check).
  - Y wrap-around is not exercised end to end (unit-tested only).
  - `rz` is asserted unchanged only after the AC-4 / AC-5 mouse drags.
  - AC-13 observes the console only during load (matches the spec wording).
  - Latent edge: `formatDegrees(-179.96)` would print `-180.0`; not reachable with
    0.5 deg/px and integer pixel deltas.
- Manual checks (spec §7.3): **NOT performed** by the agent. Pending for the human:
  cube appearance (FR-1), drag smoothness (FR-2), canvas fills the viewport without
  gaps or scrollbars (FR-6), real physical touch device (FR-3), and a run in the
  latest stable desktop Chrome and Firefox (NFR-7; Playwright uses its own builds).
- Not verified: CI on the Phase 4 commits (nothing pushed; a push needs the human's
  explicit approval).
- Human intervention in Phase 4: plan approval with two changes (T0 added; narrower
  `setPointerCapture` handling) and declining the `git push` probe in T0.

### Summary

| Task | Red run | `check` runs | Hook blocks (PostToolUse) | Reviewer findings | Human intervention | Commit |
|------|---------|--------------|---------------------------|-------------------|--------------------|--------|
| T0 | n/a (probe) | 0 | 0 | not run | declined push prompt | `6127eec` |
| T1 | 15 failed / 3 passed | 1 | 2 (lint, stub) | 0 | none | `c45e272` |
| T2 | 10 failed (5 tests × 2) | 1 | 4 (`prefer-const`) | 0 | none | `f1710b3` |
| T3 | 2 failed; AC-10/AC-11 green on arrival | 2 | 0 | 1 low, fixed | none | `08f073e` |
| T4 | 12 failed | 2 | 4 (TS, transient) | 1 low, fixed | none | `bdd2cb9` |
| T5 | 8 failed, 12 passed | 1 | 2 (TS, transient) | 0 | none | `d66d186` |
| T6 | green on arrival; 3 mutations caught | 1 | 1 (mutation side effect) | 0 | none | `6f3352b` |
| T7 | n/a | 2 | 0 | 0 (cumulative) | none | this commit |

### Manual checks (reported by the human, 2026-10-20)

Recorded in `docs/quality-gates.md` §12. Chrome desktop and Chrome DevTools device
emulation passed; Firefox desktop and a real touch device were not checked. This
supersedes the "NOT performed" line in the T7 entry above for the Chrome items.

## CI follow-up — Firefox WebGL failure on Linux (branch `fix/firefox-ci-webgl`)

- Failure: CI run 39419753170 on `main` (`795832e`) failed `npm run check` at e2e:
  19 of 40 tests failed, all in Firefox; Chromium 20/20. In the failing tests
  `div[data-testid="cube-scene"]` did not exist, because mounting threw.
- Diagnostics added (not masking): `e2e/webgl.test.ts` (reports whether the browser
  can create a WebGL2 context, with an explicit message) and AC-13 now asserts the
  collected console/page errors **before** waiting for the scene, so the real error
  is reported instead of an "element(s) not found" timeout. The cube tests are
  unchanged and still fail on their own when the cube is missing; verified with
  Firefox WebGL disabled (`webgl.disabled`), where the new test, AC-13 and AC-1 fail.
- Reproduced locally on Ubuntu 24.04.5 (Podman, `mcr.microsoft.com/playwright:v1.64.1-noble`,
  `CI=1`): same failure. Exact reason from three.js:
  `WebGL creation failed: * AllowWebgl2:false restricts context creation on this system.`
  So the cause is WebGL initialisation (three.js needs WebGL2), not a React or code bug.
- Tried in that container (webgl test only, Firefox): default; `webgl.force-enabled`;
  + `gfx.webrender.software`; + `layers.acceleration.disabled`; + `webgl.enable-webgl2`
  + `security.sandbox.content.level: 0`; `webgl.enable-webgl2` alone; `webgl.force-enabled`
  + `forbid-hardware` + `disable-angle` → all **failed**. Headed Firefox under
  `xvfb-run` (with and without `webgl.force-enabled`) → **passed**.
- Fix (minimal, no prefs): Firefox project `headless: !process.env['CI']` in
  `playwright.config.ts`, and CI runs `xvfb-run -a npm run check`.
- Verified in the container (Ubuntu 24.04, `CI=1`, `xvfb-run -a npm run check`):
  typecheck, lint, 20 unit tests, build, 42 e2e (21 per browser) all green. Locally on
  Windows: `npm run check` and three further `npx playwright test` runs (42/42).
- One local run showed a single Firefox `NS_ERROR_CONNECTION_REFUSED` on `page.goto`
  (AC-10) before three green reruns. Port 5173 was held by an existing process, which
  Playwright reuses outside CI; the cause of that one failure is **not established**.
- **Not yet verified:** the fix on real GitHub Actions. The container is not
  identical to the runner (container ships preinstalled deps; the runner uses
  `playwright install --with-deps`; `npm ci` in the container used `--ignore-scripts`).
  The branch has not been pushed; CI on it is the remaining check.
