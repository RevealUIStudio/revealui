/**
 * Skill Types
 *
 * Zod schemas and types for Agent Skills (skills.sh ecosystem).
 * Skills are instruction packages that agents can discover and use.
 */

import { z } from 'zod/v4';

/**
 * Allowed tools specification.
 * Format: "ToolName" or "ToolName(pattern:*)" for filtered access.
 */
export const AllowedToolSchema = z.union([
  z.string(), // Simple tool name like "Read"
  z.object({
    name: z.string(),
    filter: z.string().optional(), // e.g., "git:*" for Bash(git:*)
  }),
]);
export type AllowedTool = z.infer<typeof AllowedToolSchema>;

/**
 * Skill metadata from SKILL.md frontmatter.
 * This is the lightweight representation loaded at startup (~100 tokens).
 */
export const SkillMetadataSchema = z.object({
  /** Unique skill name (kebab-case) */
  name: z.string().regex(/^[a-z0-9-]+$/, 'Skill name must be kebab-case'),

  /** Human-readable description */
  description: z.string(),

  /** Version following semver */
  version: z.string().optional(),

  /** SPDX license identifier */
  license: z.string().optional(),

  /** Author or organization */
  author: z.string().optional(),

  /** Repository URL */
  repository: z.string().url().optional(),

  /** Skill tags for categorization */
  tags: z.array(z.string()).optional(),

  /** Compatible agent frameworks */
  compatibility: z
    .array(
      z.enum([
        'claude-code',
        'cursor',
        'windsurf',
        'cline',
        'copilot',
        'openai',
        'anthropic',
        'universal',
      ]),
    )
    .optional(),

  /** Allowed tools this skill can use */
  allowedTools: z.array(z.string()).optional(),

  /** Minimum required context window */
  minContextWindow: z.number().int().positive().optional(),

  /** Whether this skill requires human approval before actions */
  requiresApproval: z.boolean().optional(),
});
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

/**
 * Resource file within a skill package.
 */
export const SkillResourceSchema = z.object({
  /** Relative path within skill directory */
  path: z.string(),

  /** File type */
  type: z.enum(['script', 'reference', 'asset', 'template', 'schema']),

  /** File content (loaded on demand) */
  content: z.string().optional(),
});
export type SkillResource = z.infer<typeof SkillResourceSchema>;

/**
 * Source of a skill - where it was loaded from.
 */
export const SkillSourceSchema = z.enum(['github', 'local', 'vercel']);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

/**
 * Full skill object with instructions and resources.
 */
export const SkillSchema = z.object({
  /** Skill metadata from frontmatter */
  metadata: SkillMetadataSchema,

  /** Markdown instructions for the agent */
  instructions: z.string(),

  /** Source path where skill is installed */
  sourcePath: z.string(),

  /** Whether this is a project-local or global skill */
  scope: z.enum(['local', 'global']),

  /** Source type - where this skill came from */
  source: SkillSourceSchema.optional(),

  /** Original source identifier (e.g., GitHub URL, Vercel package name) */
  sourceIdentifier: z.string().optional(),

  /** Optional resources (scripts, references, assets) */
  resources: z.array(SkillResourceSchema).optional(),

  /** Embedding vector for semantic search */
  embedding: z.array(z.number()).optional(),

  /** When the skill was installed */
  installedAt: z.string().datetime().optional(),

  /** When the skill was last updated */
  updatedAt: z.string().datetime().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

/**
 * Skill activation context - information needed to determine which skills to activate.
 */
export const SkillActivationContextSchema = z.object({
  /** Current task description or user message */
  taskDescription: z.string().optional(),

  /** Explicit skill names requested (e.g., /skill-name) */
  explicitSkills: z.array(z.string()).optional(),

  /** Current file context (for file-type based activation) */
  currentFiles: z.array(z.string()).optional(),

  /** Project type hints */
  projectType: z.string().optional(),
});
export type SkillActivationContext = z.infer<typeof SkillActivationContextSchema>;

/**
 * Result of skill activation.
 */
export const SkillActivationResultSchema = z.object({
  /** Skills that were activated */
  activatedSkills: z.array(SkillSchema),

  /** Reason each skill was activated */
  activationReasons: z.record(
    z.string(),
    z.object({
      type: z.enum(['explicit', 'semantic', 'file-match', 'project-type']),
      score: z.number().optional(),
      reason: z.string().optional(),
    }),
  ),
});
export type SkillActivationResult = z.infer<typeof SkillActivationResultSchema>;

/**
 * Parsed allowed-tools specification.
 */
export interface ParsedAllowedTool {
  name: string;
  filter?: {
    pattern: string;
    type: 'prefix' | 'glob' | 'exact';
  };
}

/**
 * Parse an allowed-tools string like "Bash(git:*)" into structured form.
 */
export function parseAllowedTool(spec: string): ParsedAllowedTool {
  // Match patterns like "Bash(git:*)" or "Bash(npm install:*)" or simple "Read"
  const match = spec.match(/^(\w+)(?:\(([^)]+)\))?$/);
  if (!match) {
    throw new Error(`Invalid allowed-tool specification: ${spec}`);
  }

  const [, matchedName, filterSpec] = match;
  const name = matchedName as string;

  if (!filterSpec) {
    return { name };
  }

  // Determine filter type
  let type: 'prefix' | 'glob' | 'exact' = 'exact';
  let pattern = filterSpec;

  if (filterSpec.endsWith(':*')) {
    type = 'prefix';
    pattern = filterSpec.slice(0, -2);
  } else if (filterSpec.includes('*')) {
    type = 'glob';
  }

  return {
    name,
    filter: { pattern, type },
  };
}

/**
 * Check if a command matches an allowed-tool filter.
 */
export function matchesAllowedTool(
  toolName: string,
  command: string,
  allowed: ParsedAllowedTool,
): boolean {
  if (allowed.name !== toolName) {
    return false;
  }

  if (!allowed.filter) {
    return true;
  }

  switch (allowed.filter.type) {
    case 'prefix':
      return command.startsWith(allowed.filter.pattern);
    case 'exact':
      return command === allowed.filter.pattern;
    case 'glob': {
      // Simple glob matching - convert * to regex
      const regex = new RegExp(
        `^${allowed.filter.pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
      );
      return regex.test(command);
    }
    default:
      return false;
  }
}
