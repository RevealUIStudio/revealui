import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function sliceBetween(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const rest = text.slice(from + start.length);
  const to = rest.indexOf(end);
  return to === -1 ? rest : rest.slice(0, to);
}

describe('dependabot catalog autofix trust boundary', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/dependabot-catalog-autofix.yml'),
    'utf8',
  );

  it('authorizes the pull request author and the head repository, not the event actor', () => {
    expect(workflow).toContain('pull_request_target:');
    expect(workflow).toContain(
      "github.event.pull_request.user.login == 'dependabot[bot]' && github.event.pull_request.head.repo.full_name == github.event.pull_request.base.repo.full_name",
    );
    expect(workflow).not.toContain('github.actor');
  });

  it('checks out the head SHA without a token and without persisted credentials', () => {
    const checkout = sliceBetween(
      workflow,
      '      - name: Checkout PR head commit\n',
      '\n      - name:',
    );
    expect(checkout).toContain(['ref: ', '$', '{{ github.event.pull_request.head.sha }}'].join(''));
    expect(checkout).toContain('persist-credentials: false');
    expect(checkout).not.toContain('token:');
    expect(checkout).not.toContain('repository:');
  });

  it('installs with lockfile-only, no lifecycle scripts, and no pnpmfile', () => {
    expect(workflow).toContain('pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile');
    expect(workflow).toContain('npm_config_ignore_scripts: "true"');
    expect(workflow).toContain('npm_config_ignore_pnpmfile: "true"');
    expect(workflow).toContain('pnpmfile.cjs');
    expect(workflow).toContain('node-options*');
  });

  it('keeps the workflow token read-only and hands the App token only to the write step', () => {
    const lines = workflow.split('\n');
    const permissionLines = lines.filter((line) => line.trim() === 'contents: read');
    expect(permissionLines.length).toBeGreaterThanOrEqual(2);
    expect(lines.some((line) => line.trim() === 'contents: write')).toBe(false);
    expect(lines.some((line) => line.trim() === 'pull-requests: write')).toBe(false);
    expect(workflow).toContain('permission-contents: write');

    const tokenLines = lines.filter((line) => line.includes('GH_TOKEN'));
    expect(tokenLines).toEqual([
      ['          GH_TOKEN: ', '$', '{{ steps.app-token.outputs.token }}'].join(''),
    ]);

    const mint = sliceBetween(
      workflow,
      '      - name: Mint backflow App token\n',
      '\n      - name:',
    );
    expect(mint).toContain("if: steps.drift.outputs.drifted == 'true'");
    const writeFrom = workflow.indexOf(
      '      - name: Commit catalog specifier fix (signed via GitHub API)\n',
    );
    expect(writeFrom).toBeGreaterThanOrEqual(0);
    const write = workflow.slice(writeFrom);
    expect(write).toContain("if: steps.drift.outputs.drifted == 'true'");
    expect(write).toContain('GH_TOKEN:');
    expect(write).not.toContain('persist-credentials: true');
  });

  it('refuses a second write when the head commit is already the autofix', () => {
    expect(workflow).toContain('Stop if this head is already an autofix commit');
    expect(workflow).toContain('"$subject" = "$AUTOFIX_SUBJECT"');
    expect(workflow).toContain('Refusing another write.');
  });
});
