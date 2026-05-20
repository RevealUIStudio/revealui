import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countDirs } from '../claim-drift.ts';

describe('countDirs', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts only directories that contain package.json', () => {
    fs.mkdirSync(path.join(tmp, 'real-pkg'));
    fs.writeFileSync(path.join(tmp, 'real-pkg', 'package.json'), '{}');

    fs.mkdirSync(path.join(tmp, 'no-pkg'));

    expect(countDirs(tmp)).toBe(1);
  });

  it('returns 0 for a non-existent base directory', () => {
    expect(countDirs(path.join(tmp, 'does-not-exist'))).toBe(0);
  });

  it('returns 0 when base contains only files', () => {
    fs.writeFileSync(path.join(tmp, 'file.txt'), '');
    expect(countDirs(tmp)).toBe(0);
  });
});
