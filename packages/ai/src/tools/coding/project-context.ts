/**
 * project_context  -  Query the harness content layer for relevant project rules and skills
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

interface ContentItem {
  id: string;
  type: string;
  path: string;
  content: string;
}

/** Search content definitions for relevant context */
function searchContent(projectRoot: string, query: string, scope?: string): ContentItem[] {
  const results: ContentItem[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);

  // Content directories to search (harness content layer paths)
  const searchDirs: Array<{ dir: string; type: string }> = [
    { dir: join(projectRoot, '.claude', 'rules'), type: 'rule' },
    { dir: join(projectRoot, '.claude', 'agents'), type: 'agent' },
    { dir: join(projectRoot, '.claude', 'commands'), type: 'command' },
  ];

  // If scope is specified, filter to that type
  const filteredDirs = scope ? searchDirs.filter((d) => d.type === scope) : searchDirs;

  for (const { dir, type } of filteredDirs) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      // Try reading as skill directory first, then as markdown file
      // (avoids TOCTOU race between stat and read)
      if (!entry.includes('.')) {
        // Likely a directory, check for SKILL.md
        const skillPath = join(fullPath, 'SKILL.md');
        try {
          const content = readFileSync(skillPath, 'utf8');
          if (matchesQuery(content, queryTerms)) {
            results.push({
              id: entry,
              type: 'skill',
              path: skillPath.replace(`${projectRoot}/`, ''),
              content,
            });
          }
        } catch {
          // Not a skill directory or not readable, skip
        }
      }
      if (entry.endsWith('.md')) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          if (matchesQuery(content, queryTerms)) {
            results.push({
              id: entry.replace('.md', ''),
              type,
              path: fullPath.replace(`${projectRoot}/`, ''),
              content,
            });
          }
        } catch {
          // Not readable, skip
        }
      }
    }
  }

  // Score by relevance (number of query terms found)
  results.sort((a, b) => {
    const scoreA = queryTerms.filter((t) => a.content.toLowerCase().includes(t)).length;
    const scoreB = queryTerms.filter((t) => b.content.toLowerCase().includes(t)).length;
    return scoreB - scoreA;
  });

  return results;
}

function matchesQuery(content: string, terms: string[]): boolean {
  const lower = content.toLowerCase();
  // Match if at least one term is found
  return terms.some((term) => lower.includes(term));
}

export const projectContextTool: Tool = {
  name: 'project_context',
  label: 'Project Context',
  description:
    "Query the project's harness content layer for relevant rules, agents, commands, and skills. Use this to understand project conventions, coding standards, and available tools before making changes.",
  parameters: z.object({
    query: z
      .string()
      .describe('Search query (e.g., "database conventions", "testing patterns", "auth")'),
    scope: z
      .enum(['rule', 'agent', 'command', 'skill'])
      .optional()
      .describe('Limit search to a specific content type'),
  }),

  async execute(params): Promise<ToolResult> {
    const { query, scope } = params as { query: string; scope?: string };
    const config = getSafetyConfig();

    try {
      const results = searchContent(config.projectRoot, query, scope);

      if (results.length === 0) {
        return {
          success: true,
          data: { query, results: [] },
          content: `No project context found for "${query}"`,
        };
      }

      // Return top 5 most relevant results
      const top = results.slice(0, 5);
      const summaries = top.map((item) => {
        // Truncate content for token efficiency
        const preview = item.content.length > 500 ? `${item.content.slice(0, 500)}…` : item.content;
        return `[${item.type}] ${item.id} (${item.path}):\n${preview}`;
      });

      return {
        success: true,
        data: { query, resultCount: results.length, results: top },
        content: `Found ${results.length} results for "${query}" (showing top ${top.length}):\n\n${summaries.join('\n\n---\n\n')}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Context query failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
