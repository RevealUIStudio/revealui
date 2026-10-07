import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { GitTreeEntry, PullRequestFile } from './github-app.js';
import {
  buildChangedFileManifest,
  classifyManifestSecurity,
  fetchChangedFileContent,
} from './snapshot.js';

const baseEntries: GitTreeEntry[] = [
  entry('src/edited.ts', 'a'),
  entry('src/old-name.ts', 'b'),
  entry('src/deleted.ts', 'c'),
];

const headEntries: GitTreeEntry[] = [
  entry('src/edited.ts', 'd'),
  entry('src/new-name.ts', 'b'),
  entry('src/added.ts', 'e'),
];

const files: PullRequestFile[] = [
  {
    filename: 'src/edited.ts',
    status: 'modified',
    sha: 'd'.repeat(40),
    additions: 2,
    deletions: 1,
    changes: 3,
  },
  {
    filename: 'src/new-name.ts',
    previous_filename: 'src/old-name.ts',
    status: 'renamed',
    sha: 'b'.repeat(40),
    additions: 0,
    deletions: 0,
    changes: 0,
  },
  {
    filename: 'src/added.ts',
    status: 'added',
    sha: 'e'.repeat(40),
    additions: 5,
    deletions: 0,
    changes: 5,
  },
  {
    filename: 'src/deleted.ts',
    status: 'removed',
    sha: null,
    additions: 0,
    deletions: 4,
    changes: 4,
  },
];

describe('changed file manifest', () => {
  it('binds additions, deletions, renames, blob identities, and file modes', () => {
    const manifest = buildChangedFileManifest(files, baseEntries, headEntries);
    expect(manifest.fileCount).toBe(4);
    expect(manifest.files.find((file) => file.path === 'src/new-name.ts')).toMatchObject({
      previousPath: 'src/old-name.ts',
      status: 'renamed',
      base: { sha: 'b'.repeat(40), mode: '100644' },
      head: { sha: 'b'.repeat(40), mode: '100644' },
    });
    expect(manifest.files.find((file) => file.path === 'src/deleted.ts')).toMatchObject({
      status: 'removed',
      base: { sha: 'c'.repeat(40), mode: '100644' },
    });
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes the digest when executable mode changes', () => {
    const first = buildChangedFileManifest(files, baseEntries, headEntries);
    const modeChangedHead = headEntries.map((item) =>
      item.path === 'src/edited.ts' ? { ...item, mode: '100755' as const } : item,
    );
    const second = buildChangedFileManifest(files, baseEntries, modeChangedHead);
    expect(second.sha256).not.toBe(first.sha256);
  });

  it('fails closed on incomplete rename data, duplicate paths, or tree mismatch', () => {
    expect(() =>
      buildChangedFileManifest(
        [{ ...files[1]!, previous_filename: undefined }],
        baseEntries,
        headEntries,
      ),
    ).toThrow('ambiguous_rename');
    expect(() =>
      buildChangedFileManifest([files[0]!, files[0]!], baseEntries, headEntries),
    ).toThrow('duplicate_pull_request_file');
    expect(() =>
      buildChangedFileManifest([{ ...files[0]!, sha: 'f'.repeat(40) }], baseEntries, headEntries),
    ).toThrow('manifest_blob_mismatch');
  });

  it('rejects changes whose paths do not reconcile with both Git trees', () => {
    expect(() =>
      buildChangedFileManifest(files, baseEntries, [...headEntries, entry('src/edited.ts', 'd')]),
    ).toThrow('duplicate_tree_path');
  });

  it('classifies both paths of a rename using the shared canonical security markers', () => {
    const oldPath = 'packages/security/credentials.ts';
    const newPath = 'apps/marketing/credentials.ts';
    const manifest = buildChangedFileManifest(
      [
        {
          filename: newPath,
          previous_filename: oldPath,
          status: 'renamed',
          sha: 'b'.repeat(40),
          additions: 0,
          deletions: 0,
          changes: 0,
        },
      ],
      [entry(oldPath, 'b')],
      [entry(newPath, 'b')],
    );

    expect(classifyManifestSecurity(manifest)).toMatchObject({
      classifierVersion: 'shared-security-paths-v1',
      sensitivePaths: [oldPath],
    });
  });

  it('fails closed at GitHub’s changed-file limit even when visible paths are benign', () => {
    const manifest = {
      files: [],
      fileCount: 3000,
      sha256: 'a'.repeat(64),
    };
    expect(classifyManifestSecurity(manifest).sensitivePaths[0]).toContain('failing closed');
  });
});

describe('exact changed-file content', () => {
  it('verifies Git blob identity, UTF-8 content, and records content digests', async () => {
    const bytes = Buffer.from('export const reviewed = true;\n', 'utf8');
    const blobSha = createHash('sha1')
      .update(`blob ${bytes.length}\0`, 'utf8')
      .update(bytes)
      .digest('hex');
    const client = {
      getBlob: vi.fn(async (sha: string) => ({
        sha,
        size: bytes.length,
        encoding: 'base64' as const,
        content: bytes.toString('base64'),
      })),
    };
    const manifest = {
      files: [
        {
          path: 'src/reviewed.ts',
          status: 'added' as const,
          head: {
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobSha,
            size: bytes.length,
          },
          additions: 1,
          deletions: 0,
          changes: 1,
        },
      ],
      fileCount: 1,
      sha256: 'a'.repeat(64),
    };
    const content = await fetchChangedFileContent(client, manifest);
    expect(content).toEqual([
      {
        path: 'src/reviewed.ts',
        side: 'head',
        blobSha,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        text: bytes.toString('utf8'),
      },
    ]);
  });

  it('fails closed for oversized sets, tampered blobs, binary data, and symlinks', async () => {
    const client = {
      getBlob: vi.fn(async () => ({
        sha: 'a'.repeat(40),
        size: 0,
        encoding: 'base64' as const,
        content: '',
      })),
    };
    const base = {
      files: [
        {
          path: 'x',
          status: 'added' as const,
          head: { mode: '100644' as const, type: 'blob' as const, sha: 'a'.repeat(40) },
          additions: 0,
          deletions: 0,
          changes: 0,
        },
      ],
      fileCount: 1,
      sha256: 'a'.repeat(64),
    };
    await expect(
      fetchChangedFileContent(client, { ...base, fileCount: 101 }),
    ).rejects.toMatchObject({ code: 'review_file_limit' });
    await expect(fetchChangedFileContent(client, base)).rejects.toMatchObject({
      code: 'review_blob_hash_mismatch',
    });
    await expect(
      fetchChangedFileContent(client, {
        ...base,
        files: [{ ...base.files[0]!, head: { ...base.files[0]!.head, mode: '120000' } }],
      }),
    ).rejects.toMatchObject({ code: 'unsupported_review_file_type' });
  });

  it('bounds base64 decoding and rejects non-canonical encodings', async () => {
    const manifest = {
      files: [
        {
          path: 'x',
          status: 'added' as const,
          head: { mode: '100644' as const, type: 'blob' as const, sha: 'a'.repeat(40) },
          additions: 0,
          deletions: 0,
          changes: 0,
        },
      ],
      fileCount: 1,
      sha256: 'a'.repeat(64),
    };
    const invalidEncoding = {
      getBlob: async (sha: string) => ({
        sha,
        size: 1,
        encoding: 'base64' as const,
        content: 'AB==',
      }),
    };
    await expect(fetchChangedFileContent(invalidEncoding, manifest)).rejects.toMatchObject({
      code: 'invalid_review_blob_encoding',
    });

    const sizeMismatch = {
      getBlob: async (sha: string) => ({
        sha,
        size: 2,
        encoding: 'base64' as const,
        content: 'AA==',
      }),
    };
    await expect(fetchChangedFileContent(sizeMismatch, manifest)).rejects.toMatchObject({
      code: 'review_blob_size_mismatch',
    });

    const oversized = {
      getBlob: async (sha: string) => ({
        sha,
        size: 256 * 1024 + 1,
        encoding: 'base64' as const,
        content: '',
      }),
    };
    await expect(fetchChangedFileContent(oversized, manifest)).rejects.toMatchObject({
      code: 'review_blob_limit',
    });
  });

  it('fetches unique blobs concurrently with a bounded worker pool', async () => {
    const records = Array.from({ length: 12 }, (_, index) => {
      const bytes = Buffer.from(`export const file${index} = ${index};\n`, 'utf8');
      const sha = createHash('sha1')
        .update(`blob ${bytes.length}\0`, 'utf8')
        .update(bytes)
        .digest('hex');
      return { sha, bytes };
    });
    let active = 0;
    let maximumActive = 0;
    const client = {
      getBlob: vi.fn(async (sha: string) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 3));
        active -= 1;
        const record = records.find((item) => item.sha === sha);
        if (!record) throw new Error('test blob not found');
        return {
          sha,
          size: record.bytes.length,
          encoding: 'base64' as const,
          content: record.bytes.toString('base64'),
        };
      }),
    };
    const manifest = {
      files: records.map((record, index) => ({
        path: `src/file-${index}.ts`,
        status: 'added' as const,
        head: { mode: '100644' as const, type: 'blob' as const, sha: record.sha },
        additions: 1,
        deletions: 0,
        changes: 1,
      })),
      fileCount: records.length,
      sha256: 'a'.repeat(64),
    };
    const content = await fetchChangedFileContent(client, manifest);
    expect(client.getBlob).toHaveBeenCalledTimes(records.length);
    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(8);
    expect(content).toHaveLength(records.length);
  });
});

function entry(path: string, digest: string): GitTreeEntry {
  return {
    path,
    mode: '100644',
    type: 'blob',
    sha: digest.repeat(40 / digest.length),
    size: 10,
  };
}
