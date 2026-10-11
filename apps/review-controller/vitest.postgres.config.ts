import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({ include: ['src/migrations.postgres.spec.ts'] });
