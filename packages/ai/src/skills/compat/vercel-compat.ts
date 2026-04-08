/**
 * Vercel Skills Compatibility Layer
 *
 * Ensures Vercel Skills work seamlessly with RevealUI's skill system.
 */

import type { Skill, SkillMetadata } from '../types.js';

/**
 * Check if a skill from Vercel is compatible with RevealUI.
 *
 * @param skill - Skill to check
 * @returns true if compatible, error message if not
 */
export function checkVercelCompatibility(skill: Skill): true | string {
  // Check if skill has required fields
  if (!skill.metadata.name) {
    return 'Skill must have a name';
  }

  if (!skill.metadata.description) {
    return 'Skill must have a description';
  }

  // Check compatibility field
  if (skill.metadata.compatibility) {
    const hasRevealUICompat =
      skill.metadata.compatibility.includes('universal') ||
      skill.metadata.compatibility.includes('claude-code') ||
      skill.metadata.compatibility.includes('anthropic');

    if (!hasRevealUICompat) {
      return `Skill is not compatible with RevealUI. Compatible with: ${skill.metadata.compatibility.join(', ')}`;
    }
  }

  return true;
}

/**
 * Normalize a Vercel skill to RevealUI format.
 *
 * Some Vercel skills may use different conventions or formats.
 * This function ensures they work with RevealUI's expectations.
 *
 * @param skill - Skill to normalize
 * @returns Normalized skill
 */
export function normalizeVercelSkill(skill: Skill): Skill {
  const normalized = { ...skill };

  // Ensure compatibility includes universal if not specified
  if (!normalized.metadata.compatibility) {
    normalized.metadata.compatibility = ['universal'];
  }

  // Normalize allowed-tools format
  // Vercel skills might use different tool names
  if (normalized.metadata.allowedTools) {
    normalized.metadata.allowedTools = normalized.metadata.allowedTools.map((tool) =>
      normalizeToolName(tool),
    );
  }

  return normalized;
}

/**
 * Map Vercel tool names to RevealUI tool names.
 */
const TOOL_NAME_MAP: Record<string, string> = {
  // Vercel Skills CLI uses these names
  bash: 'Bash',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',

  // Common variations
  'file-read': 'Read',
  'file-write': 'Write',
  'file-edit': 'Edit',
  shell: 'Bash',
  terminal: 'Bash',
};

/**
 * Normalize a tool name from Vercel format to RevealUI format.
 *
 * @param toolSpec - Tool specification (e.g., "bash(git:*)" or "read")
 * @returns Normalized tool specification
 */
function normalizeToolName(toolSpec: string): string {
  // Extract tool name and filter
  const match = toolSpec.match(/^([^(]+)(\(.*\))?$/);
  if (!match) {
    return toolSpec;
  }

  const [, toolName, filter] = match;
  const name = toolName?.trim().toLowerCase() ?? '';

  // Map to RevealUI tool name
  const mappedName = TOOL_NAME_MAP[name] ?? capitalize(name);

  // Reconstruct with filter if present
  return filter ? `${mappedName}${filter}` : mappedName;
}

/**
 * Capitalize first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert RevealUI skill metadata to Vercel format.
 *
 * Useful if we want to export RevealUI skills to the Vercel ecosystem.
 *
 * @param metadata - RevealUI skill metadata
 * @returns Vercel-compatible metadata
 */
export function toVercelFormat(metadata: SkillMetadata): Record<string, unknown> {
  const vercel: Record<string, unknown> = {
    name: metadata.name,
    description: metadata.description,
  };

  if (metadata.version) {
    vercel.version = metadata.version;
  }

  if (metadata.license) {
    vercel.license = metadata.license;
  }

  if (metadata.author) {
    vercel.author = metadata.author;
  }

  if (metadata.repository) {
    vercel.repository = metadata.repository;
  }

  if (metadata.tags) {
    vercel.tags = metadata.tags;
  }

  if (metadata.compatibility) {
    vercel.compatibility = metadata.compatibility;
  }

  // Convert allowedTools to Vercel format
  if (metadata.allowedTools) {
    vercel['allowed-tools'] = metadata.allowedTools.map((tool) => tool.toLowerCase()).join(' ');
  }

  return vercel;
}
