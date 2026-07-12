import { describe, expect, it } from 'vitest';
import { findAsNeverValuesCalls } from '../as-never-values.js';

describe('findAsNeverValuesCalls', () => {
  it('flags `as never` on a single-object .values() argument', () => {
    const src = `
      await db.insert(auditLog).values({
        event: 'x',
      } as never);
    `;
    const hits = findAsNeverValuesCalls(src, 'fixture.ts');
    expect(hits).toHaveLength(1);
  });

  it('flags `as never` on an element inside an array-literal .values() argument', () => {
    const src = `
      await db.insert(t).values([
        { a: 1 } as never,
        { a: 2 },
      ]);
    `;
    const hits = findAsNeverValuesCalls(src, 'fixture.ts');
    expect(hits).toHaveLength(1);
  });

  it('does not flag a correctly-typed .values() call', () => {
    const src = `
      await db.insert(auditLog).values({
        eventType: 'x',
        agentId: 'y',
        severity: 'info',
        payload: {},
        policyViolations: [],
      });
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does not flag `as never` used elsewhere in the same file (e.g. casting a mock client)', () => {
    const src = `
      const result = await capResourcesOnDowngrade(db as never, 'acct-1', 'free', 'pro');
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does not flag a zero-argument .values() call (e.g. Map.values())', () => {
    const src = `
      for (const v of someMap.values()) {
        console.log(v);
      }
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does not flag `as never` on a non-values() call', () => {
    const src = `
      mockedGetRestClient.mockReturnValue({} as never);
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('reports the 1-indexed line of the call expression', () => {
    const src = ['', '', 'await db.insert(t).values({', '  a: 1,', '} as never);'].join('\n');
    const hits = findAsNeverValuesCalls(src, 'fixture.ts');
    expect(hits).toEqual([{ line: 3 }]);
  });

  // The bypasses an adversarial review demonstrated against the first cut of
  // this matcher. Four are now caught; two remain uncaught by design — see
  // the function's own doc comment for why (a spread requires data-flow
  // analysis this syntactic check doesn't do, and `as any` is a different,
  // broader pattern this check does not police).

  it('follows a SINGLE hop through a hoisted local variable (the bypass that matters most)', () => {
    const src = `
      const p = { a: 1 } as never;
      await db.insert(t).values(p);
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('does not flag a hoisted variable that was never cast `as never`', () => {
    const src = `
      const p = { a: 1 };
      await db.insert(t).values(p);
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('flags the angle-bracket cast syntax `<never>expr`', () => {
    const src = `await db.insert(t).values(<never>{ a: 1 });`;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('flags `as never` wrapped in an extra layer of parentheses', () => {
    const src = `await db.insert(t).values(({ a: 1 } as never));`;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('flags `as never` in either branch of a ternary argument', () => {
    const src = `await db.insert(t).values(c ? (x as never) : y);`;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(1);
  });

  it('does NOT flag a spread of an array cast/assembled elsewhere (known gap — no data-flow analysis)', () => {
    const src = `
      const rowsCastElsewhere = build() as never;
      await db.insert(t).values([...rowsCastElsewhere]);
    `;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });

  it('does NOT flag `as any` (a different, broader pattern this check does not police)', () => {
    const src = `await db.insert(t).values({ a: 1 } as any);`;
    expect(findAsNeverValuesCalls(src, 'fixture.ts')).toHaveLength(0);
  });
});
