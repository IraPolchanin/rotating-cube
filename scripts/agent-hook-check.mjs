import { extname } from 'node:path'
import { isScaffolded, lastLines, readStdinJson, runNpm } from './hook-utils.mjs'

const CHECKED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json'])

// A missing or unparsable file_path falls through to the checks (fail-safe).
const filePath = readStdinJson()?.tool_input?.file_path
if (
  typeof filePath === 'string' &&
  !CHECKED_EXTENSIONS.has(extname(filePath).toLowerCase())
) {
  console.log('[hook] Skipping checks — not a code or config file.')
  process.exit(0)
}

if (!isScaffolded()) {
  console.log('[hook] Skipping checks — project not yet scaffolded.')
  process.exit(0)
}

let failed = false
for (const script of ['typecheck', 'lint']) {
  const { ok, output } = runNpm(script)
  if (!ok) {
    failed = true
    console.error(`[hook] npm run ${script} failed:\n${lastLines(output)}\n`)
  }
}
if (!failed) console.log('[hook] typecheck and lint passed.')
process.exit(failed ? 2 : 0)
