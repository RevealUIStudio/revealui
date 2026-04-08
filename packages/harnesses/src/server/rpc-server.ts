import { existsSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { diffConfig, syncConfig } from '../config/config-sync.js';
import { findHarnessProcesses } from '../detection/process-detector.js';
import type { HarnessRegistry } from '../registry/harness-registry.js';
import type { InferenceService } from './inference-service.js';
import type { SpawnerService } from './spawner-service.js';
import type { DaemonStore } from '../storage/daemon-store.js';
import type { ConfigSyncDirection } from '../types/core.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ERR_PARSE = -32700;
const ERR_INVALID_PARAMS = -32602;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INTERNAL = -32603;

/**
 * JSON-RPC 2.0 server over a Unix domain socket.
 * Mirrors RpcServer from packages/editors.
 *
 * Methods:
 *   ping                      → { status: 'ok', pid }
 *   harness.list              → HarnessInfo[]
 *   harness.execute           → HarnessCommandResult
 *   harness.info              → HarnessInfo
 *   harness.listRunning       → HarnessProcessInfo[]
 *   harness.syncConfig        → ConfigSyncResult
 *   harness.diffConfig        → ConfigDiffEntry
 *   harness.health            → HealthCheckResult
 *   session.register          → AgentSession
 *   session.update            → AgentSession
 *   session.end               → { ok: true }
 *   session.list              → AgentSession[]
 *   session.history           → AgentSession[]
 *   mail.send                 → AgentMessage
 *   mail.broadcast            → { sent: number }
 *   mail.inbox                → AgentMessage[]
 *   mail.markRead             → { ok: true }
 *   files.reserve             → { success, holder? }
 *   files.check               → FileReservation | null
 *   files.release             → { released: number }
 *   files.list                → FileReservation[]
 *   tasks.create              → AgentTask
 *   tasks.claim               → { success, owner? }
 *   tasks.complete            → { ok: boolean }
 *   tasks.release             → { ok: boolean }
 *   tasks.list                → AgentTask[]
 *   events.log                → DaemonEvent
 *   events.recent             → DaemonEvent[]
 *   agent.spawn               → { sessionId: string }
 *   agent.stop                → { ok: true }
 *   agent.list                → AgentSessionInfo[]
 *   agent.remove              → { ok: true }
 *   inference.ollama.status   → OllamaStatus
 *   inference.ollama.models   → OllamaModel[]
 *   inference.ollama.pull     → ModelPullResult
 *   inference.ollama.delete   → { ok: true }
 *   inference.ollama.start    → { ok: true }
 *   inference.ollama.stop     → { ok: true }
 *   inference.bitnet.status   → BitNetStatus
 *   inference.snap.list       → SnapModel[]
 *   inference.snap.status     → SnapStatus
 *   inference.snap.install    → ModelPullResult
 *   inference.snap.remove     → { ok: true }
 */
export class RpcServer {
  private server = createServer();
  private healthCheckFn: (() => Promise<unknown>) | null = null;
  private spawner: SpawnerService | null = null;
  private inference: InferenceService | null = null;

  constructor(
    private readonly registry: HarnessRegistry,
    private readonly socketPath: string,
    private readonly store?: DaemonStore,
  ) {
    this.server.on('connection', (socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          this.handleLine(line.trim(), (response) => {
            socket.write(`${JSON.stringify(response)}\n`);
          });
        }
      });
    });
  }

  private handleLine(line: string, reply: (r: JsonRpcResponse) => void): void {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line) as JsonRpcRequest;
    } catch {
      reply({ jsonrpc: '2.0', id: null, error: { code: ERR_PARSE, message: 'Parse error' } });
      return;
    }

    this.dispatch(req)
      .then(reply)
      .catch((err) => {
        reply({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: ERR_INTERNAL, message: err instanceof Error ? err.message : String(err) },
        });
      });
  }

  private async dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = req;
    const p = (params ?? {}) as Record<string, unknown>;

    switch (method) {
      case 'harness.list': {
        const ids = await this.registry.listAvailable();
        const infos = await Promise.all(ids.map((id) => this.registry.get(id)?.getInfo()));
        return { jsonrpc: '2.0', id, result: infos };
      }

      case 'harness.info': {
        const harnessId = p.harnessId as string | undefined;
        if (!harnessId) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId required' },
          };
        }
        const adapter = this.registry.get(harnessId);
        if (!adapter) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: `Harness not found: ${harnessId}` },
          };
        }
        return { jsonrpc: '2.0', id, result: await adapter.getInfo() };
      }

      case 'harness.execute': {
        const harnessId = p.harnessId as string | undefined;
        const command = p.command as Record<string, unknown> | undefined;
        if (!(harnessId && command)) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId and command required' },
          };
        }
        const adapter = this.registry.get(harnessId);
        if (!adapter) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: `Harness not found: ${harnessId}` },
          };
        }
        const result = await adapter.execute(command as Parameters<typeof adapter.execute>[0]);
        return { jsonrpc: '2.0', id, result };
      }

      case 'harness.syncConfig': {
        const harnessId = p.harnessId as string | undefined;
        const direction = p.direction as ConfigSyncDirection | undefined;
        if (!(harnessId && direction)) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId and direction required' },
          };
        }
        return { jsonrpc: '2.0', id, result: syncConfig(harnessId, direction) };
      }

      case 'harness.diffConfig': {
        const harnessId = p.harnessId as string | undefined;
        if (!harnessId) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId required' },
          };
        }
        return { jsonrpc: '2.0', id, result: diffConfig(harnessId) };
      }

      case 'harness.listRunning': {
        const harnessId = p.harnessId as string | undefined;
        if (!harnessId) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId required' },
          };
        }
        const processes = await findHarnessProcesses(harnessId);
        return { jsonrpc: '2.0', id, result: processes };
      }

      case 'ping': {
        return { jsonrpc: '2.0', id, result: { status: 'ok', pid: process.pid } };
      }

      case 'harness.health': {
        if (!this.healthCheckFn) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INTERNAL, message: 'Health check not configured' },
          };
        }
        const health = await this.healthCheckFn();
        return { jsonrpc: '2.0', id, result: health };
      }

      // -----------------------------------------------------------------------
      // Session management (PGlite-backed)
      // -----------------------------------------------------------------------
      case 'session.register': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        const env = p.env as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const session = await this.store.registerSession({
          id: agentId,
          env: env ?? agentId,
          task: p.task as string | undefined,
          pid: p.pid as number | undefined,
        });
        return { jsonrpc: '2.0', id, result: { session } };
      }

      case 'session.update': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const session = await this.store.updateSession(agentId, {
          task: p.task as string | undefined,
          files: p.files as string | undefined,
        });
        return { jsonrpc: '2.0', id, result: session };
      }

      case 'session.end': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        await this.store.endSession(agentId, p.exitSummary as string | undefined);
        await this.store.releaseAllReservations(agentId);
        await this.store.logEvent({
          agentId,
          eventType: 'session-end',
          payload: { exitSummary: p.exitSummary },
        });
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      case 'session.list': {
        if (!this.store) return this.noStore(id);
        const sessions = await this.store.getActiveSessions();
        return { jsonrpc: '2.0', id, result: sessions };
      }

      case 'session.history': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const limit = (p.limit as number | undefined) ?? 10;
        const history = await this.store.getSessionHistory(agentId, limit);
        return { jsonrpc: '2.0', id, result: history };
      }

      // -----------------------------------------------------------------------
      // Inter-agent messaging (PGlite-backed)
      // -----------------------------------------------------------------------
      case 'mail.send': {
        if (!this.store) return this.noStore(id);
        const fromAgent = p.fromAgent as string | undefined;
        const toAgent = p.toAgent as string | undefined;
        const subject = p.subject as string | undefined;
        if (!(fromAgent && toAgent && subject)) {
          return this.missingParam(id, 'fromAgent, toAgent, subject');
        }
        const msg = await this.store.sendMessage({
          fromAgent,
          toAgent,
          subject,
          body: p.body as string | undefined,
        });
        return { jsonrpc: '2.0', id, result: msg };
      }

      case 'mail.broadcast': {
        if (!this.store) return this.noStore(id);
        const fromAgent = p.fromAgent as string | undefined;
        const subject = p.subject as string | undefined;
        if (!(fromAgent && subject)) return this.missingParam(id, 'fromAgent, subject');
        const sent = await this.store.broadcastMessage({
          fromAgent,
          subject,
          body: p.body as string | undefined,
        });
        return { jsonrpc: '2.0', id, result: { sent } };
      }

      case 'mail.inbox': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const unreadOnly = (p.unreadOnly as boolean | undefined) ?? true;
        const messages = await this.store.getInbox(agentId, unreadOnly);
        return { jsonrpc: '2.0', id, result: messages };
      }

      case 'mail.markRead': {
        if (!this.store) return this.noStore(id);
        const messageIds = p.messageIds as number[] | undefined;
        if (!messageIds) return this.missingParam(id, 'messageIds');
        await this.store.markRead(messageIds);
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      // -----------------------------------------------------------------------
      // File reservations (PGlite-backed)
      // -----------------------------------------------------------------------
      case 'files.reserve': {
        if (!this.store) return this.noStore(id);
        const filePath = p.filePath as string | undefined;
        const agentId = p.agentId as string | undefined;
        if (!(filePath && agentId)) return this.missingParam(id, 'filePath, agentId');
        const ttlSeconds = (p.ttlSeconds as number | undefined) ?? 3600;
        const reservation = await this.store.reserveFile({
          filePath,
          agentId,
          ttlSeconds,
          reason: p.reason as string | undefined,
        });
        return { jsonrpc: '2.0', id, result: reservation };
      }

      case 'files.check': {
        if (!this.store) return this.noStore(id);
        const filePath = p.filePath as string | undefined;
        if (!filePath) return this.missingParam(id, 'filePath');
        const reservation = await this.store.checkReservation(filePath);
        return { jsonrpc: '2.0', id, result: reservation };
      }

      case 'files.release': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const released = await this.store.releaseAllReservations(agentId);
        return { jsonrpc: '2.0', id, result: { released } };
      }

      case 'files.list': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        if (!agentId) return this.missingParam(id, 'agentId');
        const reservations = await this.store.getReservations(agentId);
        return { jsonrpc: '2.0', id, result: reservations };
      }

      // -----------------------------------------------------------------------
      // Tasks (PGlite-backed)
      // -----------------------------------------------------------------------
      case 'tasks.create': {
        if (!this.store) return this.noStore(id);
        const taskId = p.taskId as string | undefined;
        const description = p.description as string | undefined;
        if (!taskId) return this.missingParam(id, 'taskId');
        const task = await this.store.createTask({ id: taskId, description: description ?? '' });
        return { jsonrpc: '2.0', id, result: task };
      }

      case 'tasks.claim': {
        if (!this.store) return this.noStore(id);
        const taskId = p.taskId as string | undefined;
        const agentId = p.agentId as string | undefined;
        if (!(taskId && agentId)) return this.missingParam(id, 'taskId, agentId');
        const claim = await this.store.claimTask(taskId, agentId);
        return { jsonrpc: '2.0', id, result: claim };
      }

      case 'tasks.complete': {
        if (!this.store) return this.noStore(id);
        const taskId = p.taskId as string | undefined;
        const agentId = p.agentId as string | undefined;
        if (!(taskId && agentId)) return this.missingParam(id, 'taskId, agentId');
        const completed = await this.store.completeTask(taskId, agentId);
        return { jsonrpc: '2.0', id, result: { ok: completed } };
      }

      case 'tasks.release': {
        if (!this.store) return this.noStore(id);
        const taskId = p.taskId as string | undefined;
        const agentId = p.agentId as string | undefined;
        if (!(taskId && agentId)) return this.missingParam(id, 'taskId, agentId');
        const released = await this.store.releaseTask(taskId, agentId);
        return { jsonrpc: '2.0', id, result: { ok: released } };
      }

      case 'tasks.list': {
        if (!this.store) return this.noStore(id);
        const tasks = await this.store.listTasks({
          status: p.status as string | undefined,
          owner: p.owner as string | undefined,
        });
        return { jsonrpc: '2.0', id, result: tasks };
      }

      // -----------------------------------------------------------------------
      // Events (PGlite-backed)
      // -----------------------------------------------------------------------
      case 'events.log': {
        if (!this.store) return this.noStore(id);
        const agentId = p.agentId as string | undefined;
        const eventType = p.eventType as string | undefined;
        if (!(agentId && eventType)) return this.missingParam(id, 'agentId, eventType');
        const event = await this.store.logEvent({
          agentId,
          eventType,
          payload: p.payload as Record<string, unknown> | undefined,
        });
        return { jsonrpc: '2.0', id, result: event };
      }

      case 'events.recent': {
        if (!this.store) return this.noStore(id);
        const limit = (p.limit as number | undefined) ?? 50;
        const events = await this.store.getRecentEvents(limit);
        return { jsonrpc: '2.0', id, result: events };
      }

      // -----------------------------------------------------------------------
      // Agent spawner (process management)
      // -----------------------------------------------------------------------
      case 'agent.spawn': {
        if (!this.spawner) return this.noService(id, 'spawner');
        const name = p.name as string | undefined;
        const backend = p.backend as string | undefined;
        const model = p.model as string | undefined;
        const prompt = p.prompt as string | undefined;
        if (!(name && backend && model && prompt)) {
          return this.missingParam(id, 'name, backend, model, prompt');
        }
        const sessionId = this.spawner.spawn(
          name,
          backend as 'Snap' | 'BitNet' | 'Ollama',
          model,
          prompt,
        );
        return { jsonrpc: '2.0', id, result: { sessionId } };
      }

      case 'agent.stop': {
        if (!this.spawner) return this.noService(id, 'spawner');
        const sessionId = p.sessionId as string | undefined;
        if (!sessionId) return this.missingParam(id, 'sessionId');
        this.spawner.stop(sessionId);
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      case 'agent.list': {
        if (!this.spawner) return this.noService(id, 'spawner');
        return { jsonrpc: '2.0', id, result: this.spawner.list() };
      }

      case 'agent.remove': {
        if (!this.spawner) return this.noService(id, 'spawner');
        const sessionId = p.sessionId as string | undefined;
        if (!sessionId) return this.missingParam(id, 'sessionId');
        this.spawner.remove(sessionId);
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      // -----------------------------------------------------------------------
      // Inference management (Ollama, BitNet, Snaps)
      // -----------------------------------------------------------------------
      case 'inference.ollama.status': {
        if (!this.inference) return this.noService(id, 'inference');
        return { jsonrpc: '2.0', id, result: await this.inference.ollamaStatus() };
      }

      case 'inference.ollama.models': {
        if (!this.inference) return this.noService(id, 'inference');
        return { jsonrpc: '2.0', id, result: await this.inference.ollamaModels() };
      }

      case 'inference.ollama.pull': {
        if (!this.inference) return this.noService(id, 'inference');
        const modelName = p.modelName as string | undefined;
        if (!modelName) return this.missingParam(id, 'modelName');
        return { jsonrpc: '2.0', id, result: await this.inference.ollamaPull(modelName) };
      }

      case 'inference.ollama.delete': {
        if (!this.inference) return this.noService(id, 'inference');
        const modelName = p.modelName as string | undefined;
        if (!modelName) return this.missingParam(id, 'modelName');
        await this.inference.ollamaDelete(modelName);
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      case 'inference.ollama.start': {
        if (!this.inference) return this.noService(id, 'inference');
        await this.inference.ollamaStart();
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      case 'inference.ollama.stop': {
        if (!this.inference) return this.noService(id, 'inference');
        await this.inference.ollamaStop();
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      case 'inference.bitnet.status': {
        if (!this.inference) return this.noService(id, 'inference');
        return { jsonrpc: '2.0', id, result: await this.inference.bitnetStatus() };
      }

      case 'inference.snap.list': {
        if (!this.inference) return this.noService(id, 'inference');
        return { jsonrpc: '2.0', id, result: await this.inference.snapList() };
      }

      case 'inference.snap.status': {
        if (!this.inference) return this.noService(id, 'inference');
        const snapName = p.snapName as string | undefined;
        if (!snapName) return this.missingParam(id, 'snapName');
        return { jsonrpc: '2.0', id, result: await this.inference.snapStatus(snapName) };
      }

      case 'inference.snap.install': {
        if (!this.inference) return this.noService(id, 'inference');
        const snapName = p.snapName as string | undefined;
        if (!snapName) return this.missingParam(id, 'snapName');
        return { jsonrpc: '2.0', id, result: await this.inference.snapInstall(snapName) };
      }

      case 'inference.snap.remove': {
        if (!this.inference) return this.noService(id, 'inference');
        const snapName = p.snapName as string | undefined;
        if (!snapName) return this.missingParam(id, 'snapName');
        await this.inference.snapRemove(snapName);
        return { jsonrpc: '2.0', id, result: { ok: true } };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: ERR_METHOD_NOT_FOUND, message: `Method not found: ${method}` },
        };
    }
  }

  /** Helper: store not configured error. */
  private noStore(id: number | string | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: ERR_INTERNAL, message: 'Daemon store not initialized' },
    };
  }

  /** Helper: missing parameter error. */
  private missingParam(id: number | string | null, param: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: ERR_INVALID_PARAMS, message: `Missing required parameter: ${param}` },
    };
  }

  /** Helper: service not configured error. */
  private noService(id: number | string | null, service: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: ERR_INTERNAL, message: `${service} service not initialized` },
    };
  }

  /**
   * Dispatch an HTTP request body (JSON-RPC) and call the reply callback.
   * Used by HttpGateway to proxy requests without going through a socket.
   */
  dispatchHttp(body: string, reply: (response: JsonRpcResponse) => void): void {
    this.handleLine(body.trim(), reply);
  }

  /** Set the health check function (called by coordinator after construction). */
  setHealthCheck(fn: () => Promise<unknown>): void {
    this.healthCheckFn = fn;
  }

  /** Attach the spawner service (called by coordinator after construction). */
  setSpawner(spawner: SpawnerService): void {
    this.spawner = spawner;
  }

  /** Attach the inference service (called by coordinator after construction). */
  setInference(inference: InferenceService): void {
    this.inference = inference;
  }

  /** Get the spawner service (used by HTTP gateway for SSE). */
  getSpawner(): SpawnerService | null {
    return this.spawner;
  }

  start(): Promise<void> {
    // Clean up stale socket from a previous crash
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }
    return new Promise((resolve, reject) => {
      this.server.listen(this.socketPath, () => resolve());
      this.server.once('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
