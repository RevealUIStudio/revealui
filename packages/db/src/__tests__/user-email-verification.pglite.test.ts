import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../client/index.js';
import { getUserByVerificationToken, updateUser } from '../queries/users.js';
import { users } from '../schema/users.js';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
let db: Database;
beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.drizzle as unknown as Database;
});
afterAll(async () => {
  await testDb.close();
});

async function seed(id: string, verified = true) {
  await testDb.drizzle.insert(users).values({
    id,
    name: 'Email owner',
    email: `${id}@example.com`,
    emailVerified: verified,
    emailVerifiedAt: verified ? new Date() : null,
    emailVerificationToken: `token-${id}`,
    emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
  });
}

describe('email verification belongs to the current address', () => {
  it('clears old proof and tokens even if a generic email update also supplies verified=true', async () => {
    await seed('changed-email');
    const updated = await updateUser(db, 'changed-email', {
      email: 'buyer@example.com',
      emailVerified: true,
    });
    expect(updated).toMatchObject({
      email: 'buyer@example.com',
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    });
    expect(await getUserByVerificationToken(db, 'token-changed-email')).toBeNull();
  });

  it('preserves verified proof when the email is unchanged', async () => {
    await seed('same-email');
    expect(
      await updateUser(db, 'same-email', { email: 'same-email@example.com', name: 'Updated' }),
    ).toMatchObject({ emailVerified: true });
  });

  it('cannot consume a token read before an email change', async () => {
    await seed('racing-email', false);
    expect(await getUserByVerificationToken(db, 'token-racing-email')).toMatchObject({
      id: 'racing-email',
    });
    await updateUser(db, 'racing-email', { email: 'replacement@example.com' });
    expect(
      await updateUser(
        db,
        'racing-email',
        { emailVerified: true, emailVerificationToken: null },
        { verificationTokenHash: 'token-racing-email' },
      ),
    ).toBeNull();
  });

  it('consumes a current token once even with concurrent requests', async () => {
    await seed('single-use-email', false);
    const results = await Promise.all(
      [1, 2].map(() =>
        updateUser(
          db,
          'single-use-email',
          {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null,
            emailVerificationTokenExpiresAt: null,
          },
          { verificationTokenHash: 'token-single-use-email' },
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)).toMatchObject({
      emailVerified: true,
      emailVerificationToken: null,
    });
  });

  it('denies expired proof and an account suspended after lookup', async () => {
    await seed('expired-email', false);
    await updateUser(db, 'expired-email', { emailVerificationTokenExpiresAt: new Date(0) });
    expect(
      await updateUser(
        db,
        'expired-email',
        { emailVerified: true },
        { verificationTokenHash: 'token-expired-email' },
      ),
    ).toBeNull();
    await seed('suspended-email', false);
    await updateUser(db, 'suspended-email', { status: 'suspended' });
    expect(
      await updateUser(
        db,
        'suspended-email',
        { emailVerified: true },
        { verificationTokenHash: 'token-suspended-email' },
      ),
    ).toBeNull();
  });
});
