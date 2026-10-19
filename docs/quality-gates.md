# Quality Gates

> This document describes WHEN and HOW checks are enforced, their implementation
> status, and what the agent must do when a check fails.
> For WHAT each check validates — requirements, AC IDs, and script commands —
> see [docs/spec.md §7](docs/spec.md) (Verification Strategy).

---

## Checks

Script commands are defined in `docs/spec.md §7.4`.

| Script      | Validates                                            | Speed    |
|-------------|------------------------------------------------------|----------|
| `typecheck` | NFR-1, NFR-2                                         | Fast     |
| `lint`      | NFR-3, NFR-8                                         | Fast     |
| `test`      | Unit logic for AC-4 – AC-7, AC-9, AC-12 (spec §7.1) | Fast     |
| `build`     | NFR-6                                                | Moderate |
| `e2e`       | AC-1 through AC-15, Chromium + Firefox               | Slow     |
| `check`     | All of the above in sequence                         | Slow     |

---

## 1. After Each File Edit — Claude Code PostToolUse Hook

**Status: PLANNED** — `scripts/agent-hook-check.mjs`, `.claude/settings.json`,
and `package.json` scripts do not yet exist.

**Scope:** runs automatically after every `Edit` or `Write` tool call by the agent.

**Checks:** `typecheck` + `lint` only. Faster checks provide immediate feedback;
`test`, `build`, and `e2e` are deferred to pre-commit and CI.

### Hook script: `scripts/agent-hook-check.mjs`

A cross-platform Node.js ESM script with the following behaviour:

1. Checks whether `package.json` and `node_modules/` exist in the project root.
   - If either is absent: prints
     `[hook] Skipping checks — project not yet scaffolded.` to stdout and exits
     with code **0**, so project scaffolding is not blocked.
2. Once both exist: runs `npm run typecheck` and `npm run lint` as child
   processes, captures their output, writes any failure diagnostics to **stderr**,
   and exits with code **2** if either check fails.

Exiting with code 2 causes Claude Code to surface the error output as blocking
diagnostic feedback. The hook provides feedback only — it does not automatically
fix issues. The agent must read the error output and resolve the root cause before
continuing with the next edit.

### Hook configuration

**Planned** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/agent-hook-check.mjs"
          }
        ]
      }
    ]
  }
}
```

**Note on matcher:** `Edit|MultiEdit|Write` was considered, but `MultiEdit` is not
a supported tool name in the Claude Code version used at project setup (available
file-writing tools are `Edit` and `Write`). The matcher `Edit|Write` covers all
file-modifying tool calls. If a `MultiEdit` tool is introduced in a later version,
the matcher should be updated.

**Verification plan (after implementation):** once `.claude/settings.json` and
`scripts/agent-hook-check.mjs` are created, verify by:

1. Deliberately introducing a TypeScript error in a source file.
2. Confirming the hook exits with code 2 and surfaces useful diagnostics to the
   agent.
3. Fixing the error.
4. Confirming the hook exits with code 0.

The hook remains marked **PLANNED** until this verification has been completed.

---

## 2. Before Commit — Git Pre-Commit Hook

**Status: PLANNED** — `.githooks/` does not yet exist; `.git/hooks/` contains
only sample files.

**Scope:** blocks `git commit` if any check fails.

**Checks:** `typecheck` + `lint` + `test` (unit tests). Production build and E2E
are excluded; they run in CI.

### Activation

The hook directory is registered once via the `prepare` lifecycle script in
`package.json`:

```json
"prepare": "git config core.hooksPath .githooks"
```

`npm install` and `npm ci` both execute `prepare` automatically. This keeps the
hook directory version-controlled and requires no third-party tool.

### Planned hook script (`.githooks/pre-commit`)

```sh
#!/bin/sh
npm run typecheck && npm run lint && npm run test
```

### Windows / Git for Windows compatibility

- `#!/bin/sh` is resolved by Git for Windows to `sh.exe` from the Git
  installation; the same shebang works on Linux and macOS.
- `&&` is standard POSIX sh, supported by Git for Windows sh.
- `npm` must be on the system PATH, which it is after a standard Node.js install.
- The executable bit must be set and tracked in Git:
  `git add --chmod=+x .githooks/pre-commit`

---

## 3. Full Gate — Before Reporting a Task Complete

**Status: PLANNED** — requires `package.json` scripts (not yet created).

The agent must run `npm run check` and confirm all five steps pass before
reporting any implementation task as complete. This is not required after every
small edit; fast feedback during implementation is provided by the PostToolUse
hook (§1) and the pre-commit hook (§2).

---

## 4. CI — GitHub Actions

**Status: PLANNED** — no `.github/` directory or workflow files exist yet.

**Scope:** runs the full `npm run check` suite on every push to any branch and on
every pull request targeting `main`.

**Planned trigger:**

```yaml
on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]
```

**Planned steps:**

1. Checkout repository.
2. Set up Node.js 22 (matches `.nvmrc`).
3. `npm ci`
4. `npx playwright install --with-deps` (installs Chromium and Firefox).
5. `npm run check`

**Runner:** `ubuntu-latest`  
**Planned artifact:** `.github/workflows/ci.yml`

---

## 5. Agent Permission Guardrail

**Status: PLANNED** — `.claude/settings.json` does not yet exist.

A deny rule prevents the agent from bypassing the pre-commit hook with
`git commit --no-verify`.

**Planned configuration** (`.claude/settings.json`, same file as the hook
configuration in §1):

```json
{
  "permissions": {
    "deny": ["Bash(git commit --no-verify*)"]
  },
  "hooks": { "...": "..." }
}
```

This is an **agent-level guardrail** enforced by the Claude Code permission
system. It is not an absolute security boundary:

- A human operator can still run `git commit --no-verify` directly in the
  terminal.
- Prefix-based permission matching may not block argument-order variants such as
  `git commit -m "message" --no-verify` or the short flag `git commit -n`.

The guardrail covers the most likely accidental bypass path and is not intended
as an exhaustive filter.

**Verification:** once `.claude/settings.json` is created with this rule, verify
by having the agent attempt `Bash(git commit --no-verify ...)` and confirming
the tool call is blocked by Claude Code.

---

## 6. Failure Protocol

When any check fails, the agent must:

1. Read the full error output before attempting a fix.
2. Identify the root cause.
3. Fix the root cause in the smallest targeted change possible.
4. Never suppress errors with `// @ts-ignore`, unconstrained `any` casts,
   `eslint-disable`, or `--no-verify`.
5. Re-run the failing check to confirm the fix.
6. Run `npm run check` in full before reporting the task complete.
7. If the failure cannot be resolved, report the exact error output to the human
   and wait for guidance before continuing.

---

## 7. Implementation Status

| Mechanism | Artifact | Status |
|-----------|----------|--------|
| Specification | `docs/spec.md` | **Implemented** |
| Agent workflow rules | `CLAUDE.md` | **Implemented** |
| Quality gate definitions | `docs/quality-gates.md` | **Implemented** |
| Node.js version pin | `.nvmrc` | **Implemented** |
| `package.json` scripts + `prepare` | `package.json` | **Implemented** |
| PostToolUse hook script | `scripts/agent-hook-check.mjs` | **Planned** |
| PostToolUse hook + permission guardrail | `.claude/settings.json` | **Planned** |
| ESLint flat config + `no-restricted-imports` | `eslint.config.js` | **Implemented** |
| TypeScript strict config | `tsconfig.json` | **Implemented** |
| Vitest config | `vitest.config.ts` | **Implemented** |
| Playwright config + `webServer` | `playwright.config.ts` | **Implemented** |
| Pre-commit hook script | `.githooks/pre-commit` | **Planned** |
| GitHub Actions CI workflow | `.github/workflows/ci.yml` | **Planned** |

---

## 8. Resolved Decisions

| Decision | Resolution |
|----------|------------|
| Node.js version | Major version 22, pinned in `.nvmrc` |
| ESLint config format | Flat config in `eslint.config.js` (ESLint ≥ 9) |
| Pre-commit mechanism | `.githooks/pre-commit` + `core.hooksPath`, no Husky |
| Default branch | `main` |
| CI runner | `ubuntu-latest` |
| PostToolUse hook matcher | `Edit\|Write` (`MultiEdit` not supported in the Claude Code version used at project setup) |

---

## 9. Verification Required After Implementation

These items are in a defined state but require post-implementation testing before
they can be marked as implemented:

| Item | Verification steps |
|------|-------------------|
| PostToolUse hook (§1) | Introduce a deliberate TypeScript error; confirm hook exits with code 2 and surfaces diagnostics; fix the error; confirm hook exits with code 0. |
| Permission guardrail (§5) | Attempt `Bash(git commit --no-verify ...)` through the agent; confirm the tool call is blocked by Claude Code. |
