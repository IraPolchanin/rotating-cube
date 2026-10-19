# Rotating Cube — Agent Workspace

## Project

A browser-based application displaying an interactive, mouse- and touch-draggable
3D cube, built to practise harness engineering. All application source code is
written by the agent; the human engineer reviews and approves plans but does not
write or edit source files directly.

- **Specification:** [docs/spec.md](docs/spec.md) — requirements, AC IDs,
  quality-gate commands.
- **Quality gates:** [docs/quality-gates.md](docs/quality-gates.md) — enforcement
  mechanisms, hooks, CI, and failure protocol.

## Platform

Development runs on Windows using PowerShell. CI runs on Ubuntu (`ubuntu-latest`).
All npm scripts and tooling must work cross-platform. Shell hooks must be
compatible with Git for Windows.

## Workflow

1. Read `docs/spec.md` before starting any task.
2. Propose a plan and wait for explicit approval.
3. Implement in small, focused steps — one logical change per step.
4. During implementation, address any `typecheck` or `lint` failures reported by
   the PostToolUse hook immediately before continuing.
5. Before each commit, ensure the pre-commit checks pass
   (`typecheck` + `lint` + `test`).
6. Before reporting a task complete, run `npm run check` and confirm all five
   checks pass.
7. Summarise what changed; reference AC IDs where applicable.

## Rules

- Never modify `docs/spec.md` without explicit human approval.
- Never weaken, skip, comment out, or delete tests, lint rules, or type checks to
  make a quality gate pass. Fix the root cause instead.
- Never mark a task complete while `npm run check` fails.
- Reference AC IDs in test names (e.g. `"AC-4: horizontal drag changes ry"`) and
  in commit messages where the change relates to a specific criterion.
- All project files — source, tests, config, documentation — must be written in
  English.
- Do not use `// @ts-ignore`, unconstrained `any` casts, `eslint-disable`, or
  `--no-verify` to bypass quality checks.

## Commit Message Convention

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `test`, `refactor`, `build`, `ci`, `docs`, `chore`

Examples:

- `feat(cube): render Three.js cube mesh in React canvas component`
- `feat(cube): rotate cube mesh on pointer drag (AC-4, AC-5)`
- `feat(cube): clamp X rotation to [-90, 90] degrees (AC-12)`
- `feat(cube): expose data-cube-r* rotation attributes (AC-3)`
- `feat(reset): restore initial orientation on button click (AC-9)`
- `test(unit): add rotation delta and clamp calculations (AC-12)`
- `test(e2e): add pointer drag and reset tests (AC-4, AC-5, AC-9)`
- `build: scaffold Vite + React + TypeScript project`
- `chore(eslint): add no-restricted-imports rule for OrbitControls (NFR-8)`
- `ci: add GitHub Actions workflow running npm run check`

## Quality Gate Command

```bash
npm run check
```

Full suite: `typecheck` → `lint` → `test` → `build` → `e2e`.
Run before reporting any task complete. See `docs/quality-gates.md` for details.
