/**
 * Terminal agent.spawn backend selection.
 *
 * The daemon wire label and model come from this catalog, which is tied to
 * the harness adapter registry (manager.json adapter ids) and to env config.
 * InferenceSnaps is the default. ClaudeCode is an explicit option.
 * A blank or unknown backend is rejected. There is no vendor fallback.
 *
 * The revdev OpenRouter US allowlist (revdev#513) is not called here. This
 * package has no daemon provider client, and the revdev manager adapter is a
 * pointer stub. Selecting "revdev" fails closed.
 */

import { ManagerSchema } from '../manager/schema.js';
import {
  DEFAULT_SNAPS_SNAP,
  SIGNED_PRODUCT_SNAP_IDS,
  type SignedProductSnapId,
} from '../server/inference-run-policy.js';

export const DEFAULT_TERMINAL_SPAWN_BACKEND = 'InferenceSnaps';

/** US-origin snap id. Same product default as inference-run-policy. */
export const DEFAULT_TERMINAL_SPAWN_MODEL: SignedProductSnapId = DEFAULT_SNAPS_SNAP;

/**
 * Groq catalog default (OpenAI gpt-oss). Lockstep with
 * packages/ai/src/llm/inference-route.ts GROQ_DEFAULT_MODEL.
 */
export const DEFAULT_GROQ_TERMINAL_MODEL = 'openai/gpt-oss-120b';

const GROQ_US_MODEL_PREFIX = 'openai/gpt-oss';

/** Random-routing id. Never a default and never accepted. */
const RANDOM_ROUTER_MODEL = 'openrouter/free';

/** Family markers for excluded-origin weights. Match is case-insensitive. */
const EXCLUDED_ORIGIN_MARKERS = ['qwen', 'deepseek', 'glm'] as const;

const UNWIRED_BACKENDS = new Set(['revdev', 'openrouter']);

export type TerminalSpawnErrorCode =
  | 'missing-backend'
  | 'unknown-backend'
  | 'missing-model'
  | 'model-not-allowlisted';

export class TerminalSpawnBackendError extends Error {
  readonly code: TerminalSpawnErrorCode;

  constructor(code: TerminalSpawnErrorCode, message: string) {
    super(message);
    this.name = 'TerminalSpawnBackendError';
    this.code = code;
  }
}

export interface ResolveTerminalSpawnInput {
  /** Request override. Blank rejects. Omit to read config. */
  backend?: string | null;
  /** Request override. Blank falls through to config, then the backend default. */
  model?: string | null;
  /** Env source. Defaults to process.env when omitted. */
  env?: NodeJS.ProcessEnv;
}

export interface TerminalSpawnSelection {
  backend: string;
  model: string;
  adapterId: string | null;
}

/** Live HarnessRegistry, or any map with the same get(id) lookup. */
export interface TerminalSpawnRegistry {
  get(id: string): unknown;
}

interface TerminalBackendDefinition {
  readonly backend: string;
  readonly adapterId: string | null;
  readonly vendorLocked: boolean;
  readonly defaultModel: string | null;
}

const BACKEND_DEFINITIONS: ReadonlyMap<string, TerminalBackendDefinition> = new Map([
  [
    'InferenceSnaps',
    {
      backend: 'InferenceSnaps',
      adapterId: 'revealui-agent',
      vendorLocked: false,
      defaultModel: DEFAULT_TERMINAL_SPAWN_MODEL,
    },
  ],
  [
    'Groq',
    {
      backend: 'Groq',
      adapterId: null,
      vendorLocked: false,
      defaultModel: DEFAULT_GROQ_TERMINAL_MODEL,
    },
  ],
  [
    'Ollama',
    {
      backend: 'Ollama',
      adapterId: null,
      vendorLocked: false,
      defaultModel: DEFAULT_TERMINAL_SPAWN_MODEL,
    },
  ],
  [
    'ClaudeCode',
    {
      backend: 'ClaudeCode',
      adapterId: 'claude-code',
      vendorLocked: true,
      defaultModel: null,
    },
  ],
]);

/** Lowercase alias to wire label. */
const BACKEND_BY_ALIAS: ReadonlyMap<string, string> = new Map([
  ['inferencesnaps', 'InferenceSnaps'],
  ['inference-snaps', 'InferenceSnaps'],
  ['snap', 'InferenceSnaps'],
  ['groq', 'Groq'],
  ['ollama', 'Ollama'],
  ['claudecode', 'ClaudeCode'],
  ['claude-code', 'ClaudeCode'],
  ['claude', 'ClaudeCode'],
  ['anthropic', 'ClaudeCode'],
]);

let cachedAdapterIds: ReadonlySet<string> | undefined;

function configuredAdapterIds(): ReadonlySet<string> {
  if (!cachedAdapterIds) {
    const parsed = ManagerSchema.parse({ name: 'terminal-spawn' });
    cachedAdapterIds = new Set(parsed.adapters.map((adapter) => adapter.id));
  }
  return cachedAdapterIds;
}

function normalizedModel(model: string): string {
  return model.trim().toLowerCase();
}

function isRandomRouterModel(model: string): boolean {
  return normalizedModel(model) === RANDOM_ROUTER_MODEL;
}

function hasExcludedOriginMarker(model: string): boolean {
  const id = normalizedModel(model);
  const slash = id.lastIndexOf('/');
  const leaf = slash === -1 ? id : id.slice(slash + 1);
  for (const marker of EXCLUDED_ORIGIN_MARKERS) {
    if (
      id === marker ||
      id.startsWith(`${marker}/`) ||
      id.startsWith(`${marker}-`) ||
      id.startsWith(`${marker}:`) ||
      id.startsWith(`${marker}.`)
    ) {
      return true;
    }
    if (
      leaf === marker ||
      leaf.startsWith(`${marker}-`) ||
      leaf.startsWith(`${marker}:`) ||
      leaf.startsWith(`${marker}.`)
    ) {
      return true;
    }
  }
  return false;
}

function isAllowlistedSnapModel(model: string): boolean {
  const id = normalizedModel(model);
  const snaps = [...SIGNED_PRODUCT_SNAP_IDS].sort((left, right) => right.length - left.length);
  for (const snap of snaps) {
    const snapId = snap.toLowerCase();
    if (id === snapId || id.startsWith(`${snapId}-`) || id.startsWith(`${snapId}:`)) {
      return true;
    }
  }
  return false;
}

function isAllowlistedGroqModel(model: string): boolean {
  const id = normalizedModel(model);
  return id === GROQ_US_MODEL_PREFIX || id.startsWith(`${GROQ_US_MODEL_PREFIX}-`);
}

function isAllowlistedForBackend(backend: string, model: string): boolean {
  if (backend === 'Groq') return isAllowlistedGroqModel(model);
  if (backend === 'InferenceSnaps' || backend === 'Ollama') return isAllowlistedSnapModel(model);
  return false;
}

/** True when this backend may use the model. Vendor backends still refuse excluded-origin ids. */
export function isTerminalSpawnModelAllowed(backend: string, model: string): boolean {
  if (isRandomRouterModel(model) || hasExcludedOriginMarker(model)) return false;
  const canonical = BACKEND_BY_ALIAS.get(backend.trim().toLowerCase());
  if (!canonical) return false;
  const definition = BACKEND_DEFINITIONS.get(canonical);
  if (!definition) return false;
  if (definition.vendorLocked) return true;
  return isAllowlistedForBackend(definition.backend, model);
}

export function listTerminalSpawnBackends(): readonly string[] {
  return [...BACKEND_DEFINITIONS.keys()];
}

type ExplicitRead = 'absent' | 'missing' | string;

function readExplicit(value: string | null | undefined): ExplicitRead {
  if (value === undefined) return 'absent';
  if (value === null) return 'missing';
  const trimmed = value.trim();
  if (trimmed === '') return 'missing';
  return trimmed;
}

function requireKnownBackend(raw: string): string {
  const trimmed = raw.trim();
  const lowered = trimmed.toLowerCase();
  if (UNWIRED_BACKENDS.has(lowered)) {
    throw new TerminalSpawnBackendError(
      'unknown-backend',
      `Terminal spawn backend "${trimmed}" is not wired. The revdev OpenRouter US allowlist is not called from this repo. Refusing to fall back to another vendor.`,
    );
  }
  const known = BACKEND_BY_ALIAS.get(lowered);
  if (!known) {
    throw new TerminalSpawnBackendError(
      'unknown-backend',
      `Unknown terminal spawn backend "${trimmed}". Registered backends: ${listTerminalSpawnBackends().join(', ')}.`,
    );
  }
  return known;
}

function missingBackend(): TerminalSpawnBackendError {
  return new TerminalSpawnBackendError(
    'missing-backend',
    'Terminal spawn backend is missing. Set TERMINAL_AGENT_BACKEND to a registered backend. Refusing to default to a vendor.',
  );
}

function selectBackend(requested: string | null | undefined, env: NodeJS.ProcessEnv): string {
  const fromRequest = readExplicit(requested);
  if (fromRequest === 'missing') throw missingBackend();
  if (fromRequest !== 'absent') return requireKnownBackend(fromRequest);

  if ('TERMINAL_AGENT_BACKEND' in env) {
    const fromConfig = readExplicit(env.TERMINAL_AGENT_BACKEND);
    if (fromConfig === 'missing' || fromConfig === 'absent') throw missingBackend();
    return requireKnownBackend(fromConfig);
  }

  const provider = env.LLM_PROVIDER?.trim() ?? '';
  if (provider !== '') return requireKnownBackend(provider);

  if ((env.INFERENCE_SNAPS_BASE_URL?.trim() ?? '') !== '') return 'InferenceSnaps';
  if ((env.GROQ_API_KEY?.trim() ?? '') !== '') return 'Groq';
  if ((env.OLLAMA_BASE_URL?.trim() ?? '') !== '') return 'Ollama';
  return DEFAULT_TERMINAL_SPAWN_BACKEND;
}

function firstNonBlank(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const trimmed = value.trim();
    if (trimmed !== '') return trimmed;
  }
  return null;
}

function selectModel(
  requested: string | null | undefined,
  env: NodeJS.ProcessEnv,
  definition: TerminalBackendDefinition,
): string {
  const model = firstNonBlank([
    requested,
    env.TERMINAL_AGENT_MODEL,
    env.LLM_MODEL,
    definition.defaultModel,
  ]);
  if (model === null) {
    throw new TerminalSpawnBackendError(
      'missing-model',
      `Terminal spawn backend "${definition.backend}" requires an explicit model. Refusing to invent a vendor default.`,
    );
  }
  return model;
}

function assertModelAllowed(definition: TerminalBackendDefinition, model: string): void {
  if (isRandomRouterModel(model) || hasExcludedOriginMarker(model)) {
    throw new TerminalSpawnBackendError(
      'model-not-allowlisted',
      `Terminal spawn model "${model}" is not on the US allowlist. Refusing excluded-origin and random-routing model ids.`,
    );
  }
  if (definition.vendorLocked) return;
  if (!isAllowlistedForBackend(definition.backend, model)) {
    throw new TerminalSpawnBackendError(
      'model-not-allowlisted',
      `Terminal spawn model "${model}" is not on the US allowlist for backend "${definition.backend}".`,
    );
  }
}

function adapterIsRegistered(
  adapterId: string,
  registry: TerminalSpawnRegistry | undefined,
): boolean {
  if (registry) return registry.get(adapterId) !== undefined;
  return configuredAdapterIds().has(adapterId);
}

/**
 * Resolve the daemon `agent.spawn` backend and model.
 *
 * Order for the backend: request, then TERMINAL_AGENT_BACKEND, then
 * LLM_PROVIDER, then the in-repo chain INFERENCE_SNAPS_BASE_URL, GROQ_API_KEY,
 * OLLAMA_BASE_URL, then InferenceSnaps. ANTHROPIC_API_KEY alone does not
 * select ClaudeCode.
 */
export function resolveTerminalSpawn(
  input: ResolveTerminalSpawnInput = {},
  registry?: TerminalSpawnRegistry,
): TerminalSpawnSelection {
  const env = input.env ?? process.env;
  const backend = selectBackend(input.backend, env);
  const definition = BACKEND_DEFINITIONS.get(backend);
  if (!definition) {
    throw new TerminalSpawnBackendError(
      'unknown-backend',
      `Unknown terminal spawn backend "${backend}".`,
    );
  }
  if (definition.adapterId && !adapterIsRegistered(definition.adapterId, registry)) {
    throw new TerminalSpawnBackendError(
      'missing-backend',
      `Terminal spawn backend "${definition.backend}" is missing from the harness adapter registry (adapter "${definition.adapterId}").`,
    );
  }
  const model = selectModel(input.model, env, definition);
  assertModelAllowed(definition, model);
  return {
    backend: definition.backend,
    model,
    adapterId: definition.adapterId,
  };
}
