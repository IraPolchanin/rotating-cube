import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('..', import.meta.url))

export function isScaffolded() {
  return (
    existsSync(resolve(projectRoot, 'package.json')) &&
    existsSync(resolve(projectRoot, 'node_modules'))
  )
}

// Returns the parsed hook input JSON, or null if stdin is empty, a TTY, or invalid.
export function readStdinJson() {
  if (process.stdin.isTTY) return null
  try {
    const raw = readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function runNpm(script) {
  const result = spawnSync('npm', ['run', script], {
    cwd: projectRoot,
    shell: true,
    encoding: 'utf8',
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

export function lastLines(text, count = 80) {
  return text.trimEnd().split('\n').slice(-count).join('\n')
}
