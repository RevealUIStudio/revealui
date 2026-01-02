import sharedConfig from './packages/dev/src/eslint/eslint.config.js'

export default {
  ...sharedConfig,
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.vite/**',
    '**/env.d.ts',
    '**/.env',
    '**/.env.*',
    '**/framework/**',
    // Vendored Lexical files (third-party, don't lint)
    '**/src/lexical/lexical-playground/**',
    '**/src/lexical/lexical-website/**',
    '**/src/lexical/packages/**',
    '**/*.mjs',
    '**/*.cjs',
  ],
}
