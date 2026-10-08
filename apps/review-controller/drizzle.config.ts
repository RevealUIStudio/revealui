import { defineConfig } from 'drizzle-kit';

const migrationUrl = process.env.REVIEW_CONTROLLER_MIGRATION_DATABASE_URL ?? '';
if (!migrationUrl) {
  process.stderr.write(
    'REVIEW_CONTROLLER_MIGRATION_DATABASE_URL is required to migrate the controller database.\n',
  );
}

export default defineConfig({
  schema: '../../packages/db/dist/schema/internal/review-controller.js',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: migrationUrl },
  verbose: true,
  strict: true,
});
