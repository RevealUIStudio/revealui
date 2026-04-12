/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files to extract YAML frontmatter and markdown instructions.
 */

import { type SkillMetadata, SkillMetadataSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal YAML parser/stringifier  -  replaces the `yaml` package.
// Handles the flat key-value + block-sequence subset used in SKILL.md files.
// ---------------------------------------------------------------------------

function yamlParseScalar(s: string): unknown {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return s;
}

function yamlParseString(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function yamlParse(input: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = input.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i++] ?? '';
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();
    if (valuePart === '') {
      // Inline array: key: [a, b]  OR  block sequence (items follow indented with `- `)
      const peek = lines[i]?.trim() ?? '';
      if (peek.startsWith('[')) {
        // inline  -  handled below on next iteration; should not happen in this branch
      }
      const items: string[] = [];
      while (i < lines.length) {
        const next = lines[i]?.trim() ?? '';
        if (next.startsWith('- ')) {
          items.push(yamlParseString(next.slice(2).trim()));
          i++;
        } else if (next === '-') {
          items.push('');
          i++;
        } else {
          break;
        }
      }
      if (items.length > 0) result[key] = items;
    } else if (valuePart.startsWith('[') && valuePart.endsWith(']')) {
      result[key] = valuePart
        .slice(1, -1)
        .split(',')
        .map((s) => yamlParseString(s.trim()))
        .filter(Boolean);
    } else {
      result[key] = yamlParseScalar(valuePart);
    }
  }
  return result;
}

function yamlQuote(s: string): string {
  if (
    s === '' ||
    s === 'true' ||
    s === 'false' ||
    s === 'null' ||
    /[:#[\]{}&*!|>'"@`]/.test(s) ||
    /^\s|\s$/.test(s) ||
    /^[\d-]/.test(s)
  ) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function yamlStringify(obj: Record<string, unknown>, indent = 2): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`${pad}- ${typeof item === 'string' ? yamlQuote(item) : String(item)}`);
      }
    } else if (typeof value === 'string') {
      lines.push(`${key}: ${yamlQuote(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Result of parsing a SKILL.md file.
 */
export interface ParsedSkillMd {
  metadata: SkillMetadata;
  instructions: string;
  rawFrontmatter: string;
}

/**
 * Parse a SKILL.md file content into metadata and instructions.
 *
 * SKILL.md format:
 * ```
 * ---
 * name: skill-name
 * description: What this skill does
 * ---
 *
 * # Instructions
 *
 * Markdown content here...
 * ```
 *
 * @param content - Raw SKILL.md file content
 * @returns Parsed skill metadata and instructions
 * @throws Error if frontmatter is missing or invalid
 */
export function parseSkillMd(content: string): ParsedSkillMd {
  // Extract frontmatter using --- delimiters
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('SKILL.md must contain YAML frontmatter between --- delimiters');
  }

  const rawFrontmatter = frontmatterMatch[1] ?? '';
  const instructions = frontmatterMatch[2] ?? '';

  // Parse YAML
  let parsedYaml: Record<string, unknown>;
  try {
    parsedYaml = yamlParse(rawFrontmatter);
  } catch (error) {
    throw new Error(
      `Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Normalize allowed-tools field
  if (parsedYaml['allowed-tools'] && !parsedYaml.allowedTools) {
    parsedYaml.allowedTools = parsedYaml['allowed-tools'];
    parsedYaml['allowed-tools'] = undefined;
  }

  // Parse allowed-tools string format: "Bash(git:*) Read Write"
  if (typeof parsedYaml.allowedTools === 'string') {
    parsedYaml.allowedTools = parseAllowedToolsString(parsedYaml.allowedTools);
  }

  // Validate against schema
  const parseResult = SkillMetadataSchema.safeParse(parsedYaml);

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid skill metadata:\n${errors.join('\n')}`);
  }

  return {
    metadata: parseResult.data,
    instructions: instructions.trim(),
    rawFrontmatter,
  };
}

/**
 * Parse allowed-tools string format into array.
 *
 * Example: "Bash(git:*) Read Write(*.ts)" -> ["Bash(git:*)", "Read", "Write(*.ts)"]
 */
export function parseAllowedToolsString(spec: string): string[] {
  const tools: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of spec) {
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ' ' && parenDepth === 0) {
      if (current.trim()) {
        tools.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tools.push(current.trim());
  }

  return tools;
}

/**
 * Extract only the metadata from a SKILL.md file (lightweight parsing).
 * Used for loading skill listings without full content.
 *
 * @param content - Raw SKILL.md file content
 * @returns Just the metadata portion
 */
export function parseSkillMetadataOnly(content: string): SkillMetadata {
  const result = parseSkillMd(content);
  return result.metadata;
}

/**
 * Validate that a string is valid SKILL.md format.
 *
 * @param content - Content to validate
 * @returns true if valid, error message if invalid
 */
export function validateSkillMd(content: string): true | string {
  try {
    parseSkillMd(content);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Generate a SKILL.md file from metadata and instructions.
 *
 * @param metadata - Skill metadata
 * @param instructions - Markdown instructions
 * @returns SKILL.md file content
 */
export function generateSkillMd(metadata: SkillMetadata, instructions: string): string {
  const frontmatter = yamlStringify(metadata as unknown as Record<string, unknown>);
  return `---\n${frontmatter}---\n\n${instructions}`;
}
