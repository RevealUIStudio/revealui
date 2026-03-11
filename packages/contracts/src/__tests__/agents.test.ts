import { describe, expect, it } from 'vitest';
import {
  // Schema version
  AGENT_SCHEMA_VERSION,
  // Agent Context
  AgentContextSchema,
  // Agent Memory
  AgentMemorySchema,
  ConversationMessageSchema,
  // Conversations
  ConversationSchema,
  createAgentContext,
  createAgentMemory,
  createConversation,
  createMessage,
  // Intents
  IntentSchema,
  IntentTypeSchema,
  MemorySourceSchema,
  MemoryTypeSchema,
  // Tools
  ToolDefinitionSchema,
  type ToolParameter,
  ToolParameterSchema,
} from '../agents/index.js';

describe('Agent Schemas', () => {
  describe('Constants', () => {
    it('should export schema version', () => {
      expect(AGENT_SCHEMA_VERSION).toBe(1);
    });
  });

  describe('Agent Context', () => {
    describe('AgentContextSchema', () => {
      it('should validate minimal context', () => {
        const context = {
          id: 'sess-1:agent-1',
          version: AGENT_SCHEMA_VERSION,
          sessionId: 'sess-1',
          agentId: 'agent-1',
          context: {},
          priority: 0.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const result = AgentContextSchema.safeParse(context);
        expect(result.success).toBe(true);
      });

      it('should reject missing required fields', () => {
        const context = {
          id: 'ctx-1',
          // Missing sessionId, agentId, etc.
        };
        const result = AgentContextSchema.safeParse(context);
        expect(result.success).toBe(false);
      });
    });

    describe('createAgentContext', () => {
      it('should create context with correct id format', () => {
        const context = createAgentContext('sess-1', 'agent-1');

        expect(context.id).toBe('sess-1:agent-1');
        expect(context.sessionId).toBe('sess-1');
        expect(context.agentId).toBe('agent-1');
        expect(context.version).toBe(AGENT_SCHEMA_VERSION);
        expect(context.context).toEqual({});
        expect(context.priority).toBe(0.5);
      });

      it('should accept initial context data', () => {
        const context = createAgentContext('sess-1', 'agent-1', {
          currentTask: 'editing',
          focusedBlock: 'block-123',
        });

        expect(context.context).toEqual({
          currentTask: 'editing',
          focusedBlock: 'block-123',
        });
      });

      it('should validate created context', () => {
        const context = createAgentContext('sess-1', 'agent-1');
        const result = AgentContextSchema.safeParse(context);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Agent Memory', () => {
    describe('MemoryTypeSchema', () => {
      it('should accept valid types', () => {
        // These are the actual enum values from the schema
        const types = [
          'fact',
          'preference',
          'decision',
          'feedback',
          'example',
          'correction',
          'skill',
          'warning',
        ];
        for (const type of types) {
          expect(MemoryTypeSchema.parse(type)).toBe(type);
        }
      });
    });

    describe('MemorySourceSchema', () => {
      it('should validate memory source', () => {
        // Confidence is required (has default in Zod output type)
        const source = {
          type: 'user',
          id: 'user-123',
          confidence: 0.9,
        };
        const result = MemorySourceSchema.safeParse(source);
        expect(result.success).toBe(true);
      });

      it('should accept all source types', () => {
        // Actual enum values: 'user', 'agent', 'system', 'external'
        const sourceTypes = ['user', 'agent', 'system', 'external'];
        for (const sourceType of sourceTypes) {
          const source = {
            type: sourceType,
            id: 'source-1',
            confidence: 1,
          };
          expect(MemorySourceSchema.safeParse(source).success).toBe(true);
        }
      });

      it('should accept optional context', () => {
        const source = {
          type: 'user',
          id: 'user-1',
          context: 'conversation about design',
          confidence: 0.8,
        };
        expect(MemorySourceSchema.safeParse(source).success).toBe(true);
      });
    });

    describe('createAgentMemory', () => {
      it('should create memory entry', () => {
        const source = {
          type: 'user' as const,
          id: 'user-1',
          confidence: 0.9,
        };
        const memory = createAgentMemory('mem-1', 'User prefers dark mode', 'preference', source);

        expect(memory.id).toBe('mem-1');
        expect(memory.content).toBe('User prefers dark mode');
        expect(memory.type).toBe('preference');
        expect(memory.source.type).toBe('user');
        expect(memory.metadata.importance).toBe(0.5);
        expect(memory.accessCount).toBe(0);
        expect(memory.verified).toBe(false);
      });

      it('should accept custom metadata', () => {
        const source = {
          type: 'agent' as const,
          id: 'agent-1',
          confidence: 1,
        };
        const memory = createAgentMemory('mem-1', 'Test content', 'fact', source, {
          importance: 0.9,
          tags: ['critical'],
        });

        expect(memory.metadata.importance).toBe(0.9);
        expect(memory.metadata.tags).toContain('critical');
      });

      it('should validate created memory', () => {
        const source = {
          type: 'system' as const,
          id: 'sys-1',
          confidence: 1,
        };
        const memory = createAgentMemory('mem-1', 'Test', 'fact', source);
        const result = AgentMemorySchema.safeParse(memory);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Conversations', () => {
    describe('ConversationMessageSchema', () => {
      it('should validate user message', () => {
        const message = {
          id: 'msg-1',
          role: 'user',
          content: 'Make the header bigger',
          timestamp: new Date().toISOString(),
        };
        const result = ConversationMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it('should validate assistant message', () => {
        const message = {
          id: 'msg-2',
          role: 'assistant',
          content: "I'll increase the header size.",
          timestamp: new Date().toISOString(),
        };
        const result = ConversationMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it('should validate system message', () => {
        const message = {
          id: 'msg-3',
          role: 'system',
          content: 'You are a helpful assistant.',
          timestamp: new Date().toISOString(),
        };
        const result = ConversationMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it('should validate tool message with data', () => {
        const message = {
          id: 'msg-4',
          role: 'tool',
          content: 'Block updated successfully',
          data: {
            toolId: 'updateBlock',
            result: { success: true },
          },
          timestamp: new Date().toISOString(),
        };
        const result = ConversationMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });
    });

    describe('createConversation', () => {
      it('should create conversation', () => {
        const conv = createConversation('conv-1', 'sess-1', 'user-1', 'agent-1');

        expect(conv.id).toBe('conv-1');
        expect(conv.sessionId).toBe('sess-1');
        expect(conv.userId).toBe('user-1');
        expect(conv.agentId).toBe('agent-1');
        expect(conv.messages).toEqual([]);
        expect(conv.status).toBe('active');
        expect(conv.version).toBe(AGENT_SCHEMA_VERSION);
      });

      it('should accept metadata', () => {
        const conv = createConversation('conv-1', 'sess-1', 'user-1', 'agent-1', {
          topic: 'Editing session',
          summary: 'Working on header design',
        });

        expect(conv.metadata?.topic).toBe('Editing session');
        expect(conv.metadata?.summary).toBe('Working on header design');
      });

      it('should validate created conversation', () => {
        const conv = createConversation('conv-1', 'sess-1', 'user-1', 'agent-1');
        const result = ConversationSchema.safeParse(conv);
        expect(result.success).toBe(true);
      });
    });

    describe('createMessage', () => {
      it('should create user message', () => {
        const msg = createMessage('msg-1', 'user', 'Hello!');

        expect(msg.id).toBe('msg-1');
        expect(msg.role).toBe('user');
        expect(msg.content).toBe('Hello!');
        expect(msg.timestamp).toBeDefined();
      });

      it('should create assistant message with data', () => {
        const msg = createMessage('msg-1', 'assistant', 'Done!', {
          toolCall: { name: 'updateBlock', params: {} },
        });

        expect(msg.role).toBe('assistant');
        expect(msg.data?.toolCall).toBeDefined();
      });

      it('should validate created message', () => {
        const msg = createMessage('msg-1', 'user', 'Test');
        const result = ConversationMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Intents', () => {
    describe('IntentTypeSchema', () => {
      it('should accept valid intent types', () => {
        // These are the actual enum values
        const types = [
          'create',
          'edit',
          'delete',
          'query',
          'navigate',
          'style',
          'configure',
          'publish',
          'undo',
          'redo',
          'help',
          'confirm',
          'cancel',
          'unknown',
        ];
        for (const type of types) {
          expect(IntentTypeSchema.parse(type)).toBe(type);
        }
      });
    });

    describe('IntentSchema', () => {
      it('should validate intent', () => {
        // Matching actual schema structure
        const intent = {
          raw: 'Make the button red',
          type: 'style',
          confidence: 0.95,
        };
        const result = IntentSchema.safeParse(intent);
        expect(result.success).toBe(true);
      });

      it('should validate intent with entities', () => {
        const intent = {
          raw: 'Make the button red',
          type: 'style',
          action: 'changeColor',
          entities: [
            {
              type: 'element',
              value: 'button',
              confidence: 0.9,
            },
            {
              type: 'color',
              value: 'red',
              confidence: 0.95,
              span: { start: 20, end: 23 },
            },
          ],
          confidence: 0.92,
        };
        const result = IntentSchema.safeParse(intent);
        expect(result.success).toBe(true);
      });

      it('should reject confidence out of range', () => {
        const intent = {
          raw: 'Test',
          type: 'edit',
          confidence: 1.5, // > 1
        };
        const result = IntentSchema.safeParse(intent);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('ToolParameterSchema', () => {
      it('should validate simple parameter', () => {
        const param: ToolParameter = {
          type: 'string',
          description: 'The block ID',
          required: true,
        };
        const result = ToolParameterSchema.safeParse(param);
        expect(result.success).toBe(true);
      });

      it('should validate enum parameter', () => {
        const param: ToolParameter = {
          type: 'string',
          description: 'Heading level',
          enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        };
        const result = ToolParameterSchema.safeParse(param);
        expect(result.success).toBe(true);
      });

      it('should validate nested object parameter', () => {
        const param: ToolParameter = {
          type: 'object',
          description: 'Block data',
          properties: {
            content: {
              type: 'string',
              description: 'Text content',
            },
            format: {
              type: 'string',
              description: 'Format',
              enum: ['plain', 'markdown', 'html'],
            },
          },
        };
        const result = ToolParameterSchema.safeParse(param);
        expect(result.success).toBe(true);
      });

      it('should validate array parameter with items', () => {
        const param: ToolParameter = {
          type: 'array',
          description: 'List of tags',
          items: {
            type: 'string',
            description: 'Tag name',
          },
        };
        const result = ToolParameterSchema.safeParse(param);
        expect(result.success).toBe(true);
      });

      it('should validate number constraints', () => {
        const param: ToolParameter = {
          type: 'number',
          description: 'Width in pixels',
          minimum: 0,
          maximum: 1920,
        };
        const result = ToolParameterSchema.safeParse(param);
        expect(result.success).toBe(true);
      });
    });

    describe('ToolDefinitionSchema', () => {
      it('should validate tool definition', () => {
        const tool = {
          name: 'updateBlockStyle',
          description: 'Updates the visual style of a content block on the page',
          parameters: {
            blockId: {
              type: 'string',
              description: 'The unique identifier of the block to update',
              required: true,
            },
            style: {
              type: 'object',
              description: 'Style properties to apply',
              properties: {
                backgroundColor: {
                  type: 'string',
                  description: 'Background color (hex or CSS color name)',
                },
              },
            },
          },
          returns: {
            type: 'Block',
            description: 'The updated block',
          },
          destructive: false,
          idempotent: true,
          category: 'editing',
        };
        const result = ToolDefinitionSchema.safeParse(tool);
        expect(result.success).toBe(true);
      });

      it('should reject tool name not starting with lowercase', () => {
        const tool = {
          name: 'UpdateBlock', // Should start with lowercase
          description: 'Updates a block on the page with new content',
          parameters: {},
        };
        const result = ToolDefinitionSchema.safeParse(tool);
        expect(result.success).toBe(false);
      });

      it('should reject description too short', () => {
        const tool = {
          name: 'update',
          description: 'Updates', // Too short (< 10 chars)
          parameters: {},
        };
        const result = ToolDefinitionSchema.safeParse(tool);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Integration', () => {
    it('should create a complete agent workflow', () => {
      // 1. Create context
      const context = createAgentContext('sess-1', 'agent-1', {
        focusedPage: 'page-1',
        currentTask: 'editing header',
      });
      expect(AgentContextSchema.safeParse(context).success).toBe(true);

      // 2. Create conversation
      const conv = createConversation('conv-1', 'sess-1', 'user-1', 'agent-1');
      expect(ConversationSchema.safeParse(conv).success).toBe(true);

      // 3. Create messages
      const userMsg = createMessage('msg-1', 'user', 'Make the header text larger');
      const assistantMsg = createMessage('msg-2', 'assistant', "I'll increase the header size.", {
        toolCall: {
          name: 'updateBlock',
          params: { blockId: 'header-1', data: { level: 'h1' } },
        },
      });

      // 4. Add messages to conversation
      conv.messages.push(userMsg, assistantMsg);
      expect(conv.messages).toHaveLength(2);
      expect(ConversationSchema.safeParse(conv).success).toBe(true);

      // 5. Store memory
      const source = {
        type: 'user' as const,
        id: 'user-1',
        context: 'conversation about typography',
        confidence: 0.9,
      };
      const memory = createAgentMemory(
        'mem-1',
        'User prefers larger header text',
        'preference',
        source,
        { importance: 0.7, tags: ['typography', 'preferences'] },
      );
      expect(AgentMemorySchema.safeParse(memory).success).toBe(true);
    });
  });
});
