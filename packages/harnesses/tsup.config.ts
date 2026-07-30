import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/workboard/index.ts',
    'src/types/index.ts',
    'src/content/index.ts',
    'src/manager/index.ts',
    'src/hooks/index.ts',
    'src/hotfix/index.ts',
    'src/gates/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
});
