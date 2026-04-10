import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CIFeedback } from './coordination/ci-feedback.js';
import { MergePipeline } from './coordination/merge-pipeline.js';
import { autoDetectHarnesses } from './detection/auto-detector.js';
import { HarnessRegistry } from './registry/harness-registry.js';
import { HttpGateway } from './server/http-gateway.js';
import { InferenceService } from './server/inference-service.js';
import { RpcServer } from './server/rpc-server.js';
import { SpawnerService } from './server/spawner-service.js';
import { DaemonStore } from './storage/daemon-store.js';
import type { HarnessAdapter } from './types/adapter.js';
import type { HealthCheckResult } from './types/core.js';
import { deriveSessionId, detectSessionType } from './workboard/session-identity.js';
import { WorkboardManager } from './workboard/workboard-manager.js';

export interface CoordinatorOptions {
  /** Absolute path to the project root (where .claude/workboard.md lives) */
  projectRoot: string;
  /** Unix socket path for the RPC server */
  socketPath?: string;
  /** Session task description shown in the workboard */
  task?: string;
  /** Enable HTTP gateway for remote access (default: disabled) */
  httpPort?: number;
  /** HTTP gateway bind address (default: '0.0.0.0') */
  httpHost?: string;
  /** Path to Studio static build for serving via HTTP gateway */
  httpStaticDir?: string;
}

/**
 * HarnessCoordinator — single entry point for harness-to-harness coordination.
 *
 * On start:
 *   1. Auto-detects installed AI harnesses and registers them
 *   2. Registers this session in the workboard
 *   3. Starts the RPC server
 *
 * On stop:
 *   1. Unregisters this session from the workboard
 *   2. Stops the RPC server
 *   3. Disposes all adapters
 */
export class HarnessCoordinator {
  private readonly registry = new HarnessRegistry();
  private rpcServer: RpcServer | null = null;
  private httpGateway: HttpGateway | null = null;
  private store: DaemonStore | null = null;
  private spawner: SpawnerService | null = null;
  private inference: InferenceService | null = null;
  private mergePipeline: MergePipeline | null = null;
  private ciFeedback: CIFeedback | null = null;
  private sessionId: string | null = null;
  private readonly workboard: WorkboardManager;

  constructor(private readonly options: CoordinatorOptions) {
    const workboardPath = join(options.projectRoot, '.claude', 'workboard.md');
    this.workboard = new WorkboardManager(workboardPath);
  }

  async start(): Promise<void> {
    // 1. Auto-detect harnesses
    await autoDetectHarnesses(this.registry);

    // 2. Register in workboard
    const type = detectSessionType();
    const state = this.workboard.read();
    const existingIds = state.agents.map((a) => a.id);
    this.sessionId = deriveSessionId(type, existingIds);

    const envLabels: Record<string, string> = {
      zed: 'Zed/ACP',
      cursor: 'Cursor',
      terminal: 'WSL/bash',
    };

    this.workboard.registerAgent({
      id: this.sessionId,
      env: envLabels[type] ?? type,
      started: `${new Date().toISOString().slice(0, 16)}Z`,
      task: this.options.task ?? 'Harness coordination active',
      files: '',
      updated: `${new Date().toISOString().slice(0, 16)}Z`,
    });

    // 3. Initialize PGlite daemon store
    const dataDir = join(process.env.HOME ?? '/tmp', '.local', 'share', 'revealui', 'harness.db');
    mkdirSync(dataDir, { recursive: true });
    this.store = new DaemonStore({ dataDir });
    await this.store.init();

    // 4. Start RPC server
    const socketPath =
      this.options.socketPath ??
      join(process.env.HOME ?? '/tmp', '.local', 'share', 'revealui', 'harness.sock');

    this.rpcServer = new RpcServer(this.registry, socketPath, this.store);
    this.rpcServer.setHealthCheck(() => this.healthCheck());

    // 4b. Wire agent spawner and inference engine services into RPC
    this.spawner = new SpawnerService();
    this.inference = new InferenceService();
    this.rpcServer.setSpawner(this.spawner);
    this.rpcServer.setInference(this.inference);

    // 4c. Wire merge pipeline and CI feedback into RPC
    this.mergePipeline = new MergePipeline(this.store, {
      repoRoot: this.options.projectRoot,
    });
    this.ciFeedback = new CIFeedback(this.store);
    this.rpcServer.setMergePipeline(this.mergePipeline);
    this.rpcServer.setCIFeedback(this.ciFeedback);

    await this.rpcServer.start();

    // 5. Optionally start HTTP gateway for remote access
    if (this.options.httpPort) {
      this.httpGateway = new HttpGateway({
        port: this.options.httpPort,
        host: this.options.httpHost ?? '0.0.0.0',
        staticDir: this.options.httpStaticDir,
        rpcDispatch: this.rpcServer,
        spawner: this.spawner,
      });
      await this.httpGateway.start();
    }
  }

  async stop(): Promise<void> {
    // Unregister from workboard
    if (this.sessionId) {
      this.workboard.unregisterAgent(this.sessionId);
      this.workboard.addLogEntry(
        this.sessionId,
        `Session ended — ${this.options.task ?? 'harness coordination'}`,
      );
    }

    // Stop HTTP gateway
    if (this.httpGateway) {
      await this.httpGateway.stop();
      this.httpGateway = null;
    }

    // Stop all spawned agent processes
    if (this.spawner) {
      await this.spawner.stopAll();
      this.spawner = null;
    }
    this.inference = null;
    this.mergePipeline = null;
    this.ciFeedback = null;

    // Stop RPC server
    if (this.rpcServer) {
      await this.rpcServer.stop();
      this.rpcServer = null;
    }

    // Close PGlite store
    if (this.store) {
      await this.store.close();
      this.store = null;
    }

    // Dispose all adapters
    await this.registry.disposeAll();
  }

  /** The registry of detected harnesses. Available after start(). */
  getRegistry(): HarnessRegistry {
    return this.registry;
  }

  /** The workboard manager. */
  getWorkboard(): WorkboardManager {
    return this.workboard;
  }

  /** The daemon persistent store (available after start()). */
  getStore(): DaemonStore | null {
    return this.store;
  }

  /** Register a custom adapter (must be called before start()). */
  registerAdapter(adapter: HarnessAdapter): void {
    this.registry.register(adapter);
  }

  /** The HTTP gateway (available after start() if httpPort was set). */
  getHttpGateway(): HttpGateway | null {
    return this.httpGateway;
  }

  /** Run a health check across all registered harnesses and the workboard. */
  async healthCheck(): Promise<HealthCheckResult> {
    const diagnostics: string[] = [];
    const StaleMs = 4 * 60 * 60 * 1000;

    // Check registered harnesses
    const allIds = this.registry.listAll();
    const registeredHarnesses = await Promise.all(
      allIds.map(async (harnessId) => {
        const adapter = this.registry.get(harnessId);
        let available = false;
        try {
          available = adapter ? await adapter.isAvailable() : false;
        } catch (err) {
          diagnostics.push(
            `${harnessId}: availability check failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (!available) diagnostics.push(`${harnessId}: not available`);
        return { harnessId, available };
      }),
    );

    // Check workboard
    let readable = false;
    let sessionCount = 0;
    const staleSessionIds: string[] = [];
    try {
      const state = this.workboard.read();
      readable = true;
      sessionCount = state.agents.length;
      const now = Date.now();
      for (const s of state.agents) {
        const ts = Date.parse(s.updated);
        if (!Number.isNaN(ts) && now - ts > StaleMs) {
          staleSessionIds.push(s.id);
        }
      }
      if (staleSessionIds.length > 0) {
        diagnostics.push(`Stale sessions: ${staleSessionIds.join(', ')}`);
      }
    } catch (err) {
      diagnostics.push(`Workboard unreadable: ${err instanceof Error ? err.message : String(err)}`);
    }

    const healthy =
      registeredHarnesses.some((h) => h.available) && readable && staleSessionIds.length === 0;

    return {
      healthy,
      timestamp: new Date().toISOString(),
      registeredHarnesses,
      workboard: { readable, sessionCount, staleSessionIds },
      diagnostics,
    };
  }
}
