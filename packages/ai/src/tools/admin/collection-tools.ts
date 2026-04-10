/**
 * Admin Collection Tools
 * Tools for managing collection documents (create, read, update, delete)
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';

/**
 * Tool: List all collections
 * Returns available collections in the admin
 */
export const listCollectionsTool: Tool = {
  name: 'list_collections',
  description:
    'Get a list of all available admin collections. Use this to discover what content types exist (e.g., pages, posts, users, media).',
  parameters: z.object({}),

  async execute(): Promise<ToolResult> {
    try {
      // This will be injected with RevealUI config at runtime
      // For now, return common collections
      const collections = [
        { slug: 'pages', label: 'Pages', description: 'Website pages' },
        { slug: 'posts', label: 'Posts', description: 'Blog posts' },
        { slug: 'media', label: 'Media', description: 'Images and files' },
        { slug: 'users', label: 'Users', description: 'User accounts' },
        { slug: 'categories', label: 'Categories', description: 'Content categories' },
        { slug: 'tags', label: 'Tags', description: 'Content tags' },
      ];

      return {
        success: true,
        data: {
          collections,
          count: collections.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list collections: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Find documents in a collection
 * Search and retrieve documents from a specific collection
 */
export const findDocumentsTool: Tool = {
  name: 'find_documents',
  description:
    'Search for documents in an admin collection. Use this to find existing content before creating or updating.',
  parameters: z.object({
    collection: z.string().describe('The collection slug (e.g., "pages", "posts", "users")'),
    page: z.number().optional().describe('Page number for pagination (default: 1)'),
    limit: z.number().optional().describe('Number of results per page (default: 10)'),
    where: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Filter conditions (e.g., {status: "published"})'),
    sort: z.string().optional().describe('Sort field (e.g., "-createdAt" for newest first)'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      collection: _collection,
      page: _page = 1,
      limit: _limit = 10,
      where: _where,
      sort: _sort,
    } = params as {
      collection: string;
      page?: number;
      limit?: number;
      where?: Record<string, unknown>;
      sort?: string;
    };

    try {
      // Note: This requires the apiClient to be available at runtime
      // The actual implementation will be injected when registering the tool
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to find documents: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Get a single document by ID
 * Retrieve a specific document from a collection
 */
export const getDocumentTool: Tool = {
  name: 'get_document',
  description:
    'Get a specific document by ID from an admin collection. Use this to retrieve full details of a single item.',
  parameters: z.object({
    collection: z.string().describe('The collection slug (e.g., "pages", "posts")'),
    id: z.string().describe('The document ID'),
  }),

  async execute(params): Promise<ToolResult> {
    const { collection: _collection, id: _id } = params as { collection: string; id: string };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to get document: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Create a new document
 * Add a new document to a collection
 */
export const createDocumentTool: Tool = {
  name: 'create_document',
  description:
    'Create a new document in an admin collection. Use this to add new content like pages, posts, or other records.',
  parameters: z.object({
    collection: z.string().describe('The collection slug (e.g., "pages", "posts")'),
    data: z
      .record(z.string(), z.unknown())
      .describe(
        'The document data as key-value pairs (e.g., {title: "My Page", slug: "my-page", content: "..."})',
      ),
  }),

  async execute(params): Promise<ToolResult> {
    const { collection: _collection, data: _data } = params as {
      collection: string;
      data: Record<string, unknown>;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to create document: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Update an existing document
 * Modify a document in a collection
 */
export const updateDocumentTool: Tool = {
  name: 'update_document',
  description:
    'Update an existing document in an admin collection. Use this to modify content like changing titles, updating text, etc.',
  parameters: z.object({
    collection: z.string().describe('The collection slug (e.g., "pages", "posts")'),
    id: z.string().describe('The document ID to update'),
    data: z
      .record(z.string(), z.unknown())
      .describe('The fields to update as key-value pairs (e.g., {title: "Updated Title"})'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      collection: _collection,
      id: _id,
      data: _data,
    } = params as {
      collection: string;
      id: string;
      data: Record<string, unknown>;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to update document: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Delete a document
 * Remove a document from a collection
 */
export const deleteDocumentTool: Tool = {
  name: 'delete_document',
  description:
    'Delete a document from an admin collection. Use this to remove unwanted content. This action is permanent.',
  parameters: z.object({
    collection: z.string().describe('The collection slug (e.g., "pages", "posts")'),
    id: z.string().describe('The document ID to delete'),
  }),

  async execute(params): Promise<ToolResult> {
    const { collection: _collection, id: _id } = params as { collection: string; id: string };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
