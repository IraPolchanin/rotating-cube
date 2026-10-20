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

**Status: Implemented** — verified 2026-10-19 (see "Verification" below).

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

**Configured** in `.claude/settings.json`:

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

**Verification** (completed 2026-10-19):

1. Deliberately introducing a TypeScript error in a source file.
2. Confirming the hook exits with code 2 and surfaces useful diagnostics to the
   agent.
3. Fixing the error.
4. Confirming the hook exits with code 0.
5. Repeating with a lint-only error (e.g. an explicit `any`).
6. Confirming that an edit to a `.md` file or a file under `docs/` runs no check,
   that a `.json` edit does, and that input without `file_path` runs the checks.

**Results:** all six steps passed in live Claude Code edits. A type error produced
exit 2 with the `TS2322` diagnostic; a lint-only `any` produced a lint failure;
the fix passed. With a type error left in the tree, writing a `.md` file ran no
check while writing a `.json` file did. Direct runs confirmed the fail-safe for
missing `file_path`, invalid JSON and empty stdin, and the "not yet scaffolded"
skip.

---

## 2. Before Commit — Git Pre-Commit Hook

**Status: Implemented** — verified 2026-10-19 in the working copy; activation on a
fresh clone is **not verified** (see "Known gap" below).

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

### Hook script (`.githooks/pre-commit`)

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

**Results (2026-10-19):** a staged TypeScript error blocked `git commit` (exit 1,
HEAD unchanged); every later commit in Phase 2 passed through the hook
(`typecheck`, `lint`, `test`). `git ls-files --eol` reported
`i/lf w/lf attr/text eol=lf` for `.githooks/pre-commit` and the `scripts/*.mjs`
files, and `git ls-files -s` reported `100755`.

**Known gap:** items 2–3 do not replace a real fresh-checkout test. Hook activation
through `npm ci` → `prepare` on a fresh clone is **not verified**; activation is
verified only in the working copy (`npm run prepare` → `core.hooksPath=.githooks`
→ commit blocked). Optional manual check: `git clone`, `npm ci`, then attempt a
commit containing a TypeScript error.

**CI evidence (2026-10-20):** the CI run on `main` (§4) executed `npm ci` on a clean
`ubuntu-latest` runner, which also runs the `prepare` script
(`git config core.hooksPath .githooks`); both completed successfully. This confirms
only that `npm ci` and `prepare` do not fail on a clean runner. It does **not**
verify that the pre-commit hook itself runs on a fresh clone: CI performs no commit,
and the hook's effect (`core.hooksPath` set, a commit with a TypeScript error
blocked) was not checked there. Fresh-clone hook execution remains **not verified**.

---

## 3. Full Gate — Before Reporting a Task Complete

**Status: Implemented** — `package.json` scripts exist; `npm run check` was run
and passed (2026-10-19). The reviewer step is tracked in §7.

The agent must run `npm run check` and confirm all five steps pass before
reporting any implementation task as complete. This is not required after every
small edit; fast feedback during implementation is provided by the PostToolUse
hook (§1) and the pre-commit hook (§2).

For tasks that change `src/` or `e2e/`, the `spec-reviewer` subagent (§7) is
invoked once on the diff after `npm run check` passes.

---

## 4. CI — GitHub Actions

**Status: Implemented** — `.github/workflows/ci.yml` is on `main` in the public
repository `IraPolchanin/rotating-cube`; verified 2026-10-20 (see "Verification"
below).

**Scope:** runs the full `npm run check` suite on every push to any branch and on
every pull request targeting `main`.

**Trigger:**

```yaml
on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]
```

**Job `check`** (`ubuntu-latest`, `timeout-minutes: 20`, `permissions: contents: read`,
`concurrency` cancels superseded runs of the same ref):

1. `actions/checkout@v7`.
2. `actions/setup-node@v7` with `node-version-file: .nvmrc` (Node 22) and
   `cache: npm`.
3. `npm ci`
4. `npx playwright install --with-deps chromium firefox`
5. `npm run check`
6. On failure only: `actions/upload-artifact@v7` uploads `test-results/`.

**Artifact:** `.github/workflows/ci.yml`

**Not configured:** branch protection and required status checks. CI reports a
result but does not block merges or direct pushes to `main`.

### Verification

1. Green baseline: CI on `main` passes.
2. Deliberate failure: a temporary branch `ci/verify-failure` with an inverted
   assertion in `e2e/smoke.test.ts` (`toBeVisible()` → `toBeHidden()`). The change
   passes `typecheck`, `lint`, `test` and `build` locally and the pre-commit hook
   (which excludes e2e), and fails only `e2e`.
3. Restore: `git revert` of that commit (no history rewrite); CI passes again.
4. Cleanup: the local and remote `ci/verify-failure` branches were deleted.

**Results (2026-10-20):**

| Run | Ref | Result | URL |
|-----|-----|--------|-----|
| Baseline | `main` (`2805805`) | **Passed** (job `check`, 1m5s) | https://github.com/IraPolchanin/rotating-cube/actions/runs/39400495789 |
| Deliberate failure | `ci/verify-failure` (`5864fa0`) | **Failed** at `npm run check` (e2e, `expect(locator).toBeHidden() failed` in Chromium and Firefox); `test-results` artifact uploaded | https://github.com/IraPolchanin/rotating-cube/actions/runs/39402098647 |
| Restore | `ci/verify-failure` (`90e2e7d`, revert) | **Passed** | https://github.com/IraPolchanin/rotating-cube/actions/runs/39403260460 |

Locally, the same temporary change failed only the e2e step. The `pull_request`
trigger was **not** exercised (optional PR check skipped); only `push` runs were
observed.

**Notes:**

- GitHub annotated the runs: the `ubuntu-latest` label began migrating to Ubuntu 26
  on 2026-10-19. The runs above passed regardless; the runner image is not pinned.
- Action versions are pinned to major tags, not commit SHAs.

---

## 5. Agent Permission Guardrail

**Status: Implemented** — verified 2026-10-19; known gaps listed below.

Deny rules prevent the agent from bypassing the pre-commit hook with
`git commit --no-verify` (or `-n`), or from altering hook resolution through
`git -c …` / `git -C …`, which the agent has no need for when working from the
repository root.

**Configuration** (`.claude/settings.json`, same file as the hook
configuration in §1):

```json
{
  "permissions": {
    "deny": [
      "Bash(git commit --no-verify*)",
      "Bash(git commit * --no-verify*)",
      "Bash(git commit -n*)",
      "Bash(git commit * -n)",
      "Bash(git commit * -n *)",
      "Bash(git -c *)",
      "Bash(git -C *)"
    ]
  },
  "hooks": { "...": "..." }
}
```

This is an **agent-level guardrail** enforced by the Claude Code permission
system. It is not an absolute security boundary:

- A human operator can still run `git commit --no-verify` directly in the
  terminal.
- Permission matching is pattern-based, so only the forms listed in the results
  below are covered (see "Known gaps").

The guardrail covers the most likely accidental bypass path and is not intended
as an exhaustive filter.

**Verification:** each pattern is verified separately — wildcard matching is not
assumed. On a clean tracked
tree with an empty index (so even a missed block is harmless), the agent attempts:
`git commit --no-verify -m x`, `git commit -m x --no-verify`,
`git commit -n -m x`, `git commit -m x -n`, `git commit -nm x`,
`git commit -am x -n`, plus a control `git commit -m x` (must not be blocked by
the deny rules). The blocked/not-blocked result is recorded per command. A pattern
that fails to block is corrected and re-tested; remaining bypasses are documented
here as known limitations.

**Results (2026-10-19).** Each probe ran on a clean tree with an empty index. A
probe named after a pattern is a command that only that pattern can match.

| Command | Exercises | Result |
|---------|-----------|--------|
| `git commit --no-verify -m x` | `git commit --no-verify*` | blocked |
| `git commit -m x --no-verify` | `git commit * --no-verify*` | blocked |
| `git commit --amend --no-edit --no-verify` | `git commit * --no-verify*` | blocked |
| `git commit -n -m x`, `git commit -nm x` | `git commit -n*` | blocked |
| `git commit -m x -n`, `git commit -am x -n` | `git commit * -n` | blocked |
| `git commit -m x -n -q` | `git commit * -n *` | blocked |
| `git status --short && git commit --no-verify -m x` | compound command | blocked |
| `FOO=1 git commit --dry-run -n -m x` | env-var prefix | blocked |
| `git -c core.hooksPath=… status`, `… commit --dry-run -m x`, `git -c user.name=x log -1` | `git -c *` | blocked |
| `git -C . status`, `git -C . commit --dry-run -m x`, `git -C src log -1` | `git -C *` | blocked |
| `git commit -m x`, `git commit --dry-run -m x`, `git status`, `git log -1` | controls | not blocked |

Note: the `--amend` probe was a mistake in hindsight, since a missed block would have
rewritten history; later probes used `--dry-run` or read-only commands only.

### Push confirmation rule (added in Phase 4, T0)

An `ask` rule makes every `git push` require explicit human confirmation, even in
auto mode:

```json
{
  "permissions": {
    "ask": ["Bash(git push*)"]
  }
}
```

**Verification (2026-10-20):** with nothing to push, the agent ran
`git push origin main`. The permission prompt appeared (text shown to the human:
"Ask rule Bash(git push*) overrides auto mode"); the human declined it and the
command did not run. Only this one form was probed; other push forms (for example
`git push` through a global option such as `git --no-pager push`) were **not**
probed and, by the same pattern analysis as the known gaps below, are not
necessarily covered. As with the deny rules, the rule binds the agent only.

### Known gaps

- Other global options before `commit` are **not blocked**; probed and confirmed:
  `git --no-pager commit --dry-run --no-verify -m x` and
  `git --git-dir=.git commit --dry-run -n -m x` both ran.
- Not probed (by pattern analysis they are not covered): `git config core.hooksPath …`
  followed by a commit; editing or removing `.githooks/pre-commit` with the file
  tools; `GIT_*` environment variables set inside a wrapper script.
- The rules bind the agent only. A human operator can bypass the hook directly.
- Rule changes in `.claude/settings.json` took effect in the same session in which
  they were committed (observed), but this depends on the Claude Code version.

---

## 6. Stop Hook — End-of-Turn Full Check

**Status: Implemented** — verified 2026-10-19 (see "Verification criteria" below).

**Scope:** runs when the agent finishes responding. Blocks the end of the turn if
`npm run check` (typecheck, lint, test, build, e2e) fails.

### Hook script: `scripts/agent-stop-check.mjs`

1. Reads the hook input JSON from stdin (`stop_hook_active`).
2. If `package.json` or `node_modules/` is absent: exits **0** (not scaffolded).
3. Runs `git status --porcelain=v1 -z --untracked-files=all`. A change is
   **relevant** if any of its paths (both paths for renames/copies) is neither
   under `docs/` nor a `*.md` file. Staged, unstaged, untracked, deleted and
   renamed entries are all covered. If no change is relevant: exits **0**. If
   `git status` itself fails, the state is treated as relevant (fail-safe).
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

**Results (2026-10-19):**

1. The prototype confirmed that `continue: false` + `stopReason` from a Stop hook
   halts the session with a visible message.
2. The `--dry-run` matrix gave the expected decision in all 15 real git states:
   skip for an untracked `docs/*.md`, an unstaged `CLAUDE.md`, a `.md`→`.md`
   rename, a deleted `docs/*.md`, an untracked `docs/my file.md` and a clean tree;
   run for an unstaged, a staged and an untracked `.ts`, an untracked `.mjs`, a path
   with a space, a deleted tracked `.mjs`, a `.tsx`→`.tsx` rename, a `.ts`→`docs/*.md`
   rename and a `.md`→`.ts` rename (both paths of a rename are examined).
3. Direct runs: green → exit 0 (an `AGENT_STOP_CHECK_DRY_RUN=1` variable in the
   environment had no effect); red + `stop_hook_active=false` → exit 2 with the
   `TS2322` diagnostic on stderr; red + `stop_hook_active=true` → `continue:false`
   JSON, exit 0; `--dry-run` never ran the check.
4. Live: with a deliberate type error in the tree, the first end of turn was
   blocked with the diagnostic; the second end of turn halted the session with
   `npm run check is still failing after a retry; human guidance required`, and the
   agent did not continue (observed by the human operator).
5. `.claude/settings.json` contains no `--dry-run`.

---

## 7. spec-reviewer Subagent

**Status: IMPLEMENTED** — `.claude/agents/spec-reviewer.md` and the `CLAUDE.md`
Workflow step 6 rule exist, and criteria 1–4 below passed on 2026-10-19 in Claude
Code 2.1.303 (see §11).

**Troubleshooting history (2026-10-19):** in the first session the agent was not
visible (`Agent type 'spec-reviewer' not found`); the `.claude/agents/` directory
had been created during that session, which may explain why a restart was needed
(Claude Code only watches agent directories that existed at session start). A
second session still reported the agent as not found (available: `claude`,
`claude-code-guide`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`);
it is not known whether that session was a genuinely fresh process. `claude update`
was subsequently run and the agent became available. The cause is **not
established**: whether the update, the restart, or something else made the
agent visible was not isolated, so no installation mismatch is claimed.

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
| PostToolUse hook script | `scripts/agent-hook-check.mjs` + `scripts/hook-utils.mjs` | **Implemented** |
| Stop hook script | `scripts/agent-stop-check.mjs` | **Implemented** |
| PostToolUse + Stop hooks + permission guardrail | `.claude/settings.json` | **Implemented** |
| `git push` confirmation (`ask` rule) | `.claude/settings.json` | **Implemented** — verified 2026-10-20 (one form probed) |
| spec-reviewer subagent | `.claude/agents/spec-reviewer.md` | **Implemented** |
| LF line endings for hooks and scripts | `.gitattributes` | **Implemented** |
| ESLint block for `scripts/*.mjs` | `eslint.config.js` | **Implemented** |
| ESLint flat config + `no-restricted-imports` | `eslint.config.js` | **Implemented** |
| TypeScript strict config | `tsconfig.json` | **Implemented** |
| Vitest config | `vitest.config.ts` | **Implemented** |
| Playwright config + `webServer` | `playwright.config.ts` | **Implemented** |
| Pre-commit hook script | `.githooks/pre-commit` | **Implemented** — fresh-clone activation unverified |
| GitHub Actions CI workflow | `.github/workflows/ci.yml` | **Implemented** — verified 2026-10-20; no branch protection |
| MIT license | `LICENSE` | **Implemented** |
| Application (AC-1 – AC-15) | `src/`, `e2e/`, evidence in `docs/evidence/phase-4.md` | **Implemented** — automated checks verified locally 2026-10-20; manual checks partly done (Chrome only), see "Phase 4 manual checks" |

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
| Guardrail patterns | Seven deny patterns (§5): five `git commit` forms plus `git -c *` and `git -C *`; each verified separately |
| Repository | Public `IraPolchanin/rotating-cube`, default branch `main`; created and pushed only after separate explicit confirmations |
| Commit email | The corporate commit email stays in the public history; history was not rewritten (decision of the repository owner) |
| Session transcripts | `docs/sessions/*.txt` stay public as evidence that the source code was agent-written |
| CI job | Single job `check` running `npm run check`, so local and CI gates are identical |
| CI browsers | `playwright install --with-deps chromium firefox` (NFR-5 requires only these two; WebKit is skipped) |
| CI Node version | `node-version-file: .nvmrc`, one source of truth |
| CI action versions | `checkout@v7`, `setup-node@v7`, `upload-artifact@v7` (latest majors on 2026-10-20, verified from the official `actions/*` releases); major tags, not SHAs |
| CI failure experiment | Done on a throwaway branch with an e2e-only failure (the pre-commit hook blocks type, lint and unit failures and `--no-verify` is denied); branch deleted afterwards |
| Branch protection | Not enabled; required status checks are a possible later step |
| License | MIT, added before publication; README is a separate later task |

---

## 11. Verification Record

Status of the practical verification of each mechanism (details in the section
named in the first column). Open items:

| Item | Verification | Result |
|------|--------------|---------------------|
| PostToolUse hook (§1) | Type error → exit 2 + diagnostics; fix → exit 0; lint-only error; `.md` edit runs no check; `.json` edit runs; missing `file_path` runs | **Passed** (2026-10-19) |
| Pre-commit hook (§2) | Staged type error blocks commit; later commits pass; `git ls-files --eol` LF; `git ls-files -s` `100755` | **Passed** (2026-10-19). Open: hook execution on a fresh clone **not verified**. CI shows only that `npm ci` and `prepare` complete on a clean runner (§2) |
| Permission guardrail (§5) | Each pattern probed separately; controls not blocked | **Passed** (2026-10-19). Open: known gaps listed in §5 (other global git options, `git config core.hooksPath`, hook-file edits) |
| Application, Phase 4 | `npm run check` on a clean tree (20 unit tests, 40 e2e in Chromium + Firefox); per-task `spec-reviewer`; mutation checks: disabling `setPointerCapture` fails AC-14, `touch-action: auto` fails AC-15, removing the X clamp fails AC-12 (unit and e2e) | **Passed locally** (2026-10-20), details in `docs/evidence/phase-4.md`. Manual checks of spec §7.3 are in "Phase 4 manual checks" below. Open: Firefox desktop and a real touch device **not checked**; AC-6/AC-7 use simulated touch only |
| Push confirmation (§5) | `git push origin main` with nothing to push; prompt expected, human declines | **Passed** (2026-10-20): prompt "Ask rule Bash(git push*) overrides auto mode" appeared and was declined. Open: other push forms not probed |
| Stop hook (§6) | Prototype; dry-run matrix; direct runs; live block and halt; no `--dry-run` in settings | **Passed** (2026-10-19) |
| ESLint block for `scripts/*.mjs` | `--print-config` shows Node globals; seeded errors fail `npm run lint` | **Passed** (2026-10-19) |
| spec-reviewer (§7) | Clean diff clean; camera rotation / OrbitControls flagged; edit attempt impossible; agent visible | **Passed** (2026-10-19, Claude Code 2.1.303). Criterion 1: clean `src/` diff (`App.tsx`, `main.tsx`, `vite-env.d.ts`) → `No violations found.` Criterion 2: temporary `src/__probe__.tsx` (OrbitControls import/re-export, `camera.rotation.y`) → flagged as NFR-8 ×2 and spec §7.5; file removed afterwards. Criterion 3: asked to edit a file, the agent reported only `Read`/`Grep`/`Glob` and the file stayed unchanged. Criterion 4: agent invocable in the session. Earlier invisibility: agents directory was created in the first session (may explain the restart); `claude update` was run later and the agent became available — causal link **not established** |
| CI (§4) | Green baseline on `main`; deliberate e2e-only failure on a temporary branch; `git revert` restores green; temporary branch deleted | **Passed** (2026-10-20, three runs listed in §4). Open: `pull_request` trigger not exercised; no branch protection |

---

## 12. Phase 4 manual checks

Spec §7.3 checks, performed by the human on `localhost` (dev server), reported on
2026-10-20. The agent did not perform or observe these; they are recorded as reported.

| Check | Environment | Result |
|-------|-------------|--------|
| Cube renders correctly (FR-1) | Chrome desktop | **Passed** |
| Rotation is smooth (FR-2) | Chrome desktop | **Passed** |
| X rotation stays within ±90° (AC-12) | Chrome desktop | **Passed** |
| Reset works (FR-5) | Chrome desktop | **Passed** |
| Canvas fills the window, follows resize, no scrollbars (FR-6) | Chrome desktop | **Passed** |
| Touch drag rotates the cube; mobile width works (FR-3) | Chrome DevTools device emulation | **Passed** (emulated touch, not a physical device) |
| Same checks | Firefox desktop | **Not checked** |
| Physical touch device (FR-3) | Real device | **Not checked** — the corporate network blocks LAN access; planned after deployment to GitHub Pages |

NFR-7 (latest stable Chrome and Firefox) is therefore verified manually for Chrome
only; Firefox is covered only by the automated Playwright run (its bundled Firefox).
