import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { toContractJsonSchema } from '../servers/factories/contract-json-schema.js';
import { getContractsCatalog, validatePayload } from '../servers/factories/contracts.js';

describe('contract JSON conversion policies', () => {
  it('retains Session business refinements after catalog conversion', () => {
    getContractsCatalog();
    const session = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      userId: '123e4567-e89b-42d3-a456-426614174001',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      lastActivityAt: new Date(),
      createdAt: new Date(),
    };
    expect(validatePayload('entities', 'session', session).success).toBe(true);
    expect(
      validatePayload('entities', 'session', { ...session, expiresAt: new Date(0) }).success,
    ).toBe(false);
    expect(validatePayload('entities', 'session', { ...session, tokenHash: 'plain' }).success).toBe(
      false,
    );
  });
  it('serializes all catalog schemas without error placeholders', () => {
    const catalog = getContractsCatalog();
    expect(Object.values(catalog).flatMap((entry) => Object.keys(entry.schemas))).toHaveLength(108);
    expect(JSON.stringify(catalog)).not.toContain('JSON Schema serialization failed:');
  });

  it.each(['signIn', 'signUp', 'passwordReset'])(
    'describes %s input while retaining runtime normalization',
    (name) => {
      const schema = getContractsCatalog().api_auth.schemas[name];
      expect(schema).toMatchObject({
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
      });
      const data = {
        email: 'UPPER@example.com',
        password: 'long-enough-password',
        name: '<b>Test</b>',
        tosAccepted: true,
      };
      const parsed = validatePayload('api_auth', name, data);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data).toMatchObject({ email: 'upper@example.com' });
    },
  );

  it('keeps entity output defaults required while request input defaults stay optional', () => {
    const schema = z.object({ visibility: z.string().default('public') });
    expect(toContractJsonSchema(schema, { io: 'input' }).required).toBeUndefined();
    expect(toContractJsonSchema(schema).required).toEqual(['visibility']);
    expect(getContractsCatalog().entities.schemas.site).toHaveProperty(
      'required',
      expect.arrayContaining(['visibility']),
    );
  });

  it('projects only opted-in Dates without widening other unsupported schemas', () => {
    expect(() => toContractJsonSchema(z.date())).toThrow();
    expect(() => toContractJsonSchema(z.bigint(), { dateProjection: 'date-to-json' })).toThrow();
    expect(() =>
      toContractJsonSchema(z.string().transform(Number), { dateProjection: 'date-to-json' }),
    ).toThrow();
    expect(() =>
      toContractJsonSchema(z.date().min(new Date(0)), { dateProjection: 'date-to-json' }),
    ).toThrow('Date checks');
  });

  it('describes full Date serialization syntax without claiming RFC3339 compatibility', () => {
    const schema = toContractJsonSchema(z.date(), { dateProjection: 'date-to-json' });
    expect(schema).toMatchObject({ type: 'string', 'x-revealui-runtime-type': 'Date' });
    expect(schema).not.toHaveProperty('format');
    const pattern = new RegExp(String(schema.pattern));
    for (const date of [
      new Date(0),
      new Date('2026-11-16T12:34:56.789Z'),
      new Date(-8640000000000000),
      new Date(8640000000000000),
    ]) {
      expect(pattern.test(JSON.parse(JSON.stringify(date)))).toBe(true);
    }
    for (const value of [
      '2026-11-16',
      '2026-11-16T12:34Z',
      '2026-11-16T12:34:56Z',
      '2026-11-16T12:34:56.000+01:00',
    ]) {
      expect(pattern.test(value)).toBe(false);
    }
  });

  it('retains optional/nullable Date structure and runtime Date validation', () => {
    const date = z.date();
    const schema = toContractJsonSchema(z.object({ date: date.nullable().optional() }), {
      dateProjection: 'date-to-json',
    });
    expect(schema.required).toBeUndefined();
    expect(schema).toHaveProperty(
      'properties.date.anyOf',
      expect.arrayContaining([{ type: 'null' }]),
    );
    expect(date.safeParse(new Date(0)).success).toBe(true);
    expect(date.safeParse('1970-01-01T00:00:00.000Z').success).toBe(false);
    expect(date.safeParse(new Date(Number.NaN)).success).toBe(false);
    const session = {
      id: 's-1',
      userId: 'u-1',
      tokenHash: 'test-hash',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    };
    expect(validatePayload('generated', 'sessionsInsert', session).success).toBe(true);
    expect(
      validatePayload('generated', 'sessionsInsert', JSON.parse(JSON.stringify(session))).success,
    ).toBe(false);
  });
});
