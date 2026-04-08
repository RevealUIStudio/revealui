import type { ToolDefinition } from '../llm/providers/base.js';
import type { Tool, ToolResult } from './base.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters.toJSONSchema(), // Native Zod v4 method
      },
    }));
  }

  async execute(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` };
    }

    try {
      const validatedParams = tool.parameters.parse(params);
      return await tool.execute(validatedParams);
    } catch (error) {
      return {
        success: false,
        error: `Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
