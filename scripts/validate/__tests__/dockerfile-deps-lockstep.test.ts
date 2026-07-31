/**
 * Dockerfile deps-stage COPY lockstep unit tests (GAP-379).
 * Pure parsers + comparison against fixture Dockerfiles (no pnpm, no monorepo install).
 */

import { describe, expect, it } from 'vitest';
import {
  findMissingCopies,
  isWholeTreePackageCopy,
  parseCopiedWorkspacePackageDirs,
  parseWorkspaceClosurePaths,
  suggestedCopyLine,
} from '../dockerfile-deps-lockstep.js';

describe('parseCopiedWorkspacePackageDirs', () => {
  it('extracts packages/* and apps/* package.json COPY sources', () => {
    const text = `
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ai/package.json ./packages/ai/
COPY packages/setup/package.json      ./packages/setup/
COPY apps/server/package.json ./apps/server/
COPY --from=deps /app/packages ./packages
COPY packages ./packages
`;
    expect([...parseCopiedWorkspacePackageDirs(text)].sort()).toEqual([
      'apps/server',
      'packages/ai',
      'packages/setup',
    ]);
  });

  it('ignores root package.json and multi-stage COPY', () => {
    const text = `
COPY package.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
`;
    expect(parseCopiedWorkspacePackageDirs(text).size).toBe(0);
  });
});

describe('isWholeTreePackageCopy', () => {
  it('detects worker-style whole packages/ copy without per-package lists', () => {
    const text = `
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/server ./apps/server
`;
    expect(isWholeTreePackageCopy(text)).toBe(true);
  });

  it('is false when individual package.json COPYs exist', () => {
    const text = `
COPY packages/ai/package.json ./packages/ai/
COPY packages ./packages
`;
    expect(isWholeTreePackageCopy(text)).toBe(false);
  });
});

describe('parseWorkspaceClosurePaths', () => {
  it('keeps only packages/ and apps/ dirs under the repo root', () => {
    const root = '/repo';
    const out = [
      '/repo/apps/server',
      '/repo/packages/setup',
      '/repo',
      '/other/packages/ai',
      '',
    ].join('\n');
    expect([...parseWorkspaceClosurePaths(out, root)].sort()).toEqual([
      'apps/server',
      'packages/setup',
    ]);
  });
});

describe('findMissingCopies + suggestedCopyLine', () => {
  it('names every closure member without a COPY', () => {
    const closure = new Set(['apps/server', 'packages/ai', 'packages/setup']);
    const copied = new Set(['apps/server', 'packages/ai']);
    expect(findMissingCopies(closure, copied)).toEqual(['packages/setup']);
    expect(suggestedCopyLine('packages/setup')).toBe(
      'COPY packages/setup/package.json ./packages/setup/',
    );
  });

  it('returns empty when COPY list covers the full closure (extras allowed)', () => {
    const closure = new Set(['apps/server', 'packages/ai']);
    const copied = new Set(['apps/server', 'packages/ai', 'packages/cache']);
    expect(findMissingCopies(closure, copied)).toEqual([]);
  });
});
