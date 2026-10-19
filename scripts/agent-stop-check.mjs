import { spawnSync } from 'node:child_process'
import { isScaffolded, lastLines, projectRoot, readStdinJson, runNpm } from './hook-utils.mjs'

// --dry-run is for manual testing only: it prints the decision and never runs the check.
// It is read from the command line alone; the configured hook never passes it.
const dryRun = process.argv.includes('--dry-run')

function isRelevant(path) {
  const normalized = path.replaceAll('\\', '/')
  return !normalized.startsWith('docs/') && !normalized.toLowerCase().endsWith('.md')
}

// Parses `git status --porcelain=v1 -z` output into every affected path.
// Renames and copies (R/C) carry a second token holding the original path.
function changedPaths(porcelain) {
  const tokens = porcelain.split('\0').filter(Boolean)
  const paths = []
  for (let i = 0; i < tokens.length; i++) {
    const status = tokens[i].slice(0, 2)
    paths.push(tokens[i].slice(3))
    if (status.includes('R') || status.includes('C')) paths.push(tokens[++i])
  }
  return paths
}

function relevantChanges() {
  const result = spawnSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: projectRoot, encoding: 'utf8' },
  )
  // Fail-safe: if git status itself fails, treat the state as relevant.
  if (result.status !== 0) return ['(git status failed)']
  return changedPaths(result.stdout).filter(isRelevant)
}

function decide() {
  if (!isScaffolded()) return { run: false, reason: 'project not yet scaffolded' }
  const relevant = relevantChanges()
  if (relevant.length === 0) {
    return { run: false, reason: 'no relevant changes outside docs/ and *.md' }
  }
  return { run: true, reason: `relevant changes: ${relevant.join(', ')}` }
}

const decision = decide()
if (!decision.run) {
  console.log(`[stop-hook] Skipping check — ${decision.reason}.`)
  process.exit(0)
}
if (dryRun) {
  console.log(`[stop-hook] Dry run — would run npm run check (${decision.reason}).`)
  process.exit(0)
}

const stopHookActive = readStdinJson()?.stop_hook_active === true
const { ok, output } = runNpm('check')
if (ok) {
  console.log('[stop-hook] npm run check passed.')
  process.exit(0)
}

if (!stopHookActive) {
  // First failure: block the stop so the agent fixes the root cause.
  console.error(`[stop-hook] npm run check failed:\n${lastLines(output)}`)
  process.exit(2)
}

// The failure persisted after a fix attempt: halt loudly instead of looping or passing silently.
console.log(
  JSON.stringify({
    continue: false,
    stopReason: `npm run check is still failing after a retry; human guidance required.\n${lastLines(output, 40)}`,
  }),
)
process.exit(0)
