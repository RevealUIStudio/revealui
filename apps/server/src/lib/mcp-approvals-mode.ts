/**
 * REVEALUI_MCP_APPROVALS_MODE = off (default) | shadow | enforce.
 * Unknown non-empty values fail closed to enforce.
 * Tests override the process env through configureMcpApprovalsMode.
 */

export const MCP_APPROVALS_MODES = ['off', 'shadow', 'enforce'] as const;

export type McpApprovalsMode = (typeof MCP_APPROVALS_MODES)[number];

const MODE_SET: ReadonlySet<string> = new Set(MCP_APPROVALS_MODES);

let override: McpApprovalsMode | null = null;

export function configureMcpApprovalsMode(mode: McpApprovalsMode | null): void {
  override = mode;
}

export function parseMcpApprovalsMode(value: string | undefined | null): McpApprovalsMode {
  if (value === undefined || value === null || value === '') return 'off';
  if (MODE_SET.has(value)) return value as McpApprovalsMode;
  return 'enforce';
}

export function currentMcpApprovalsMode(): McpApprovalsMode {
  if (override !== null) return override;
  return parseMcpApprovalsMode(process.env.REVEALUI_MCP_APPROVALS_MODE);
}
