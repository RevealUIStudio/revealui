import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import {
  type ReviewControllerDatabase,
  reviewControllerSchema,
} from '@revealui/db/review-controller';
import { drizzle } from 'drizzle-orm/pglite';

export async function createTestDatabase(): Promise<{
  client: PGlite;
  db: ReviewControllerDatabase;
}> {
  const client = new PGlite();
  await client.exec('CREATE ROLE "revealui-review-controller" WITH LOGIN');
  const migrationDirectory = resolve(process.cwd(), 'migrations');
  for (const filename of [
    '0000_review_controller_store.sql',
    '0001_review_controller_receipt_immutable.sql',
    '0003_review_observation_outcomes.sql',
    '0004_receipt_authorization_generations.sql',
    '0005_merge_intent_quarantine.sql',
  ]) {
    await client.exec(await readFile(resolve(migrationDirectory, filename), 'utf8'));
  }
  const db = drizzle(client, {
    schema: reviewControllerSchema,
  }) as unknown as ReviewControllerDatabase;
  return { client, db };
}
