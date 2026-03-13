import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectDbTarget, isLocalDbUrl, resolveLocalDbConfig } from '../utils/db.js';

describe('db utils', () => {
  it('detects localhost database URLs as local', () => {
    expect(isLocalDbUrl('postgresql://postgres@localhost:5432/postgres')).toBe(true);
    expect(isLocalDbUrl('postgresql://postgres@127.0.0.1:5432/postgres')).toBe(true);
  });

  it('detects remote database URLs as remote', () => {
    expect(isLocalDbUrl('postgresql://user:pass@ep-123.neon.tech/db?sslmode=require')).toBe(false);
    expect(detectDbTarget('postgresql://user:pass@ep-123.neon.tech/db?sslmode=require')).toBe(
      'remote',
    );
  });

  it('resolves local DB defaults from the workspace path', () => {
    const cwd = '/tmp/revealui-workspace';
    const config = resolveLocalDbConfig(cwd, {});

    expect(config.pgdata).toBe(path.join(cwd, '.pgdata'));
    expect(config.pghost).toBe(path.join(cwd, '.pgdata'));
    expect(config.postgresUrl).toBe('postgresql://postgres@localhost:5432/postgres');
  });
});
