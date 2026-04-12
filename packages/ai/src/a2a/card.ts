/**
 * A2A Agent Card Registry
 *
 * In-memory registry of AgentDefinitions. Generates A2A Agent Cards on demand
 * by mapping AgentDefinition → A2AAgentCard via @revealui/contracts mappers.
 *
 * Pre-seeded with the RevealUI platform agent ("The Creator") and the TicketAgent.
 */

import type { AgentDefinition } from '@revealui/contracts';
import { type A2AAgentCard, agentDefinitionToCard } from '@revealui/contracts';

// =============================================================================
// Built-in agent definitions
// =============================================================================

/** RevealUI platform meta-agent  -  "The Creator" */
const THE_CREATOR_DEF: AgentDefinition = {
  id: 'revealui-creator',
  version: 1,
  name: 'The Creator',
  description:
    'The RevealUI platform agent. Scaffolds new AI agents, manages agent lifecycles, ' +
    'orchestrates multi-agent workflows, and acts as the primary interface for AI capabilities ' +
    'on the RevealUI platform.',
  model: 'claude-opus-4-6',
  systemPrompt:
    'You are The Creator, the meta-agent for RevealUI. You design, configure, and deploy ' +
    'purpose-built AI agents for RevealUI users. You have access to agent scaffolding tools, ' +
    'the RevealUI admin, and the billing system.',
  tools: [
    {
      name: 'scaffoldAgent',
      description:
        'Scaffold a new AI agent from a template with name, capabilities, and system prompt',
      parameters: {
        name: { type: 'string', description: 'Agent name', required: true },
        template: {
          type: 'string',
          description: 'Agent template',
          required: true,
          enum: ['content', 'code', 'support', 'analytics'],
        },
        description: { type: 'string', description: 'Agent description', required: true },
        systemPrompt: { type: 'string', description: 'Agent system prompt', required: false },
      },
      destructive: false,
    },
    {
      name: 'listAgents',
      description: 'List all registered agents and their current status',
      parameters: {},
      destructive: false,
    },
    {
      name: 'deployAgent',
      description: 'Deploy a configured agent to the RevealUI platform',
      parameters: {
        agentId: { type: 'string', description: 'Agent ID to deploy', required: true },
      },
      destructive: false,
    },
    {
      name: 'retireAgent',
      description: 'Retire and deregister an agent from the platform',
      parameters: {
        agentId: { type: 'string', description: 'Agent ID to retire', required: true },
      },
      destructive: true,
    },
  ],
  capabilities: ['agent-scaffolding', 'orchestration', 'lifecycle-management'],
  temperature: 0.7,
  maxTokens: 4096,
  canDelegateToAgents: ['revealui-ticket-agent'],
};

/** RevealUI ticket / support agent */
const TICKET_AGENT_DEF: AgentDefinition = {
  id: 'revealui-ticket-agent',
  version: 1,
  name: 'Ticket Agent',
  description:
    'Handles support tickets, resolves user issues, and escalates when needed. ' +
    'Uses the RevealUI admin to create and update tickets.',
  model: 'claude-sonnet-4-6',
  systemPrompt:
    'You are the RevealUI Ticket Agent. You help users resolve issues by creating tickets, ' +
    'searching for solutions, and escalating complex problems to the support team.',
  tools: [
    {
      name: 'createTicket',
      description:
        'Create a new support ticket with title, description, priority, and board assignment',
      parameters: {
        title: { type: 'string', description: 'Ticket title', required: true },
        description: { type: 'string', description: 'Ticket description', required: true },
        priority: {
          type: 'string',
          description: 'Priority level',
          required: false,
          enum: ['low', 'medium', 'high', 'critical'],
        },
        boardId: { type: 'string', description: 'Board ID to assign ticket to', required: true },
      },
      destructive: false,
    },
    {
      name: 'searchTickets',
      description: 'Search existing tickets by keyword, status, or priority',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        status: {
          type: 'string',
          description: 'Filter by status',
          required: false,
          enum: ['open', 'in-progress', 'resolved', 'closed'],
        },
      },
      destructive: false,
    },
    {
      name: 'updateTicketStatus',
      description: 'Update the status of an existing ticket',
      parameters: {
        ticketId: { type: 'string', description: 'Ticket ID', required: true },
        status: {
          type: 'string',
          description: 'New status',
          required: true,
          enum: ['open', 'in-progress', 'resolved', 'closed'],
        },
        note: { type: 'string', description: 'Status update note', required: false },
      },
      destructive: false,
    },
  ],
  capabilities: ['ticket-management', 'search', 'escalation'],
  temperature: 0.3,
  maxTokens: 2048,
};

// =============================================================================
// Registry
// =============================================================================

class AgentCardRegistry {
  private readonly defs = new Map<string, AgentDefinition>();

  constructor() {
    this.register(THE_CREATOR_DEF);
    this.register(TICKET_AGENT_DEF);
  }

  register(def: AgentDefinition): void {
    this.defs.set(def.id, def);
  }

  unregister(agentId: string): boolean {
    return this.defs.delete(agentId);
  }

  update(agentId: string, patch: Partial<Omit<AgentDefinition, 'id' | 'version'>>): boolean {
    const existing = this.defs.get(agentId);
    if (!existing) return false;
    this.defs.set(agentId, { ...existing, ...patch });
    return true;
  }

  getDef(agentId: string): AgentDefinition | undefined {
    return this.defs.get(agentId);
  }

  getCard(agentId: string, baseUrl: string): A2AAgentCard | null {
    const def = this.defs.get(agentId);
    if (!def) return null;
    return agentDefinitionToCard(def, baseUrl);
  }

  listCards(baseUrl: string): A2AAgentCard[] {
    return Array.from(this.defs.values()).map((def) => agentDefinitionToCard(def, baseUrl));
  }

  listDefs(): AgentDefinition[] {
    return Array.from(this.defs.values());
  }

  has(agentId: string): boolean {
    return this.defs.has(agentId);
  }
}

/** Singleton registry  -  import and use directly */
export const agentCardRegistry = new AgentCardRegistry();

export type { AgentDefinition };
