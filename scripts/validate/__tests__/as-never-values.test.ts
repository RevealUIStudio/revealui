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
});
