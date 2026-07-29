import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanGeneratedPublicMirror,
  collectPublicDocRels,
  emitPublicDocsToDir,
  resolvePublicDoc,
} from '../docs-publish.mjs';

describe('docs-publish plane', () => {
  let tmp: string;
  let docsSource: string;
  let publicDir: string;
  let outDir: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-publish-'));
    docsSource = path.join(tmp, 'docs');
    publicDir = path.join(tmp, 'public');
    outDir = path.join(tmp, 'dist');
    fs.mkdirSync(docsSource, { recursive: true });
    fs.mkdirSync(path.join(docsSource, 'blog'), { recursive: true });
    fs.mkdirSync(path.join(publicDir, 'docs-pro'), { recursive: true });
    fs.writeFileSync(
      path.join(docsSource, 'PUBLIC.md'),
      '---\nvisibility: public\ntitle: Public\n---\n\nHello\n',
    );
    fs.writeFileSync(
      path.join(docsSource, 'SECRET.md'),
      '---\nvisibility: internal\ntitle: Secret\n---\n\nNope\n',
    );
    fs.writeFileSync(
      path.join(docsSource, 'blog', 'post.md'),
      '---\nvisibility: public\ntitle: Post\n---\n\nPost\n',
    );
    fs.writeFileSync(path.join(publicDir, 'PUBLIC.md'), '# stale mirror\n');
    fs.writeFileSync(path.join(publicDir, 'docs-pro', 'keep.md'), '# hand authored\n');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('collectPublicDocRels only includes visibility:public', async () => {
    const set = await collectPublicDocRels(docsSource);
    expect(set.has('PUBLIC.md')).toBe(true);
    expect(set.has('blog/post.md')).toBe(true);
    expect(set.has('SECRET.md')).toBe(false);
  });

  it('resolvePublicDoc serves public and withholds internal', async () => {
    const ok = await resolvePublicDoc(docsSource, '/PUBLIC.md');
    expect(ok?.rel).toBe('PUBLIC.md');
    expect(ok?.content.includes('Hello')).toBe(true);

    const denied = await resolvePublicDoc(docsSource, '/SECRET.md');
    expect(denied).toBeNull();

    const pathEscape = await resolvePublicDoc(docsSource, '/../etc/passwd.md');
    expect(pathEscape).toBeNull();
  });

  it('cleanGeneratedPublicMirror removes stale md but keeps docs-pro', async () => {
    const removed = await cleanGeneratedPublicMirror(publicDir, docsSource);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(publicDir, 'PUBLIC.md'))).toBe(false);
    expect(fs.existsSync(path.join(publicDir, 'docs-pro', 'keep.md'))).toBe(true);
  });

  it('emitPublicDocsToDir writes only public docs into outDir', async () => {
    const count = await emitPublicDocsToDir(docsSource, outDir);
    expect(count).toBe(2);
    expect(fs.existsSync(path.join(outDir, 'PUBLIC.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'blog', 'post.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'SECRET.md'))).toBe(false);
  });
});
