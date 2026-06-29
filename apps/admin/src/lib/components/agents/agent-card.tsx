'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import { Badge, Card, LinkButton } from '@revealui/presentation';
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
    <Card className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{card.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">v{card.version}</p>
        </div>
        <Badge color="success">active</Badge>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-sm text-muted-foreground">{card.description}</p>

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
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Skills ({card.skills.length})
          </p>
          <ul className="space-y-1">
            {card.skills.slice(0, 3).map((skill) => (
              <li key={skill.id} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {skill.description}
                </span>
              </li>
            ))}
            {card.skills.length > 3 && (
              <li className="text-xs text-muted-foreground">+{card.skills.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-1">
        <LinkButton
          as={Link}
          href={`/agents/${agentId}`}
          variant="secondary"
          size="sm"
          className="flex-1 justify-center"
        >
          Test Agent
        </LinkButton>
        <LinkButton
          href={card.url.replace('/a2a', `/.well-known/agents/${agentId}/agent.json`)}
          external
          variant="secondary"
          size="sm"
          title="View Agent Card JSON"
        >
          JSON
        </LinkButton>
      </div>
    </Card>
  );
}
