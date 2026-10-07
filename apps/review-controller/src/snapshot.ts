import { createHash } from 'node:crypto';
import {
  classifySecurityPathsAtApiLimit,
  SECURITY_PATH_CLASSIFIER_VERSION,
} from '@revealui/security/security-path-classifier';
import type { GitHubAppClient, GitTreeEntry, PullRequestFile } from './github-app.js';
import { GitHubAppError } from './github-app.js';

export interface ManifestFile {
  path: string;
  previousPath?: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'changed';
  base?: Pick<GitTreeEntry, 'mode' | 'type' | 'sha' | 'size'>;
  head?: Pick<GitTreeEntry, 'mode' | 'type' | 'sha' | 'size'>;
  additions: number;
  deletions: number;
  changes: number;
}

export interface ChangedFileManifest {
  files: ManifestFile[];
  fileCount: number;
  sha256: string;
}

export interface ChangedFileContent {
  path: string;
  side: 'base' | 'head';
  blobSha: string;
  sha256: string;
  text: string;
}

const MAX_REVIEW_FILES = 100;
const MAX_REVIEW_CONTENT_BYTES = 2 * 1024 * 1024;

export interface PullRequestSnapshot {
  repositoryId: number;
  pullRequest: number;
  state: string;
  draft: boolean;
  baseRef: string;
  headSha: string;
  headTreeSha: string;
  baseSha: string;
  baseTreeSha: string;
  manifest: ChangedFileManifest;
  content: ChangedFileContent[];
  securityClassification: {
    classifierVersion: string;
    sensitivePaths: string[];
  };
}

export async function fetchPullRequestSnapshot(
  client: GitHubAppClient,
  pullRequest: number,
): Promise<PullRequestSnapshot> {
  const pr = await client.getPullRequest(pullRequest);
  const head = record(pr.head);
  const base = record(pr.base);
  const headSha = sha(head.sha);
  const baseSha = sha(base.sha);
  const [headTreeSha, baseTreeSha, files] = await Promise.all([
    client.getCommitTree(headSha),
    client.getCommitTree(baseSha),
    client.listPullRequestFiles(pullRequest),
  ]);
  const [headTree, baseTree] = await Promise.all([
    client.getTree(headTreeSha),
    client.getTree(baseTreeSha),
  ]);
  const manifest = buildChangedFileManifest(files, baseTree, headTree);
  const content = await fetchChangedFileContent(client, manifest);
  return {
    repositoryId: client.repositoryId,
    pullRequest,
    state: typeof pr.state === 'string' ? pr.state : fail('invalid_pull_request_state'),
    draft: typeof pr.draft === 'boolean' ? pr.draft : fail('invalid_pull_request_state'),
    baseRef: typeof base.ref === 'string' ? base.ref : fail('invalid_pull_request_ref'),
    headSha,
    headTreeSha,
    baseSha,
    baseTreeSha,
    manifest,
    content,
    securityClassification: classifyManifestSecurity(manifest),
  };
}

export async function fetchChangedFileContent(
  client: Pick<GitHubAppClient, 'getBlob'>,
  manifest: ChangedFileManifest,
): Promise<ChangedFileContent[]> {
  if (manifest.fileCount > MAX_REVIEW_FILES) fail('review_file_limit');
  const refs = manifest.files.flatMap((file) => [
    ...(file.base
      ? [{ path: file.previousPath ?? file.path, side: 'base' as const, entry: file.base }]
      : []),
    ...(file.head ? [{ path: file.path, side: 'head' as const, entry: file.head }] : []),
  ]);
  for (const ref of refs) {
    if (ref.entry.type !== 'blob' || !['100644', '100755'].includes(ref.entry.mode))
      fail('unsupported_review_file_type');
    if (typeof ref.entry.size === 'number' && ref.entry.size > 256 * 1024)
      fail('review_blob_limit');
  }
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.entry.sha, ref])).entries()];
  const blobs = new Map<string, string>();
  let totalBytes = 0;
  let nextRef = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(8, uniqueRefs.length) }, async () => {
    while (!failed) {
      const indexed = uniqueRefs[nextRef++];
      if (!indexed) return;
      const [blobSha, ref] = indexed;
      try {
        const blob = await client.getBlob(blobSha);
        if (!Number.isSafeInteger(blob.size) || blob.size < 0 || blob.size > 256 * 1024)
          fail('review_blob_limit');
        const encoded = blob.content.replace(/\s/g, '');
        const maxEncodedBytes = Math.ceil((256 * 1024) / 3) * 4;
        if (encoded.length > maxEncodedBytes || encoded.length % 4 !== 0)
          fail('invalid_review_blob_encoding');
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.toString('base64') !== encoded) fail('invalid_review_blob_encoding');
        if (bytes.length !== blob.size || bytes.length > 256 * 1024)
          fail('review_blob_size_mismatch');
        totalBytes += bytes.length;
        if (totalBytes > MAX_REVIEW_CONTENT_BYTES) fail('review_content_limit');
        const objectHash = createHash(ref.entry.sha.length === 40 ? 'sha1' : 'sha256')
          .update(`blob ${bytes.length}\0`, 'utf8')
          .update(bytes)
          .digest('hex');
        if (objectHash !== ref.entry.sha) fail('review_blob_hash_mismatch');
        if (bytes.includes(0)) fail('binary_review_file');
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          fail('non_utf8_review_file');
        }
        blobs.set(blobSha, text);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  await Promise.all(workers);
  const contents: ChangedFileContent[] = refs.map((ref) => {
    const text = blobs.get(ref.entry.sha);
    if (text === undefined) fail('review_blob_missing');
    return {
      path: ref.path,
      side: ref.side,
      blobSha: ref.entry.sha,
      sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      text,
    };
  });
  contents.sort(
    (left, right) => left.path.localeCompare(right.path) || left.side.localeCompare(right.side),
  );
  return contents;
}

export function classifyManifestSecurity(manifest: ChangedFileManifest) {
  const paths = manifest.files.flatMap((file) =>
    file.previousPath ? [file.path, file.previousPath] : [file.path],
  );
  return {
    classifierVersion: SECURITY_PATH_CLASSIFIER_VERSION,
    sensitivePaths: classifySecurityPathsAtApiLimit(paths, manifest.fileCount),
  };
}

export function buildChangedFileManifest(
  files: readonly PullRequestFile[],
  baseEntries: readonly GitTreeEntry[],
  headEntries: readonly GitTreeEntry[],
): ChangedFileManifest {
  const base = treeIndex(baseEntries);
  const head = treeIndex(headEntries);
  const seen = new Set<string>();
  const manifestFiles = files.map((file): ManifestFile => {
    if (seen.has(file.filename)) fail('duplicate_pull_request_file');
    seen.add(file.filename);
    if (!isManifestStatus(file.status)) fail('unsupported_file_status');
    const previousPath = file.previous_filename;
    if (
      (file.status === 'renamed') !==
      (typeof previousPath === 'string' && previousPath.length > 0)
    )
      fail('ambiguous_rename');
    const oldPath = previousPath ?? file.filename;
    const baseEntry = base.get(oldPath);
    const headEntry = head.get(file.filename);
    if (file.status === 'added' && (baseEntry || !headEntry)) fail('manifest_tree_mismatch');
    if (file.status === 'removed' && (!baseEntry || headEntry)) fail('manifest_tree_mismatch');
    if (file.status !== 'added' && file.status !== 'removed' && !(baseEntry && headEntry))
      fail('manifest_tree_mismatch');
    if (headEntry && file.sha !== headEntry.sha) fail('manifest_blob_mismatch');
    const row: ManifestFile = {
      path: file.filename,
      ...(previousPath ? { previousPath } : {}),
      status: file.status,
      ...(baseEntry ? { base: leaf(baseEntry) } : {}),
      ...(headEntry ? { head: leaf(headEntry) } : {}),
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
    };
    return row;
  });
  manifestFiles.sort((left, right) => left.path.localeCompare(right.path));
  const canonical = JSON.stringify(manifestFiles);
  return {
    files: manifestFiles,
    fileCount: manifestFiles.length,
    sha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}

function treeIndex(entries: readonly GitTreeEntry[]): Map<string, GitTreeEntry> {
  const index = new Map<string, GitTreeEntry>();
  for (const entry of entries) {
    if (entry.type === 'tree') continue;
    if (index.has(entry.path)) fail('duplicate_tree_path');
    index.set(entry.path, entry);
  }
  return index;
}

function leaf(entry: GitTreeEntry): Pick<GitTreeEntry, 'mode' | 'type' | 'sha' | 'size'> {
  return {
    mode: entry.mode,
    type: entry.type,
    sha: entry.sha,
    ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return fail('invalid_pull_request_ref');
  return value as Record<string, unknown>;
}

function sha(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/.test(value))
    return fail('invalid_pull_request_sha');
  return value;
}

function isManifestStatus(value: PullRequestFile['status']): value is ManifestFile['status'] {
  return ['added', 'removed', 'modified', 'renamed', 'changed'].includes(value);
}

function fail(code: string): never {
  throw new GitHubAppError(code);
}
