/**
 * Host local inference lifecycle (Ollama + Inference Snaps) + profile tiers.
 *
 * Catalog SSOT: `@revealui/ai` PRODUCT_INFERENCE_SNAP_CATALOG (US-origin only).
 * Profile SSOT: `@revealui/ai` local-ai-profile (written here, read by createLLMClientFromEnv).
 */

import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import {
  DEFAULT_DAILY_OLLAMA_MODEL,
  DEFAULT_LOW_RAM_INFERENCE_SNAP,
  DEFAULT_US_ORIGIN_INFERENCE_SNAP,
  emptyIdleProfile,
  type LocalAiProfile,
  type LocalAiTier,
  PRODUCT_INFERENCE_SNAP_CATALOG,
  profileDefaultsForTier,
  saveLocalAiProfile,
  loadLocalAiProfile,
  US_ORIGIN_INFERENCE_SNAP_IDS,
} from '@revealui/ai';

const execFileAsync = promisify(execFile);

// ── Types ───────────────────────────────────────────────────────────

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export interface ModelPullResult {
  success: boolean;
  message: string;
}

export interface SnapStatus {
  installed: boolean;
  running: boolean;
  snapName: string;
  endpoint: string | null;
  version: string | null;
}

export interface SnapModel {
  name: string;
  description: string;
  installed: boolean;
}

export interface LocalAiProfileView extends LocalAiProfile {
  memAvailableGiB: number | null;
  ollamaRunning: boolean;
  snapsRunning: string[];
}

// ── Configuration ───────────────────────────────────────────────────

/**
 * Product install/list catalog — derived from `@revealui/ai` (US-origin only).
 */
export const PRODUCT_INFERENCE_SNAPS: ReadonlyArray<readonly [string, string]> =
  PRODUCT_INFERENCE_SNAP_CATALOG.map((entry) => [entry.id, entry.description] as const);

const KNOWN_SNAPS = PRODUCT_INFERENCE_SNAPS;

// ── Helpers ─────────────────────────────────────────────────────────

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/** Allowlist of commands that run() may execute */
const ALLOWED_COMMANDS = new Set(['ollama', 'snap', 'which', 'killall']);

async function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  if (!ALLOWED_COMMANDS.has(cmd)) {
    throw new Error(`Command not allowed: ${cmd}`);
  }
  return execFileAsync(cmd, args, { timeout: 30_000 });
}

function parseSnapOpenaiUrl(statusStdout: string): string | null {
  const match = statusStdout.match(/openai:\s*(\S+)/i);
  return match?.[1] ?? null;
}

function readMemAvailableGiB(): number | null {
  try {
    const text = readFileSync('/proc/meminfo', 'utf8');
    const line = text.split('\n').find((l) => l.startsWith('MemAvailable:'));
    if (!line) return null;
    const kb = Number.parseInt(line.replace(/\D+/g, ''), 10);
    if (!Number.isFinite(kb)) return null;
    return Math.round((kb / 1024 / 1024) * 10) / 10;
  } catch {
    return null;
  }
}

// ── Service ─────────────────────────────────────────────────────────

/**
 * Manages local inference engines (Ollama, Snaps) on the daemon host.
 * Each method mirrors the equivalent Tauri command from `inference.rs`.
 */
export class InferenceService {
  // ── Ollama ──────────────────────────────────────────────────────

  async ollamaStatus(): Promise<OllamaStatus> {
    const installed = await commandExists('ollama');
    if (!installed) return { installed: false, running: false, version: null };

    let version: string | null = null;
    try {
      const { stdout } = await run('ollama', ['--version']);
      version = stdout.trim() || null;
    } catch {
      // version check failed  -  binary may exist but be broken
    }

    let running = false;
    try {
      await run('ollama', ['list']);
      running = true;
    } catch {
      // list fails when server isn't running
    }

    return { installed, running, version };
  }

  async ollamaModels(): Promise<OllamaModel[]> {
    const { stdout } = await run('ollama', ['list']);
    const models: OllamaModel[] = [];
    const lines = stdout.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        models.push({
          name: parts[0] ?? '',
          size: parts[2] ?? '',
          modified: parts.slice(3).join(' '),
        });
      }
    }

    return models;
  }

  async ollamaPull(modelName: string): Promise<ModelPullResult> {
    if (!/^[\w./:@-]+$/.test(modelName)) {
      return { success: false, message: `Invalid model name: ${modelName}` };
    }
    try {
      const { stdout, stderr } = await execFileAsync('ollama', ['pull', modelName], {
        timeout: 600_000,
      });
      return { success: true, message: stdout || stderr };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async ollamaDelete(modelName: string): Promise<void> {
    if (!/^[\w./:@-]+$/.test(modelName)) {
      throw new Error(`Invalid model name: ${modelName}`);
    }
    await run('ollama', ['rm', modelName]);
  }

  async ollamaStart(): Promise<void> {
    const modelsDir =
      process.env.OLLAMA_MODELS ??
      (existsSync('/mnt/studio/models/ollama') ? '/mnt/studio/models/ollama' : undefined);
    const child = spawn('ollama', ['serve'], {
      stdio: 'ignore',
      detached: true,
      env: {
        ...process.env,
        ...(modelsDir ? { OLLAMA_MODELS: modelsDir } : {}),
        OLLAMA_KEEP_ALIVE: process.env.OLLAMA_KEEP_ALIVE ?? '0',
        OLLAMA_MAX_LOADED_MODELS: process.env.OLLAMA_MAX_LOADED_MODELS ?? '1',
        OLLAMA_NUM_PARALLEL: process.env.OLLAMA_NUM_PARALLEL ?? '1',
      },
    });
    child.unref();
  }

  async ollamaStop(): Promise<void> {
    try {
      // Prefer killall (name-only) over pkill -f (matches wrappers / is flaky).
      await run('killall', ['ollama']);
    } catch {
      // exit 1 when no process — fine
    }
  }

  // ── Inference Snaps ─────────────────────────────────────────────

  async snapList(): Promise<SnapModel[]> {
    const results: SnapModel[] = [];
    for (const [name, description] of KNOWN_SNAPS) {
      let installed = false;
      try {
        await run('snap', ['list', name]);
        installed = true;
      } catch {
        // not installed
      }
      results.push({ name, description, installed });
    }
    return results;
  }

  async snapStatus(snapName: string): Promise<SnapStatus> {
    const known = KNOWN_SNAPS.some(([name]) => name === snapName);
    if (!known) throw new Error(`Unknown inference snap: ${snapName}`);

    let installed = false;
    let version: string | null = null;

    try {
      const { stdout } = await run('snap', ['list', snapName]);
      installed = true;
      const secondLine = stdout.split('\n')[1];
      if (secondLine) {
        version = secondLine.split(/\s+/)[1] ?? null;
      }
    } catch {
      return { installed: false, running: false, snapName, endpoint: null, version: null };
    }

    let running = false;
    let endpoint: string | null = null;
    try {
      const { stdout } = await run(snapName, ['status']);
      running = true;
      endpoint = parseSnapOpenaiUrl(stdout) ?? 'http://127.0.0.1:9090/v1';
    } catch {
      // not running
    }

    return { installed, running, snapName, endpoint, version };
  }

  async snapInstall(snapName: string): Promise<ModelPullResult> {
    const known = KNOWN_SNAPS.some(([name]) => name === snapName);
    if (!known) throw new Error(`Unknown inference snap: ${snapName}`);

    try {
      const { stdout, stderr } = await execFileAsync('sudo', ['snap', 'install', snapName], {
        timeout: 300_000,
      });
      return { success: true, message: stdout || stderr };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async snapRemove(snapName: string): Promise<void> {
    const known = KNOWN_SNAPS.some(([name]) => name === snapName);
    if (!known) throw new Error(`Unknown inference snap: ${snapName}`);
    await execFileAsync('sudo', ['snap', 'remove', snapName], { timeout: 60_000 });
  }

  private async stopAllProductSnaps(opts: { disableBoot: boolean }): Promise<void> {
    for (const id of US_ORIGIN_INFERENCE_SNAP_IDS) {
      try {
        await run('snap', ['list', id]);
      } catch {
        continue;
      }
      try {
        if (opts.disableBoot) {
          await execFileAsync('sudo', ['snap', 'stop', '--disable', id], { timeout: 60_000 });
        } else {
          await execFileAsync('sudo', ['snap', 'stop', id], { timeout: 60_000 });
        }
      } catch {
        // best-effort
      }
    }
  }

  // ── Profile tiers (control plane) ───────────────────────────────

  async profileGet(): Promise<LocalAiProfileView> {
    const stored = loadLocalAiProfile() ?? emptyIdleProfile();
    const ollama = await this.ollamaStatus();
    const snapsRunning: string[] = [];
    for (const id of US_ORIGIN_INFERENCE_SNAP_IDS) {
      try {
        const st = await this.snapStatus(id);
        if (st.running) snapsRunning.push(id);
      } catch {
        // ignore
      }
    }
    return {
      ...stored,
      memAvailableGiB: readMemAvailableGiB(),
      ollamaRunning: ollama.running,
      snapsRunning,
    };
  }

  /**
   * Apply a host resource tier: stop other engines, start the selected one, persist profile.
   * Dev-first: prefer `idle` when coding so IDE/terminals keep RAM.
   */
  async profileApply(tier: LocalAiTier): Promise<LocalAiProfileView> {
    const defaults = profileDefaultsForTier(tier);
    const base = emptyIdleProfile();
    let profile: LocalAiProfile = {
      ...base,
      tier,
      provider: defaults.provider,
      model: defaults.model,
      baseURL: defaults.baseURL,
      keepAlive: defaults.keepAlive,
      note: defaults.note,
      updatedAt: new Date().toISOString(),
    };

    if (tier === 'idle') {
      await this.ollamaStop();
      await this.stopAllProductSnaps({ disableBoot: true });
    } else if (tier === 'daily') {
      await this.stopAllProductSnaps({ disableBoot: true });
      await this.ollamaStart();
      // wait briefly for ollama
      for (let i = 0; i < 20; i++) {
        const st = await this.ollamaStatus();
        if (st.running) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      profile = {
        ...profile,
        provider: 'ollama',
        model: DEFAULT_DAILY_OLLAMA_MODEL,
        baseURL: 'http://127.0.0.1:11434',
        keepAlive: '0',
      };
    } else if (tier === 'snaps') {
      await this.ollamaStop();
      const snapName = DEFAULT_LOW_RAM_INFERENCE_SNAP;
      try {
        await run('snap', ['list', snapName]);
      } catch {
        throw new Error(
          `Snap ${snapName} is not installed. Install: sudo snap install ${snapName}`,
        );
      }
      try {
        await execFileAsync('sudo', ['snap', 'start', '--enable', snapName], { timeout: 60_000 });
      } catch {
        await execFileAsync('sudo', ['snap', 'start', snapName], { timeout: 60_000 }).catch(
          () => undefined,
        );
      }
      // Prefer smallest gemma model when available (non-interactive)
      if (snapName === 'gemma3') {
        try {
          await execFileAsync(
            'bash',
            ['-c', 'yes | sudo timeout 45 gemma3 use-model 270m || true'],
            { timeout: 60_000 },
          );
        } catch {
          // optional
        }
      }
      let endpoint: string | null = null;
      for (let i = 0; i < 30; i++) {
        const st = await this.snapStatus(snapName);
        if (st.running && st.endpoint) {
          endpoint = st.endpoint;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      profile = {
        ...profile,
        provider: 'inference-snaps',
        model: snapName,
        baseURL: endpoint,
      };
    } else if (tier === 'heavy') {
      await this.ollamaStop();
      for (const id of US_ORIGIN_INFERENCE_SNAP_IDS) {
        if (id === DEFAULT_US_ORIGIN_INFERENCE_SNAP) continue;
        try {
          await execFileAsync('sudo', ['snap', 'stop', '--disable', id], { timeout: 60_000 });
        } catch {
          // ignore
        }
      }
      const snapName = DEFAULT_US_ORIGIN_INFERENCE_SNAP;
      try {
        await run('snap', ['list', snapName]);
      } catch {
        throw new Error(
          `Snap ${snapName} is not installed. Install: sudo snap install ${snapName}`,
        );
      }
      try {
        await execFileAsync('sudo', ['snap', 'start', '--enable', snapName], { timeout: 60_000 });
      } catch {
        await execFileAsync('sudo', ['snap', 'start', snapName], { timeout: 60_000 }).catch(
          () => undefined,
        );
      }
      let endpoint: string | null = null;
      for (let i = 0; i < 30; i++) {
        const st = await this.snapStatus(snapName);
        if (st.running && st.endpoint) {
          endpoint = st.endpoint;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      const mem = readMemAvailableGiB();
      profile = {
        ...profile,
        provider: 'inference-snaps',
        model: snapName,
        baseURL: endpoint,
        note:
          mem != null && mem < 6
            ? `Heavy snap on ~${mem}Gi available RAM — expect thrash; prefer daily/snaps for IDE work`
            : profile.note,
      };
    }

    saveLocalAiProfile(profile);
    return this.profileGet();
  }
}
