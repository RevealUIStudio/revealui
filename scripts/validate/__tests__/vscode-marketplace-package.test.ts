/**
 * GAP-475: the VS Code marketplace package is listing-ready and refuses publish.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectIssues,
  findLeakedSecrets,
  packVsCodePlugin,
  publishRefusal,
} from '../vscode-marketplace-package.js';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

describe('publishRefusal', () => {
  it('refuses publish and login arguments', () => {
    expect(publishRefusal(['--publish'])).toContain('GAP-475');
    expect(publishRefusal(['publish'])).toContain('owner');
    expect(publishRefusal(['--login'])).toContain('credentials');
    expect(publishRefusal(['--pack'])).toBeNull();
    expect(publishRefusal([])).toBeNull();
  });
});

describe('findLeakedSecrets', () => {
  it('flags token-shaped strings and accepts input references', () => {
    expect(
      findLeakedSecrets({ headers: { Authorization: 'Bearer rvui_dev_secret' } }),
    ).toHaveLength(1);
    expect(
      findLeakedSecrets({
        url: `\${input:revealui-mcp-url}`,
        token: `\${input:revealui-mcp-token}`,
      }),
    ).toEqual([]);
  });
});

describe('committed VS Code marketplace package', () => {
  it('matches the generator hook contract and the leak-proof MCP template', () => {
    expect(collectIssues(REPO_ROOT)).toEqual([]);
  });

  it('packs a tarball that contains the listing files and no publish step', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'vscode-plugin-'));
    const tarball = packVsCodePlugin(REPO_ROOT, outDir);
    const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
    expect(listing).toContain('plugin.json');
    expect(listing).toContain('.mcp.json');
    expect(listing).toContain('README.md');
    expect(listing).toContain('LICENSE');
    expect(tarball.endsWith('revealui-vscode-plugin-0.1.0.tar.gz')).toBe(true);
  });
});
