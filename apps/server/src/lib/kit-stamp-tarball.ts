/**
 * GAP-448 P2-B: pack Agency kit files into a gzipped ustar archive.
 *
 * Pure Node (no archiver dependency). Never embeds private key material.
 */

import { gzipSync } from 'node:zlib';
import type { KitFulfillmentArtifact } from './kit-stamp-artifact.js';

export interface TarFileEntry {
  /** Path inside the archive (posix, no leading slash). */
  path: string;
  data: Buffer | string;
}

const BLOCK = 512;
const USTAR_MAGIC = 'ustar\0';
const USTAR_VERSION = '00';

function encodeOctal(value: number, length: number): string {
  // ustar numeric fields are null-terminated octal ASCII padded with leading zeros
  const body = value.toString(8);
  const pad = Math.max(0, length - 1 - body.length);
  return `${'0'.repeat(pad)}${body}\0`;
}

function checksumOfHeader(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) {
    sum += header[i] ?? 0;
  }
  return sum;
}

function writeString(buf: Buffer, offset: number, value: string, length: number): void {
  const slice = Buffer.alloc(length, 0);
  slice.write(value.slice(0, length), 0, 'utf8');
  slice.copy(buf, offset);
}

/**
 * Build a single ustar header block for a regular file.
 */
export function buildUstarHeader(path: string, size: number, mtimeSec: number): Buffer {
  if (path.length > 100) {
    throw new Error(`tar path exceeds 100 bytes: ${path}`);
  }
  const header = Buffer.alloc(BLOCK, 0);
  writeString(header, 0, path, 100);
  writeString(header, 100, encodeOctal(0o644, 8), 8); // mode
  writeString(header, 108, encodeOctal(0, 8), 8); // uid
  writeString(header, 116, encodeOctal(0, 8), 8); // gid
  writeString(header, 124, encodeOctal(size, 12), 12); // size
  writeString(header, 136, encodeOctal(mtimeSec, 12), 12); // mtime
  // checksum field (148-155) filled with spaces while computing
  header.fill(0x20, 148, 156);
  writeString(header, 156, '0', 1); // typeflag regular file
  // linkname 157-256 left zero
  writeString(header, 257, USTAR_MAGIC, 6);
  writeString(header, 263, USTAR_VERSION, 2);
  const sum = checksumOfHeader(header);
  writeString(header, 148, encodeOctal(sum, 8), 8);
  return header;
}

/**
 * Pack files into an uncompressed ustar stream (two zero blocks at end).
 */
export function packUstar(files: TarFileEntry[], mtimeSec = Math.floor(Date.now() / 1000)): Buffer {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const data = typeof file.data === 'string' ? Buffer.from(file.data, 'utf8') : file.data;
    const header = buildUstarHeader(file.path.replace(/^\//, ''), data.length, mtimeSec);
    chunks.push(header, data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad > 0) {
      chunks.push(Buffer.alloc(pad, 0));
    }
  }
  // end of archive
  chunks.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(chunks);
}

/**
 * Gzip a ustar buffer (standard .tar.gz).
 */
export function gzipUstar(ustar: Buffer): Buffer {
  return gzipSync(ustar, { level: 9 });
}

/**
 * Pack Agency Founding Kit thin files as a downloadable .tar.gz.
 */
export function buildAgencyKitPackageTarGz(
  artifact: KitFulfillmentArtifact,
  opts?: { mtimeSec?: number },
): Buffer {
  const files: TarFileEntry[] = [
    { path: 'START-HERE.md', data: artifact.startHereMarkdown },
    {
      path: 'revforge.json',
      data: `${JSON.stringify(artifact.revforgeJson, null, 2)}\n`,
    },
    {
      path: 'manifest.json',
      data: `${JSON.stringify(artifact.manifest, null, 2)}\n`,
    },
  ];
  return gzipUstar(packUstar(files, opts?.mtimeSec));
}
