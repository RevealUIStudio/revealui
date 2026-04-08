/**
 * CMS Global Tools
 * Tools for managing global content (Header, Footer, Settings)
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';

/**
 * Tool: List all globals
 * Returns available global configurations
 */
export const listGlobalsTool: Tool = {
  name: 'list_globals',
  description:
    'Get a list of all available CMS globals. Globals are site-wide settings like Header, Footer, and Settings.',
  parameters: z.object({}),

  async execute(): Promise<ToolResult> {
    try {
      // This will be injected with RevealUI config at runtime
      const globals = [
        { slug: 'header', label: 'Header', description: 'Site header and navigation' },
        { slug: 'footer', label: 'Footer', description: 'Site footer content' },
        { slug: 'settings', label: 'Settings', description: 'Global site settings' },
      ];

      return {
        success: true,
        data: {
          globals,
          count: globals.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list globals: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Get a global by slug
 * Retrieve global configuration data
 */
export const getGlobalTool: Tool = {
  name: 'get_global',
  description:
    'Get the current configuration of a CMS global. Use this to see the current state before updating (e.g., current header navigation items).',
  parameters: z.object({
    slug: z.string().describe('The global slug (e.g., "header", "footer", "settings")'),
    depth: z.number().optional().describe('Depth of populated relationships (default: 0, max: 10)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { slug: _slug, depth: _depth = 0 } = params as { slug: string; depth?: number };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to get global: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Update a global
 * Modify global configuration
 */
export const updateGlobalTool: Tool = {
  name: 'update_global',
  description:
    'Update a CMS global configuration. Use this to modify site-wide settings like header navigation, footer links, or global settings. Common uses:\n- Add/remove navigation links in header\n- Update footer content\n- Change site-wide settings\n\nExample for header navigation:\n{\n  "slug": "header",\n  "data": {\n    "navItems": [\n      {"link": {"type": "custom", "label": "Home", "url": "/"}},\n      {"link": {"type": "custom", "label": "About", "url": "/about"}}\n    ]\n  }\n}',
  parameters: z.object({
    slug: z.string().describe('The global slug (e.g., "header", "footer", "settings")'),
    data: z
      .record(z.string(), z.unknown())
      .describe(
        'The global data to update as key-value pairs. For header/footer, this typically includes:\n' +
          '- navItems: Array of navigation items\n' +
          '- Each navItem has a "link" object with type, label, url, and optional newTab\n' +
          'Example: {navItems: [{link: {type: "custom", label: "Home", url: "/"}}]}',
      ),
  }),

  async execute(params): Promise<ToolResult> {
    const { slug: _slug, data: _data } = params as { slug: string; data: Record<string, unknown> };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to update global: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
