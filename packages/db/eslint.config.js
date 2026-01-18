import sharedConfig from 'dev/eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/drizzle.config.*.ts', // Drizzle config files not in tsconfig
    ],
  },
  ...sharedConfig,
]
