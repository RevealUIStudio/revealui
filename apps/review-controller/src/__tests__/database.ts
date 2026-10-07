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
  const migrationDirectory = resolve(process.cwd(), '../../packages/db/migrations');
  for (const filename of [
    '0053_review_controller_store.sql',
    '0054_review_controller_receipt_immutable.sql',
  ]) {
    await client.exec(await readFile(resolve(migrationDirectory, filename), 'utf8'));
  }
  const db = drizzle(client, {
    schema: reviewControllerSchema,
  }) as unknown as ReviewControllerDatabase;
  return { client, db };
}
