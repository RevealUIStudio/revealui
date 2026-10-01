/**
 * GAP-293 Phase C — run a native workflow skill through AgentRuntime.
 *
 * Extends RevealUIAgentAdapter's lazy @revealui/ai import. Tools are the
 * existing coding suite filtered to SKILL.md allowed-tools (no write/git).
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SkillCatalogEntry } from './skill-catalog.js';
import {
  buildSkillInvokeRequest,
  mapNativeToolsToCodingInclude,
  SKILL_INVOKE_MAX_TOOL_ROUNDS,
  type SkillInvokeRequest,
  type SkillSuitabilityAssessment,
  skillInvokeTimeoutMs,
} from './skill-invoke.js';

export interface RunNativeSkillInvokeOptions {
  skillId: string;
  catalog: SkillCatalogEntry[];
  projectRoot: string;
  revskillsRoot?: string;
  assessment?: SkillSuitabilityAssessment;
  validateOutput?: (text: string) => { valid: boolean; detail: string };
}

export interface RunNativeSkillInvokeResult {
  skillId: string;
  model: string;
  skillSha256?: string;
  text: string;
  ran: boolean;
  toolsExecuted: boolean;
  toolTrace: Array<{ name: string }>;
  executionStatus: 'not-started' | 'completed' | 'failed';
  outputValidation: 'unverified' | 'valid' | 'invalid';
  suitability: 'assessed' | 'unverified';
  toolsCompleted: number;
  toolsSucceeded: number;
  validationDetail?: string;
  error?: string;
}

function adapterHomePaths(revskillsRoot?: string): string[] {
  const home = homedir();
  const paths = [
    join(home, '.claude'),
    join(home, '.grok'),
    join(home, '.cursor'),
    join(home, 'revealfleet'),
  ];
  if (revskillsRoot && revskillsRoot.length > 0) paths.push(revskillsRoot);
  return paths;
}

export async function runNativeSkillInvoke(
  options: RunNativeSkillInvokeOptions,
): Promise<RunNativeSkillInvokeResult> {
  const prepared = buildSkillInvokeRequest(options.skillId, options.catalog, options.assessment);
  if ('error' in prepared || prepared.suitability !== 'assessed') {
    return {
      skillId: options.skillId,
      model: '',
      text: '',
      ran: false,
      toolsExecuted: false,
      toolTrace: [],
      executionStatus: 'not-started',
      outputValidation: 'unverified',
      suitability: 'unverified',
      toolsCompleted: 0,
      toolsSucceeded: 0,
      error:
        'error' in prepared
          ? prepared.error
          : 'Assess the skill inputs, outputs, limitations, and authorized tools before execution.',
    };
  }
  return runPreparedSkillInvoke(prepared, options);
}

async function runPreparedSkillInvoke(
  prepared: SkillInvokeRequest,
  options: RunNativeSkillInvokeOptions,
): Promise<RunNativeSkillInvokeResult> {
  const aiRuntimePath = '@revealui/ai/orchestration/streaming-runtime';
  const aiClientPath = '@revealui/ai/llm/client';
  const aiToolsPath = '@revealui/ai/tools/coding';

  let runtimeMod: Record<string, unknown>;
  let clientMod: Record<string, unknown>;
  let toolsMod: Record<string, unknown>;
  try {
    [runtimeMod, clientMod, toolsMod] = (await Promise.all([
      import(aiRuntimePath),
      import(aiClientPath),
      import(aiToolsPath),
    ])) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
  } catch {
    return {
      skillId: prepared.skillId,
      model: prepared.model,
      skillSha256: prepared.skillSha256,
      text: '',
      ran: false,
      toolsExecuted: false,
      toolTrace: [],
      executionStatus: 'not-started',
      outputValidation: 'unverified',
      suitability: prepared.suitability,
      toolsCompleted: 0,
      toolsSucceeded: 0,
      error:
        '@revealui/ai is not installed. Install it next to @revealui/harnesses (optionalDependency).',
    };
  }

  const StreamingAgentRuntime = runtimeMod.StreamingAgentRuntime as new (config: {
    maxIterations?: number;
    timeout?: number;
  }) => {
    streamTask(
      agent: unknown,
      task: unknown,
      llmClient: unknown,
    ): AsyncGenerator<{
      type: string;
      content?: string;
      toolCall?: { name: string };
      toolResult?: { content?: string; success?: boolean };
      error?: string;
    }>;
    cleanup(): Promise<void>;
  };

  const createCodingTools = toolsMod.createCodingTools as (config: {
    projectRoot: string;
    allowedPaths?: string[];
    include?: string[];
  }) => Array<{ name: string; execute: (params: unknown) => Promise<unknown> }>;

  const include = mapNativeToolsToCodingInclude(prepared.allowedTools);
  const rawTools =
    include.length > 0
      ? createCodingTools({
          projectRoot: options.projectRoot,
          allowedPaths: adapterHomePaths(options.revskillsRoot),
          include,
        })
      : [];

  const nameByCoding: Record<string, string> = {
    file_read: 'Read',
    file_grep: 'Grep',
    file_glob: 'Glob',
    shell_exec: 'Bash',
  };
  const tools = rawTools.map((tool) => ({
    ...tool,
    name: nameByCoding[tool.name] ?? tool.name,
  }));

  const createLLMClientFromEnv = clientMod.createLLMClientFromEnv as () => unknown;
  const llmClient = createLLMClientFromEnv();

  const agent = {
    id: 'revealui-native-skill',
    name: prepared.skillId,
    instructions: prepared.system,
    tools,
    config: {},
    getContext: () => ({
      projectRoot: options.projectRoot,
      workingDirectory: options.projectRoot,
    }),
  };
  const task = {
    id: `skill-${prepared.skillId}-${String(Date.now())}`,
    type: 'native-skill',
    description: prepared.user,
  };

  const timeout = skillInvokeTimeoutMs(prepared.system, prepared.user);
  const runtime = new StreamingAgentRuntime({
    maxIterations: SKILL_INVOKE_MAX_TOOL_ROUNDS,
    timeout,
  });

  try {
    return await collectSkillInvokeOutput(
      runtime.streamTask(agent, task, llmClient),
      prepared,
      options.validateOutput,
    );
  } finally {
    await runtime.cleanup();
  }
}

/** Separate observed execution from caller-defined output checks and factual task success. */
export async function collectSkillInvokeOutput(
  stream: AsyncIterable<{
    type: string;
    content?: string;
    toolCall?: { name: string };
    toolResult?: { success?: boolean };
    error?: string;
  }>,
  prepared: Pick<SkillInvokeRequest, 'skillId' | 'model' | 'skillSha256' | 'suitability'>,
  validateOutput?: RunNativeSkillInvokeOptions['validateOutput'],
): Promise<RunNativeSkillInvokeResult> {
  const outputParts: string[] = [];
  const toolTrace: Array<{ name: string }> = [];
  let toolsCompleted = 0;
  let toolsSucceeded = 0;
  let completed = false;
  let error: string | undefined;
  try {
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.content) outputParts.push(chunk.content);
      if (chunk.type === 'tool_call_start' && chunk.toolCall?.name)
        toolTrace.push({ name: chunk.toolCall.name });
      if (chunk.type === 'tool_call_result') {
        toolsCompleted += 1;
        if (chunk.toolResult?.success === true) toolsSucceeded += 1;
      }
      if (chunk.type === 'error') error = chunk.error || 'Skill execution failed';
      if (chunk.type === 'done') completed = true;
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  if (!(completed || error)) error = 'Skill stream ended without a completion event';
  const executionStatus = completed && !error ? 'completed' : 'failed';
  const text = outputParts.join('\n');
  let outputValidation: RunNativeSkillInvokeResult['outputValidation'] = 'unverified';
  let validationDetail: string | undefined;
  if (!error && validateOutput) {
    try {
      const verdict = validateOutput(text);
      outputValidation = verdict.valid ? 'valid' : 'invalid';
      validationDetail = verdict.detail;
      if (!verdict.valid) error = `Skill output failed validation: ${verdict.detail}`;
    } catch (cause) {
      outputValidation = 'invalid';
      error = `Skill output validator failed: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  }
  return {
    skillId: prepared.skillId,
    model: prepared.model,
    skillSha256: prepared.skillSha256,
    suitability: prepared.suitability,
    text,
    ran: true,
    toolsExecuted: toolsCompleted > 0,
    toolTrace,
    toolsCompleted,
    toolsSucceeded,
    executionStatus,
    outputValidation,
    ...(validationDetail ? { validationDetail } : {}),
    ...(error ? { error } : {}),
  };
}
