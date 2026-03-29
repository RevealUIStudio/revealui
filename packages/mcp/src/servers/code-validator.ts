#!/usr/bin/env node

/**
 * Code Validator MCP Server
 *
 * Model Context Protocol server that exposes code validation tools
 * for AI assistants to validate code before writing to disk.
 *
 * This server provides:
 * - validate_code: Validate code content against standards
 * - get_standards: Get current code standards configuration
 *
 * Usage:
 *   Add to Claude Code MCP config:
 *   {
 *     "mcpServers": {
 *       "revealui-validator": {
 *         "command": "node",
 *         "args": ["./packages/mcp/src/servers/code-validator.ts"]
 *       }
 *     }
 *   }
 */

import { resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@revealui/core/observability/logger';
import { ErrorCode, ScriptError } from '../../../../scripts/lib/errors.js';
import { createValidator, loadStandards } from '../../../dev/src/code-validator/index.js';
import { checkMcpLicense } from '../index.js';

const STANDARDS_PATH = resolve(process.cwd(), '.revealui/code-standards.json');

// Initialize MCP server
const server = new Server(
  {
    name: 'revealui-code-validator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define tools
const TOOLS: Tool[] = [
  {
    name: 'validate_code',
    description:
      'Validates code content against RevealUI standards to prevent technical debt (console.log, any types, etc.)', // ai-validator-ignore - documentation text
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code content to validate',
        },
        filePath: {
          type: 'string',
          description: 'Optional file path for path-based exemptions',
        },
        autoFix: {
          type: 'boolean',
          description: 'Whether to apply automatic fixes',
          default: false,
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'get_standards',
    description: 'Get the current code standards configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    switch (request.params.name) {
      case 'validate_code': {
        const {
          code,
          filePath,
          autoFix = false,
        } = request.params.arguments as {
          code: string;
          filePath?: string;
          autoFix?: boolean;
        };

        const validator = await createValidator(STANDARDS_PATH);

        // Auto-fix if requested
        let codeToValidate = code;
        let fixesApplied = 0;

        if (autoFix) {
          const fixResult = validator.autoFix(code);
          codeToValidate = fixResult.code;
          fixesApplied = fixResult.fixesApplied;
        }

        // Validate
        const result = validator.validate(codeToValidate, { filePath });

        // Format response
        const response = {
          valid: result.valid,
          violations: result.violations,
          stats: result.stats,
          summary: `${result.errors} errors, ${result.warnings} warnings, ${result.info} info`,
          fixesApplied,
          fixedCode: autoFix && fixesApplied > 0 ? codeToValidate : undefined,
          formatted: validator.formatResult(result, { colors: false }),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      case 'get_standards': {
        const standards = await loadStandards(STANDARDS_PATH);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(standards, null, 2),
            },
          ],
        };
      }

      default:
        throw new ScriptError(`Unknown tool: ${request.params.name}`, ErrorCode.NOT_FOUND);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  if (!(await checkMcpLicense())) {
    process.exit(ErrorCode.CONFIG_ERROR);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error('Server error', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
