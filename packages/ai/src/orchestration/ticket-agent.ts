/**
 * Ticket Agent Bridge
 *
 * Closes the loop between the ticketing system and the AI agent system.
 *
 * Flow:
 *   Ticket (title + description) → Task → Agent (CMS tools + ticket tools)
 *   → agentic loop → CMS mutations + ticket status updated + comment written
 *
 * Usage:
 *   const dispatcher = new TicketAgentDispatcher({ llmClient, apiClient, ticketClient })
 *   const result = await dispatcher.dispatch(ticket)
 */

import type { Database } from '@revealui/db/client';
import type { LLMClient } from '../llm/client.js';
import type { EpisodicMemory } from '../memory/stores/episodic-memory.js';
import type {
  CMSAPIClient,
  CMSToolsConfig,
  CollectionMetadata,
  GlobalMetadata,
} from '../tools/cms/factory.js';
import { createCMSTools } from '../tools/cms/factory.js';
import { createDocumentSummarizerTool } from '../tools/document-summarizer.js';
import type { TicketMutationClient } from '../tools/ticket-tools.js';
import { createTicketTools } from '../tools/ticket-tools.js';
import { webScraperTool } from '../tools/web/scraper.js';
import type { Agent, AgentResult, Task } from './agent.js';
import { AgentOrchestrator } from './orchestrator.js';

export interface TicketInput {
  id: string;
  title: string;
  /** Rich text or plain text description. Plain strings are used directly; objects are JSON-stringified. */
  description: unknown;
  type?: string;
  priority?: string;
}

export interface TicketAgentConfig {
  /** LLM client (Anthropic, OpenAI, etc.) */
  llmClient: LLMClient;

  /** CMS API client — used to inject into CMS tools */
  apiClient: CMSAPIClient;

  /** Ticket mutation client — used to update status and add comments */
  ticketClient: TicketMutationClient;

  /** Available CMS collections (optional, improves tool descriptions) */
  collections?: CollectionMetadata[];

  /** Available CMS globals (optional) */
  globals?: GlobalMetadata[];

  /**
   * Memory instance to share across dispatches (optional).
   * If omitted, each dispatch uses a no-op stub — the runtime does not
   * call agent.memory directly, so this is safe for stateless dispatch.
   */
  memory?: EpisodicMemory;

  /**
   * Database client — enables the document_summarize tool.
   * If omitted, the summarizer tool is not included in the agent's toolset.
   */
  db?: Database;

  /** Max iterations for the agentic loop (default: 10) */
  maxIterations?: number;

  /** Timeout in ms (default: 120_000) */
  timeout?: number;
}

/**
 * Converts a ticket's description field to a plain string the LLM can use.
 * Handles: string, Lexical/Slate rich text JSON objects, null, undefined.
 */
function descriptionToString(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (typeof description === 'object') {
    // Extract text nodes from a simple Lexical-style document
    try {
      const json = description as Record<string, unknown>;
      if (json.root && typeof json.root === 'object') {
        const root = json.root as { children?: unknown[] };
        const texts: string[] = [];
        const walk = (nodes: unknown[]): void => {
          for (const node of nodes) {
            const n = node as Record<string, unknown>;
            if (typeof n.text === 'string') texts.push(n.text);
            if (Array.isArray(n.children)) walk(n.children);
          }
        };
        if (Array.isArray(root.children)) walk(root.children);
        return texts.join(' ').trim();
      }
    } catch {
      // fall through
    }
    return JSON.stringify(description);
  }
  return String(description);
}

/**
 * Build the agent system prompt from a ticket.
 */
function buildInstructions(ticket: TicketInput): string {
  return `You are a RevealUI content agent. You have been assigned a ticket and must complete it.

Your job is to:
1. Understand the intent of the ticket
2. Use the available CMS tools to take the necessary actions (create, update, or delete content)
3. When your work is done, call add_ticket_comment to summarize what you did
4. Finally, call update_ticket_status with status="done"
5. If you cannot complete the task, call add_ticket_comment to explain why, then update_ticket_status with status="blocked"

Always prefer taking action over asking questions. If you are uncertain about details, make reasonable assumptions and document them in your comment.

Ticket: #${ticket.id}
Title: ${ticket.title}
Type: ${ticket.type ?? 'task'}
Priority: ${ticket.priority ?? 'medium'}
`.trim();
}

export class TicketAgentDispatcher {
  private config: TicketAgentConfig;
  private orchestrator: AgentOrchestrator;

  constructor(config: TicketAgentConfig) {
    this.config = config;
    this.orchestrator = new AgentOrchestrator({
      maxConcurrentAgents: 1,
      taskTimeout: config.timeout ?? 120_000,
      retryOnFailure: false,
    });
    this.orchestrator.setLLMClient(config.llmClient);
  }

  /**
   * Dispatch a ticket to the agent and await the result.
   *
   * The agent will:
   * - Receive the ticket as its task description
   * - Have access to all CMS tools (create/update/delete content, globals, media, users)
   * - Have access to ticket mutation tools (update status, add comment)
   * - Run the agentic loop until done or max iterations
   */
  async dispatch(ticket: TicketInput): Promise<AgentResult> {
    const { apiClient, ticketClient, collections, globals, memory: sharedMemory, db } = this.config;

    // Build tool set: CMS tools + ticket mutation tools + web scraper + optional summarizer
    const cmsConfig: CMSToolsConfig = { apiClient, collections, globals };
    const cmsTools = createCMSTools(cmsConfig);
    const ticketTools = createTicketTools(ticket.id, ticketClient);
    const extraTools = db
      ? [webScraperTool, createDocumentSummarizerTool(db, this.config.llmClient)]
      : [webScraperTool];
    const tools = [...cmsTools, ...ticketTools, ...extraTools];

    // The runtime does not call agent.memory — satisfy the interface with a stub when no
    // shared memory instance is provided. Cast is safe: only runtime touches this field.
    const memory = (sharedMemory ?? {}) as EpisodicMemory;

    const agent: Agent = {
      id: `ticket-agent-${ticket.id}`,
      name: 'Ticket Agent',
      instructions: buildInstructions(ticket),
      tools,
      memory,
      getContext() {
        return {
          agentId: `ticket-agent-${ticket.id}`,
          currentTask: {
            id: ticket.id,
            type: ticket.type ?? 'cms',
            description: descriptionToString(ticket.description),
          },
        };
      },
    };

    // Register the agent (fresh orchestrator per dispatch is fine for now)
    this.orchestrator.registerAgent(agent);

    const descriptionText = descriptionToString(ticket.description);
    const taskDescription = descriptionText
      ? `${ticket.title}\n\n${descriptionText}`
      : ticket.title;

    const task: Task = {
      id: ticket.id,
      type: ticket.type ?? 'cms',
      description: taskDescription,
      priority: ticket.priority === 'critical' ? 1 : ticket.priority === 'high' ? 2 : 3,
    };

    try {
      return await this.orchestrator.delegateTask(task, agent.id);
    } finally {
      // Clean up so this orchestrator can be reused or GC'd cleanly
      this.orchestrator.unregisterAgent(agent.id);
    }
  }
}
