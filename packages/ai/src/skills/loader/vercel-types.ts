/**
 * Vercel Skills Types
 *
 * Type definitions for interacting with the Vercel Skills ecosystem (skills.sh).
 */

import { z } from 'zod/v4';

/**
 * Vercel skill source specification.
 *
 * Formats supported:
 * - owner/repo - Install from GitHub via Vercel Skills
 * - owner/repo/path/to/skill - Install specific skill from monorepo
 * - @scope/package - Install from npm (future)
 */
export interface VercelSource {
  owner: string;
  repo: string;
  path?: string;
  ref?: string; // Branch, tag, or commit
}

/**
 * Parse a Vercel source string into components.
 *
 * @example
 * parseVercelSource("vercel-labs/agent-skills")
 * // { owner: "vercel-labs", repo: "agent-skills" }
 *
 * parseVercelSource("vercel-labs/agent-skills/skills/react-best-practices")
 * // { owner: "vercel-labs", repo: "agent-skills", path: "skills/react-best-practices" }
 */
export function parseVercelSource(source: string): VercelSource {
  // Handle @ref suffix for specific branch/tag
  let ref: string | undefined;
  let sourcePath = source;

  if (source.includes('@')) {
    const atIndex = source.lastIndexOf('@');
    ref = source.slice(atIndex + 1);
    sourcePath = source.slice(0, atIndex);
  }

  const parts = sourcePath.split('/');

  if (parts.length < 2) {
    throw new Error(`Invalid Vercel source: ${source}. Expected format: owner/repo[/path][@ref]`);
  }

  const owner = parts[0];
  const repo = parts[1];
  const pathParts = parts.slice(2);

  if (!(owner && repo)) {
    throw new Error(`Invalid Vercel source: ${source}. Expected format: owner/repo[/path][@ref]`);
  }

  return {
    owner,
    repo,
    path: pathParts.length > 0 ? pathParts.join('/') : undefined,
    ref,
  };
}

/**
 * Vercel Skills CLI installation options.
 */
export interface VercelCliOptions {
  /** Install globally or locally */
  global?: boolean;
  /** Target directory override */
  dir?: string;
  /** Force reinstall */
  force?: boolean;
  /** Specific version/ref to install */
  ref?: string;
}

/**
 * Result of npx skills command execution.
 */
export interface VercelCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  installPath?: string;
}

/**
 * Update information for a Vercel skill.
 */
export const UpdateInfoSchema = z.object({
  /** Whether an update is available */
  available: z.boolean(),

  /** Current installed version */
  currentVersion: z.string().optional(),

  /** Latest available version */
  latestVersion: z.string().optional(),

  /** Changes in the update */
  changelog: z.string().optional(),
});
export type UpdateInfo = z.infer<typeof UpdateInfoSchema>;
