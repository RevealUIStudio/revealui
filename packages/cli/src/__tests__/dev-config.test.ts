import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readDevConfig, writeDevConfig } from '../utils/dev-config.js';

describe('dev config', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'revealui-dev-config-'));
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: 'revealui', private: true }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('writes and reads the local dev profile config', () => {
    const configPath = writeDevConfig({ defaultProfile: 'agent' }, tempRoot);
    expect(configPath).toBe(path.join(tempRoot, '.revealui', 'dev.json'));

    expect(readDevConfig(tempRoot)).toEqual({ defaultProfile: 'agent' });
  });

  it('returns an empty config when no dev config file exists', () => {
    expect(readDevConfig(tempRoot)).toEqual({});
  });
});
