/**
 * GAP-448 P2-B: optional local RevForge stamp.sh for long-running workers.
 *
 * Default full mode produces a package tar (START-HERE + revforge.json) without
 * invoking stamp.sh — safe on Vercel serverless. When REVEALUI_REVFORGE_ROOT
 * points at a revforge checkout and REVEALUI_KIT_STAMP_RUN=1, run stamp.sh into
 * a temp dir and tar the output (operator/Fly worker path).
 *
 * Never mints a second license JWT: FORGE_STAMP_LICENSE_CMD echoes a stub so
 * stamp.sh does not need revvault signing keys. Buyer already has the SaaS JWT.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { logger } from '@revealui/core/observability/logger';
import type { KitFulfillmentArtifact, KitFulfillmentBranding } from './kit-stamp-artifact.js';
import { buildAgencyKitPackageTarGz, packUstar } from './kit-stamp-tarball.js';

export type KitStampSource = 'package' | 'revforge-stamp';

export interface ProduceFullKitArchiveInput {
  branding: KitFulfillmentBranding;
  artifact: KitFulfillmentArtifact;
  /** Already-minted SaaS license JWT if available (not stored in DB by default). */
  licenseJwt?: string | null;
}

export interface ProduceFullKitArchiveResult {
  tarGz: Buffer;
  stampSource: KitStampSource;
}

function stampRunEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REVEALUI_KIT_STAMP_RUN === '1' || env.REVEALUI_KIT_STAMP_RUN === 'true';
}

function revforgeRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const root = env.REVEALUI_REVFORGE_ROOT?.trim() || env.REVEALUI_REVFORGE_PATH?.trim();
  return root && root.length > 0 ? root : null;
}

async function collectFilesRecursive(
  dir: string,
  base = dir,
): Promise<Array<{ path: string; data: Buffer }>> {
  const out: Array<{ path: string; data: Buffer }> = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectFilesRecursive(abs, base)));
    } else if (ent.isFile()) {
      const data = await readFile(abs);
      out.push({ path: relative(base, abs).split('\\').join('/'), data });
    }
  }
  return out;
}

async function runStampSh(opts: {
  revforgeRoot: string;
  configPath: string;
  outDir: string;
  licenseJwt?: string | null;
}): Promise<void> {
  const stampSh = join(opts.revforgeRoot, 'stamp.sh');
  const stampStat = await stat(stampSh).catch(() => null);
  if (!stampStat?.isFile()) {
    throw new Error(`stamp.sh not found at ${stampSh}`);
  }

  const stubDir = await mkdtemp(join(tmpdir(), 'kit-stamp-lic-'));
  const stubPath = join(stubDir, 'issuer.sh');
  const jwtLine = (opts.licenseJwt?.trim() || 'stub.agency.kit.jwt').replace(/'/g, '');
  await writeFile(stubPath, `#!/usr/bin/env bash\nprintf '%s\\n' '${jwtLine}'\n`, {
    mode: 0o755,
  });

  const publicKey =
    process.env.REVEALUI_LICENSE_PUBLIC_KEY?.trim() ||
    '-----BEGIN PUBLIC KEY-----\nSTUB\n-----END PUBLIC KEY-----';

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'bash',
        [
          stampSh,
          '--config',
          opts.configPath,
          '--output',
          opts.outDir,
          '--password',
          'ChangeMeOnFirstLogin!',
        ],
        {
          cwd: opts.revforgeRoot,
          env: {
            ...process.env,
            FORGE_STAMP_LICENSE_CMD: stubPath,
            REVEALUI_LICENSE_PUBLIC_KEY: publicKey,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stderr = '';
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`stamp.sh exited ${code}: ${stderr.slice(0, 800)}`));
        }
      });
    });
  } finally {
    await rm(stubDir, { recursive: true, force: true });
  }
}

/**
 * Produce the full-mode archive: package tar, or RevForge stamp output when configured.
 */
export async function produceFullKitArchive(
  input: ProduceFullKitArchiveInput,
): Promise<ProduceFullKitArchiveResult> {
  const root = revforgeRoot();
  if (!(stampRunEnabled() && root)) {
    return {
      tarGz: buildAgencyKitPackageTarGz(input.artifact),
      stampSource: 'package',
    };
  }

  const work = await mkdtemp(join(tmpdir(), 'kit-stamp-work-'));
  try {
    const configPath = join(work, 'revforge.json');
    await writeFile(configPath, `${JSON.stringify(input.artifact.revforgeJson, null, 2)}\n`);
    const outDir = join(work, 'out');
    await runStampSh({
      revforgeRoot: root,
      configPath,
      outDir,
      licenseJwt: input.licenseJwt,
    });
    const files = await collectFilesRecursive(outDir);
    if (files.length === 0) {
      throw new Error('stamp.sh produced no files');
    }
    const tarGz = gzipSync(packUstar(files), { level: 9 });
    return { tarGz, stampSource: 'revforge-stamp' };
  } catch (err) {
    logger.warn('RevForge stamp.sh failed; falling back to package tar.gz', {
      detail: err instanceof Error ? err.message : 'unknown',
    });
    return {
      tarGz: buildAgencyKitPackageTarGz(input.artifact),
      stampSource: 'package',
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
