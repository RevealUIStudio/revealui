/**
 * dev-focus: Start dev watchers only for the target package/app and its dependencies.
 *
 * Usage:
 *   pnpm dev:focus cms          # Start CMS + all transitive deps
 *   pnpm dev:focus api          # Start API + all transitive deps
 *   pnpm dev:focus core         # Start core + its deps only
 *   pnpm dev:focus cms api      # Start both apps + shared deps
 *
 * Supports both short names (cms, api, core) and full names (@revealui/core).
 * Passes --filter=...target to turbo so transitive dependencies are included.
 */

import { execFileSync } from 'node:child_process'

const targets = process.argv.slice(2)

if (targets.length === 0) {
  console.error(
    'Usage: pnpm dev:focus <package|app> [...more]\n\n' +
      'Examples:\n' +
      '  pnpm dev:focus cms           # CMS + all deps\n' +
      '  pnpm dev:focus api           # API + all deps\n' +
      '  pnpm dev:focus core          # core + its deps\n' +
      '  pnpm dev:focus cms api       # Both apps + shared deps\n' +
      '  pnpm dev:focus presentation  # UI components only (no deps)\n',
  )
  process.exit(1)
}

// Build turbo filter flags: ...name includes transitive deps
const filterFlags = targets.flatMap((target) => {
  // Normalize: "cms" → "cms", "@revealui/core" → "@revealui/core"
  const name = target.startsWith('@') ? target : target
  // ...name syntax tells turbo to include the package AND all its dependencies
  return ['--filter', `...${name}`]
})

const args = ['turbo', 'run', 'dev', '--parallel', ...filterFlags]

console.log(`Starting focused dev: ${targets.join(', ')}`)
console.log(`Running: pnpm ${args.join(' ')}\n`)

try {
  execFileSync('pnpm', args, {
    stdio: 'inherit',
    cwd: new URL('../../', import.meta.url).pathname,
  })
} catch {
  // turbo killed by signal (Ctrl+C) — exit cleanly
  process.exit(0)
}
