/**
 * Devbox configuration generator
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export async function generateDevbox(projectPath: string): Promise<void> {
  const devboxConfig = {
    packages: ['nodejs@24.12.0', 'pnpm@10.28.2', 'postgresql@16', 'stripe-cli@latest'],
    shell: {
      init_hook: [
        'corepack enable',
        'echo "🚀 RevealUI Devbox shell ready!"',
        'echo "Run: pnpm dev to start development"',
      ],
      scripts: {
        dev: 'pnpm dev',
        setup: 'pnpm install && pnpm db:init',
        test: 'pnpm test',
      },
    },
    env: {
      NODE_ENV: 'development',
    },
  }

  await fs.writeFile(
    path.join(projectPath, 'devbox.json'),
    JSON.stringify(devboxConfig, null, 2),
    'utf-8',
  )
}
