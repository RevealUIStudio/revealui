'use client';

import { Badge, Button, Card } from '@revealui/presentation';
import { useState } from 'react';

export interface McpServerInfo {
  id: string;
  name: string;
  description: string;
  status: 'configured' | 'active' | 'unavailable';
  packageName?: string;
  remoteUrl?: string;
  envRequired: string[];
  tools: McpToolInfo[];
}

export interface McpToolInfo {
  name: string;
  description: string;
  parameterCount: number;
}

interface McpServerCardProps {
  server: McpServerInfo;
}

const STATUS_BADGE_COLOR = {
  configured: 'warning',
  active: 'success',
  unavailable: 'danger',
} as const satisfies Record<McpServerInfo['status'], 'warning' | 'success' | 'danger'>;

/**
 * Displays an MCP server and its available tools in the MCP UI panel.
 */
export function McpServerCard({ server }: McpServerCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{server.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {server.packageName ?? server.remoteUrl ?? server.id}
          </p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[server.status]}>{server.status}</Badge>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground">{server.description}</p>

      {/* Required env vars */}
      {server.envRequired.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {server.envRequired.map((envVar) => (
            <Badge key={envVar} color="muted" className="font-mono">
              {envVar}
            </Badge>
          ))}
        </div>
      )}

      {/* Tools toggle */}
      {server.tools.length > 0 && (
        <div className="mt-4">
          <Button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            appearance="ghost"
            variant="neutral"
            size="sm"
            className="flex w-full items-center justify-between"
            aria-expanded={expanded}
          >
            <span>{server.tools.length} tools</span>
            <svg
              aria-label={expanded ? 'Collapse tools' : 'Expand tools'}
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>

          {expanded && (
            <ul className="mt-2 space-y-1">
              {server.tools.map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {tool.name}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {tool.parameterCount}p
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
