/**
 * Tool Mapper
 *
 * Map allowed-tools between Vercel and RevealUI formats.
 */

/**
 * Vercel Skills CLI tool names.
 */
export const VERCEL_TOOLS = [
  'bash',
  'read',
  'write',
  'edit',
  'glob',
  'grep',
  'web-fetch',
  'web-search',
  'ask-user',
] as const;

export type VercelTool = (typeof VERCEL_TOOLS)[number];

/**
 * RevealUI tool names.
 */
export const REVEALUI_TOOLS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'AskUserQuestion',
] as const;

export type RevealUITool = (typeof REVEALUI_TOOLS)[number];

/**
 * Mapping from Vercel tool names to RevealUI tool names.
 */
export const VERCEL_TO_REVEALUI: Record<VercelTool, RevealUITool> = {
  bash: 'Bash',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',
  'web-fetch': 'WebFetch',
  'web-search': 'WebSearch',
  'ask-user': 'AskUserQuestion',
};

/**
 * Mapping from RevealUI tool names to Vercel tool names.
 */
export const REVEALUI_TO_VERCEL: Record<RevealUITool, VercelTool> = {
  Bash: 'bash',
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  Glob: 'glob',
  Grep: 'grep',
  WebFetch: 'web-fetch',
  WebSearch: 'web-search',
  AskUserQuestion: 'ask-user',
};

/**
 * Convert Vercel allowed-tools to RevealUI format.
 *
 * @param vercelTools - Array of Vercel tool specifications
 * @returns Array of RevealUI tool specifications
 */
export function mapVercelToolsToRevealUI(vercelTools: string[]): string[] {
  return vercelTools.map((tool) => {
    // Extract tool name and filter
    const match = tool.match(/^([^(]+)(\(.*\))?$/);
    if (!match) {
      return tool;
    }

    const [, toolName, filter] = match;
    const name = toolName?.trim().toLowerCase() as VercelTool;

    // Map to RevealUI tool name
    const mappedName = VERCEL_TO_REVEALUI[name] ?? capitalize(name);

    // Reconstruct with filter if present
    return filter ? `${mappedName}${filter}` : mappedName;
  });
}

/**
 * Convert RevealUI allowed-tools to Vercel format.
 *
 * @param revealuiTools - Array of RevealUI tool specifications
 * @returns Array of Vercel tool specifications
 */
export function mapRevealUIToolsToVercel(revealuiTools: string[]): string[] {
  return revealuiTools.map((tool) => {
    // Extract tool name and filter
    const match = tool.match(/^([^(]+)(\(.*\))?$/);
    if (!match) {
      return tool.toLowerCase();
    }

    const [, toolName, filter] = match;
    const name = toolName?.trim() as RevealUITool;

    // Map to Vercel tool name
    const mappedName = REVEALUI_TO_VERCEL[name] ?? toolName?.toLowerCase() ?? '';

    // Reconstruct with filter if present
    return filter ? `${mappedName}${filter}` : mappedName;
  });
}

/**
 * Check if a tool is supported by both Vercel and RevealUI.
 *
 * @param tool - Tool name (either format)
 * @returns true if supported
 */
export function isToolSupported(tool: string): boolean {
  const normalizedTool = tool
    .toLowerCase()
    .replace(/\(.*\)/, '')
    .trim();
  return (
    VERCEL_TOOLS.includes(normalizedTool as VercelTool) ||
    REVEALUI_TOOLS.some((t) => t.toLowerCase() === normalizedTool)
  );
}

/**
 * Capitalize first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse an allowed-tools string (space-separated) into array.
 *
 * Handles tool specifications like "bash(git:*) read write".
 *
 * @param toolsString - Space-separated tool specifications
 * @returns Array of tool specifications
 */
export function parseAllowedToolsString(toolsString: string): string[] {
  const tools: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of toolsString) {
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
 * Convert array of tool specifications to space-separated string.
 *
 * @param tools - Array of tool specifications
 * @returns Space-separated tool specifications
 */
export function formatAllowedToolsString(tools: string[]): string {
  return tools.join(' ');
}
