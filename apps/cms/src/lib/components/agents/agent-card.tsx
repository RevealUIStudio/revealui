'use client';

import type { A2AAgentCard } from '@revealui/contracts';
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
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">{card.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-400">v{card.version}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          active
        </span>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-sm text-zinc-400">{card.description}</p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5">
        {card.capabilities.streaming && <CapabilityBadge label="streaming" color="blue" />}
        {card.capabilities.pushNotifications && <CapabilityBadge label="push" color="purple" />}
        {card.authentication.schemes.map((scheme) => (
          <CapabilityBadge key={scheme} label={scheme} color="zinc" />
        ))}
      </div>

      {/* Skills */}
      {card.skills.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Skills ({card.skills.length})
          </p>
          <ul className="space-y-1">
            {card.skills.slice(0, 3).map((skill) => (
              <li key={skill.id} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                <span className="text-xs text-zinc-300 leading-relaxed">{skill.description}</span>
              </li>
            ))}
            {card.skills.length > 3 && (
              <li className="text-xs text-zinc-500">+{card.skills.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-1">
        <Link
          href={`/admin/agents/${agentId}`}
          className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
        >
          Test Agent
        </Link>
        <a
          href={card.url.replace('/a2a', `/.well-known/agents/${agentId}/agent.json`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
          title="View Agent Card JSON"
        >
          JSON
        </a>
      </div>
    </div>
  );
}

function CapabilityBadge({ label, color }: { label: string; color: 'blue' | 'purple' | 'zinc' }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    zinc: 'bg-zinc-700 text-zinc-300',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}>{label}</span>
  );
}
