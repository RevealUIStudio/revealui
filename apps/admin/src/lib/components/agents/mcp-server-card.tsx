'use client';

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

/**
 * Displays an MCP server and its available tools in the MCP UI panel.
 */
export function McpServerCard({ server }: McpServerCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    configured: 'bg-warning/15 text-warning-foreground',
    active: 'bg-success/10 text-success',
    unavailable: 'bg-error/10 text-error',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{server.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {server.packageName ?? server.remoteUrl ?? server.id}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[server.status]}`}
        >
          {server.status}
        </span>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground">{server.description}</p>

      {/* Required env vars */}
      {server.envRequired.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {server.envRequired.map((envVar) => (
            <span
              key={envVar}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {envVar}
            </span>
          ))}
        </div>
      )}

      {/* Tools toggle */}
      {server.tools.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/10"
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
          </button>

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
    </div>
  );
}
