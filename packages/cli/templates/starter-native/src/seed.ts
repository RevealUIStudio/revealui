/**
 * Database seed script
 *
 * Run with: pnpm db:seed
 *
 * Customize this file to populate your database with initial data.
 * The examples below show common patterns  -  uncomment and adapt as needed.
 */

// import { getClient } from '@revealui/db/client';
// import { users, posts } from '@revealui/db/schema';

async function seed(): Promise<void> {
  // const db = getClient();

  // Example: create an admin user
  // await db.insert(users).values({
  //   id: crypto.randomUUID(),
  //   email: 'admin@example.com',
  //   name: 'Admin',
  //   role: 'admin',
  //   status: 'active',
  //   emailVerified: true,
  // });

  // Example: create sample content
  // await db.insert(posts).values({
  //   id: crypto.randomUUID(),
  //   title: 'Welcome to RevealUI',
  //   slug: 'welcome',
  //   status: 'published',
  // });

  process.stdout.write('Seed complete.\n');
}

seed().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${error}\n`);
  process.exit(1);
});
