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

A cross-platform Node.js ESM script (shared helpers in `scripts/hook-utils.mjs`)
with the following behaviour:

1. Reads the hook input JSON from stdin and extracts `tool_input.file_path`.
   - If the extension is not one of `.ts`, `.tsx`, `.js`, `.mjs`, `.json`: exits
     with code **0** without running any check, so documentation-only edits never
     trigger checks.
   - If `file_path` is missing or the input cannot be parsed: fail-safe — the
     checks run.
2. Checks whether `package.json` and `node_modules/` exist in the project root.
   - If either is absent: prints
     `[hook] Skipping checks — project not yet scaffolded.` to stdout and exits
     with code **0**, so project scaffolding is not blocked.
3. Once both exist: runs `npm run typecheck` and `npm run lint` as child
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
            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/agent-hook-check.mjs\"",
            "timeout": 120
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
5. Repeating with a lint-only error (e.g. an explicit `any`).
6. Confirming that an edit to a `.md` file or a file under `docs/` runs no check,
   that a `.json` edit does, and that input without `file_path` runs the checks.

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
- `.gitattributes` forces LF line endings for `.githooks/*` and `scripts/*`
  (`text eol=lf`), so a CRLF checkout (e.g. `core.autocrlf=true` on Windows)
  cannot break the shebang line.

### Verification criteria

1. A staged TypeScript error blocks `git commit`; after the fix the commit passes.
2. `git ls-files --eol .githooks/pre-commit` reports `i/lf w/lf attr/text eol=lf`.
3. `git ls-files -s .githooks/pre-commit` reports mode `100755`.

**Known gap:** items 2–3 do not replace a real fresh-checkout test. Hook activation
through `npm ci` → `prepare` on a fresh clone is **not verified**; activation is
verified only in the working copy (`npm run prepare` → `core.hooksPath=.githooks`
→ commit blocked). Optional manual check: `git clone`, `npm ci`, then attempt a
commit containing a TypeScript error.

---

## 3. Full Gate — Before Reporting a Task Complete

**Status: PLANNED** — requires `package.json` scripts (not yet created).

The agent must run `npm run check` and confirm all five steps pass before
reporting any implementation task as complete. This is not required after every
small edit; fast feedback during implementation is provided by the PostToolUse
hook (§1) and the pre-commit hook (§2).

For tasks that change `src/` or `e2e/`, the `spec-reviewer` subagent (§7) is
invoked once on the diff after `npm run check` passes.

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
    "deny": [
      "Bash(git commit --no-verify*)",
      "Bash(git commit * --no-verify*)",
      "Bash(git commit -n*)",
      "Bash(git commit * -n)",
      "Bash(git commit * -n *)"
    ]
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

**Verification:** once `.claude/settings.json` is created with these rules, verify
each pattern separately — wildcard matching is not assumed. On a clean tracked
tree with an empty index (so even a missed block is harmless), the agent attempts:
`git commit --no-verify -m x`, `git commit -m x --no-verify`,
`git commit -n -m x`, `git commit -m x -n`, `git commit -nm x`,
`git commit -am x -n`, plus a control `git commit -m x` (must not be blocked by
the deny rules). The blocked/not-blocked result is recorded per command. A pattern
that fails to block is corrected and re-tested; remaining bypasses (for example
`git -c core.hooksPath=… commit`, or compound commands such as
`a && git commit --no-verify`) are documented here as known limitations.

---

## 6. Stop Hook — End-of-Turn Full Check

**Status: PLANNED** — `scripts/agent-stop-check.mjs` and its `.claude/settings.json`
entry do not yet exist.

**Scope:** runs when the agent finishes responding. Blocks the end of the turn if
`npm run check` (typecheck, lint, test, build, e2e) fails.

### Hook script: `scripts/agent-stop-check.mjs`

1. Reads the hook input JSON from stdin (`stop_hook_active`).
2. If `package.json` or `node_modules/` is absent: exits **0** (not scaffolded).
3. Runs `git status --porcelain=v1 -z --untracked-files=all`. A change is
   **relevant** if any of its paths (both paths for renames/copies) is neither
   under `docs/` nor a `*.md` file. Staged, unstaged, untracked, deleted and
   renamed entries are all covered. If no change is relevant: exits **0**.
4. Otherwise runs the real `npm run check`.
   - Pass: exits **0**.
   - Fail with `stop_hook_active=false`: writes diagnostics (tail of the failing
     step output) to **stderr** and exits **2**; the agent must fix the root cause.
   - Fail with `stop_hook_active=true` (the failure persisted after a fix
     attempt): prints `{"continue": false, "stopReason": "..."}` and exits **0**.
     The session halts with a visible message for the human (Failure Protocol,
     step 7).

**Loop prevention without silent success:** exit 2 on every failure would loop
forever; exit 0 on `stop_hook_active` would let the task finish with a red check.
Stopping loudly with an explanation avoids both, and needs no state between runs.
The tree stays modified, so the next turn runs the check again.

**Dry-run (manual testing only):** `node scripts/agent-stop-check.mjs --dry-run`
prints the filter decision (run/skip and why) and exits **0** without running the
check. It is a command-line flag only — no environment variable enables it — and
the configured hook command never passes it.

### Trade-off

After a commit the tree is clean, so the Stop hook does **not** run `check`.
Committed code has already passed `typecheck` + `lint` + `test` in the pre-commit
hook; `build` and `e2e` for committed code are guaranteed only by CI (Phase 3) and
by the `npm run check` rule in `CLAUDE.md`. The Stop hook is a safety net for
**uncommitted** changes, not a guarantee that e2e runs every turn. The cost of the
alternative (a state file or fingerprint) was judged higher than this gap.

### Configuration (`.claude/settings.json`)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/agent-stop-check.mjs\"",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

### Verification criteria

1. Prototype first: confirm that `continue: false` + `stopReason` from a Stop hook
   halts the session with a visible message.
2. With `--dry-run`, check the filter on real git states: clean tree → skip;
   only `docs/x.md` or `CLAUDE.md` changed → skip; staged, unstaged and untracked
   `.ts`/`.mjs` → run; deleted `.ts` → run; `.ts`→`.ts` rename → run;
   `.ts`→`.md` and `.md`→`.ts` renames → run; a path containing a space → handled.
3. Direct runs with stdin input (real check): green → 0; red with
   `stop_hook_active=false` → 2 with diagnostics; red with `stop_hook_active=true`
   → `continue:false` JSON, exit 0.
4. Live run: end a turn with a deliberate TypeScript error → the turn is blocked;
   leave it unfixed → the next stop halts the session with `stopReason`; fix it →
   the stop passes.
5. The hook command in `.claude/settings.json` contains no `--dry-run`.

---

## 7. spec-reviewer Subagent

**Status: PLANNED** — `.claude/agents/spec-reviewer.md` does not yet exist.

A read-only subagent that compares a diff against the acceptance criteria in
`docs/spec.md` and the rules in `CLAUDE.md`. It covers controls that tooling
cannot enforce (spec §7.5: "Cube mesh rotates (not camera) — agent instruction +
code review").

- **Tools:** `Read`, `Grep`, `Glob` only — no `Bash`, `Edit` or `Write`, so it
  cannot modify the repository. The invoking agent passes the changed file list and
  the diff in the prompt.
- **Checks:** mesh (not camera) rotation, no OrbitControls, AC IDs in test names,
  English-only project files, behaviour matching the relevant AC.
- **Output:** findings as `file:line — violation — AC/rule`; advisory only.

### Invocation policy

`CLAUDE.md` otherwise restricts subagents to explicit user requests. The rule in
`CLAUDE.md` Workflow step 6 is the user's standing authorization for this
subagent only: after `npm run check` passes, if the task changed `src/` or `e2e/`,
invoke `spec-reviewer` once on the diff; fix or report each finding. A second
invocation is allowed only after substantial fixes. For documentation- or
tooling-only tasks it is used on request. The review does not replace `check`.

### Verification criteria

1. A clean diff produces no findings.
2. A temporary file that rotates the camera or imports OrbitControls is flagged.
3. Asked to edit a file, the subagent cannot (no write tools).
4. The subagent is visible to the session (a new session may be required).

---

## 8. Failure Protocol

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

## 9. Implementation Status

| Mechanism | Artifact | Status |
|-----------|----------|--------|
| Specification | `docs/spec.md` | **Implemented** |
| Agent workflow rules | `CLAUDE.md` | **Implemented** |
| Quality gate definitions | `docs/quality-gates.md` | **Implemented** |
| Node.js version pin | `.nvmrc` | **Implemented** |
| `package.json` scripts + `prepare` | `package.json` | **Implemented** |
| PostToolUse hook script | `scripts/agent-hook-check.mjs` + `scripts/hook-utils.mjs` | **Planned** |
| Stop hook script | `scripts/agent-stop-check.mjs` | **Planned** |
| PostToolUse + Stop hooks + permission guardrail | `.claude/settings.json` | **Planned** |
| spec-reviewer subagent | `.claude/agents/spec-reviewer.md` | **Planned** |
| LF line endings for hooks and scripts | `.gitattributes` | **Planned** |
| ESLint block for `scripts/*.mjs` | `eslint.config.js` | **Planned** |
| ESLint flat config + `no-restricted-imports` | `eslint.config.js` | **Implemented** |
| TypeScript strict config | `tsconfig.json` | **Implemented** |
| Vitest config | `vitest.config.ts` | **Implemented** |
| Playwright config + `webServer` | `playwright.config.ts` | **Implemented** |
| Pre-commit hook script | `.githooks/pre-commit` | **Planned** |
| GitHub Actions CI workflow | `.github/workflows/ci.yml` | **Planned** |

---

## 10. Resolved Decisions

| Decision | Resolution |
|----------|------------|
| Node.js version | Major version 22, pinned in `.nvmrc` |
| ESLint config format | Flat config in `eslint.config.js` (ESLint ≥ 9) |
| Pre-commit mechanism | `.githooks/pre-commit` + `core.hooksPath`, no Husky |
| Default branch | `main` |
| CI runner | `ubuntu-latest` |
| PostToolUse hook matcher | `Edit\|Write` (`MultiEdit` not supported in the Claude Code version used at project setup) |
| PostToolUse file filter | Only `.ts`, `.tsx`, `.js`, `.mjs`, `.json` edits run checks; missing `file_path` fails safe (checks run) |
| Stop hook scope | Full `npm run check`, only when `git status` shows relevant changes outside `docs/` and `*.md`; no state file |
| Stop hook repeated failure | `stop_hook_active=true` + failing check → `continue:false` with `stopReason`; never a silent pass |
| Stop hook dry-run | `--dry-run` CLI flag for manual testing only; no env var; never used by the configured hook |
| spec-reviewer invocation | Standing authorization in `CLAUDE.md` for this subagent only, for tasks changing `src/` or `e2e/` |
| Guardrail patterns | Five `git commit` deny patterns (§5), each verified separately |

---

## 11. Verification Required After Implementation

These items are in a defined state but require post-implementation testing before
they can be marked as implemented:

| Item | Verification steps |
|------|-------------------|
| PostToolUse hook (§1) | Introduce a deliberate TypeScript error; confirm hook exits with code 2 and surfaces diagnostics; fix the error; confirm hook exits with code 0. Also lint-only error, docs-only edit (no check), `.json` edit (check), missing `file_path` (check). |
| Pre-commit hook (§2) | Staged TypeScript error blocks `git commit`; fix passes. `git ls-files --eol` shows LF, `git ls-files -s` shows `100755`. Fresh-clone activation via `npm ci` is a known unverified gap. |
| Permission guardrail (§5) | Attempt each deny-pattern variant separately through the agent; record blocked/not blocked per command; document remaining bypasses. |
| Stop hook (§6) | Prototype `continue:false`; `--dry-run` filter matrix; direct runs with `stop_hook_active` true/false; live blocked turn and halt; confirm no `--dry-run` in settings. |
| spec-reviewer (§7) | Clean diff has no findings; camera rotation / OrbitControls flagged; edit attempt impossible; agent visible to the session. |
