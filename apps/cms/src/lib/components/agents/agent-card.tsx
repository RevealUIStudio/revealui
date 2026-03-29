'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import { Badge } from '@revealui/presentation/client';
import Link from 'next/link';

interface AgentCardProps {
  card: A2AAgentCard;
  /** The agent ID used in the registry (derived from card URL slug) */
  agentId: string;
}

/**
 * Displays an A2A Agent Card as a UI tile in the agents admin panel.
 */
export function AgentCard({ card, agentId }: AgentCardProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border p-5 transition-colors"
      style={{
        backgroundColor: 'var(--rvui-surface-1, oklch(0.18 0.006 225))',
        borderColor: 'var(--rvui-border-subtle, oklch(0.28 0.006 222 / 0.4))',
        borderRadius: 'var(--rvui-radius-lg, 16px)',
        transition:
          'border-color var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="truncate font-semibold"
            style={{ color: 'var(--rvui-text-0, oklch(0.95 0.002 210))' }}
          >
            {card.name}
          </h3>
          <p
            className="mt-0.5 text-xs"
            style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
          >
            v{card.version}
          </p>
        </div>
        <Badge color="emerald">active</Badge>
      </div>

      {/* Description */}
      <p
        className="line-clamp-2 text-sm"
        style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
      >
        {card.description}
      </p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5">
        {card.capabilities.streaming && <Badge color="blue">streaming</Badge>}
        {card.capabilities.pushNotifications && <Badge color="purple">push</Badge>}
        {card.authentication.schemes.map((scheme) => (
          <Badge key={scheme} color="zinc">
            {scheme}
          </Badge>
        ))}
      </div>

      {/* Skills */}
      {card.skills.length > 0 && (
        <div>
          <p
            className="mb-2 text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
          >
            Skills ({card.skills.length})
          </p>
          <ul className="space-y-1">
            {card.skills.slice(0, 3).map((skill) => (
              <li key={skill.id} className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
                />
                <span
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--rvui-text-1, oklch(0.75 0.01 215))' }}
                >
                  {skill.description}
                </span>
              </li>
            ))}
            {card.skills.length > 3 && (
              <li
                className="text-xs"
                style={{ color: 'var(--rvui-text-2, oklch(0.55 0.012 218))' }}
              >
                +{card.skills.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-1">
        <Link
          href={`/admin/agents/${agentId}`}
          className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--rvui-surface-2, oklch(0.22 0.008 222))',
            color: 'var(--rvui-text-1, oklch(0.75 0.01 215))',
            borderRadius: 'var(--rvui-radius-md, 10px)',
          }}
        >
          Test Agent
        </Link>
        <a
          href={card.url.replace('/a2a', `/.well-known/agents/${agentId}/agent.json`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--rvui-surface-2, oklch(0.22 0.008 222))',
            color: 'var(--rvui-text-1, oklch(0.75 0.01 215))',
            borderRadius: 'var(--rvui-radius-md, 10px)',
          }}
          title="View Agent Card JSON"
        >
          JSON
        </a>
      </div>
    </div>
  );
}
