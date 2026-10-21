# Rotating Cube

[![CI](https://github.com/IraPolchanin/rotating-cube/actions/workflows/ci.yml/badge.svg)](https://github.com/IraPolchanin/rotating-cube/actions/workflows/ci.yml)
[![Deploy](https://github.com/IraPolchanin/rotating-cube/actions/workflows/deploy.yml/badge.svg)](https://github.com/IraPolchanin/rotating-cube/actions/workflows/deploy.yml)

A small browser app that shows a 3D cube you rotate by dragging with a mouse or a
finger. It exists to practise **harness engineering**: all application source code
was written by Claude Code; the human engineer reviewed and approved plans but did
not write or edit source files. The interesting part is the harness around the code,
described below.

**Live demo:** <https://irapolchanin.github.io/rotating-cube/>

## The application

- React 19 + TypeScript (strict) + Three.js, built with Vite.
- Horizontal drag rotates the cube mesh around Y, vertical drag around X (clamped to
  ±90°). The camera never moves and `OrbitControls` is banned by a lint rule.
- Input uses Pointer Events with pointer capture; the canvas has `touch-action: none`.
- A **Reset** button restores the initial orientation immediately.
- The canvas fills the viewport and follows window resizes.

Requirements and acceptance criteria (AC-1 … AC-16): [docs/spec.md](docs/spec.md).

## Run and check locally

Requires Node.js 22 (see [.nvmrc](.nvmrc)).

```bash
npm ci                                    # also sets core.hooksPath=.githooks (prepare script)
npm run dev                               # Vite dev server on http://localhost:5173
npx playwright install chromium firefox   # once, for the e2e tests
npm run check                             # full quality gate
```

| Script | What it does |
|--------|--------------|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm test` | Vitest unit tests (rotation logic) |
| `npm run build` | `vite build` |
| `npm run e2e` | Playwright on Chromium and Firefox (starts the dev server itself) |
| `npm run check` | The five steps above, in order |
| `npm run e2e:deployed` | AC-16 against the public URL; needs `DEPLOYED_URL`, not part of `check` |

Last local run of `npm run check` (2026-10-21): all five steps passed, 20 unit tests
and 42 e2e tests (21 per browser).

## The harness

Each mechanism, with its verification results and known gaps, is described in
[docs/quality-gates.md](docs/quality-gates.md).

| Layer | What it does | Where |
|-------|--------------|-------|
| Specification | Requirements, numbered acceptance criteria, testability contract (`data-testid` and `data-cube-r*` attributes), enforcement boundary. Changes need human approval. | [docs/spec.md](docs/spec.md) |
| Agent instructions | Workflow (read spec → plan → approval → small steps → `npm run check`), commit convention, prohibitions (no weakening tests/lint, no `@ts-ignore`, no `--no-verify`). | [CLAUDE.md](CLAUDE.md) |
| After-edit hook | `typecheck` + `lint` after every agent `Edit`/`Write` of code or JSON files; failures are fed back to the agent. | [scripts/agent-hook-check.mjs](scripts/agent-hook-check.mjs), [.claude/settings.json](.claude/settings.json) |
| Pre-commit hook | `typecheck` + `lint` + `test` block a failing commit. | [.githooks/pre-commit](.githooks/pre-commit) |
| Stop hook | Runs the full `npm run check` before the agent may finish a turn with uncommitted code changes; a repeated failure halts the session for the human. | [scripts/agent-stop-check.mjs](scripts/agent-stop-check.mjs) |
| Permission guardrails | The agent cannot run `git commit --no-verify`/`-n`, `git -c`, `git -C`; every `git push` asks for confirmation. | [.claude/settings.json](.claude/settings.json) |
| Lint rule | `no-restricted-imports` blocks `OrbitControls` imports (NFR-8). | [eslint.config.js](eslint.config.js) |
| Reviewer subagent | Read-only `spec-reviewer` checks diffs against the AC and CLAUDE.md rules (e.g. the mesh, not the camera, rotates). | [.claude/agents/spec-reviewer.md](.claude/agents/spec-reviewer.md) |
| CI | `npm run check` on every push and pull request, on Ubuntu with Chromium and Firefox. | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Deployment | On push to `main`: full `check` → deploy to GitHub Pages → post-deploy e2e (AC-1, AC-13, FR-1) on the live URL. A red commit is never deployed. | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| Evidence | Task-by-task log, verification record, manual-check results, session transcripts. | [docs/evidence/phase-4.md](docs/evidence/phase-4.md), [docs/quality-gates.md](docs/quality-gates.md) §11–12, [docs/sessions/](docs/sessions/) |

### Evidence highlights

- Successful deployment (build → deploy → live-URL checks):
  [Deploy run 39580385881](https://github.com/IraPolchanin/rotating-cube/actions/runs/39580385881).
- Deliberate failure on a temporary branch: `build` failed at `npm run check`, and
  `deploy` and `verify-deployed` were skipped:
  [Deploy run 39585105380](https://github.com/IraPolchanin/rotating-cube/actions/runs/39585105380).
- Mutation checks: disabling `setPointerCapture` fails AC-14, `touch-action: auto`
  fails AC-15, removing the X clamp fails AC-12 (unit and e2e), see
  [docs/evidence/phase-4.md](docs/evidence/phase-4.md).
- A real CI catch: Firefox could not create WebGL2 on the Linux runner and 19 e2e
  tests failed; the cause was diagnosed and fixed (headed Firefox under `xvfb-run`),
  see "CI follow-up" in [docs/evidence/phase-4.md](docs/evidence/phase-4.md).
- Other runs, manual checks and open items: [docs/quality-gates.md](docs/quality-gates.md).

### Known limitations

Stated in full in [docs/quality-gates.md](docs/quality-gates.md); the main ones:

- No branch protection or required status checks.
- Pre-commit hook activation on a fresh clone is not verified.
- Guardrails bind the agent only and have known pattern gaps (§5).
- Manual browser and device checks are recorded as reported by the human.
- `npm run check` runs twice per push to `main` (CI and Deploy).

## How it was built

Built with Claude Code in seven sessions; the transcripts are in
[docs/sessions/](docs/sessions/). The model was Sonnet 4.6 in session 1 and Sonnet 5.5
afterwards. Claude Code versions changed during the project because of auto-updates.

| Session | Work | Transcript |
|---------|------|------------|
| 1 | Specification, CLAUDE.md and quality-gates drafts, **Phase 1**: project scaffold and quality tooling (Vite, ESLint, Vitest, Playwright, `npm run check`) | [session 1](docs/sessions/2026-10-19-session-1.txt) |
| 2 | **Phase 2**: after-edit, pre-commit and Stop hooks, permission guardrails, `spec-reviewer` subagent; phase workflow added to CLAUDE.md | [session 2](docs/sessions/2026-10-19-session-2.txt) |
| 3 | `spec-reviewer` verification only | [session 3](docs/sessions/2026-10-19-session-3.txt) |
| 4 | **Phase 3**: repository publication and the CI workflow, with a deliberate failure and revert | [session 4](docs/sessions/2026-10-20-session-4.txt) |
| 5 | **Phase 4**: the cube, unit and e2e tests, Firefox WebGL fix in CI | [session 5](docs/sessions/2026-10-20-session-5.txt) |
| 6 | **Phase 5**: spec v1.1, GitHub Pages deployment, post-deploy check | [session 6](docs/sessions/2026-10-21-session-6.txt) |
| 7 | README for evaluators | [session 7](docs/sessions/2026-10-21-session-7.txt) |

## License

[MIT](LICENSE)
