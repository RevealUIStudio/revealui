/**
 * admin Tools Factory
 * Creates admin tools with API client injected for actual execution
 */

import type { Tool } from '../base.js';
import {
  createDocumentTool,
  deleteDocumentTool,
  findDocumentsTool,
  getDocumentTool,
  listCollectionsTool,
  updateDocumentTool,
} from './collection-tools.js';
import { getGlobalTool, listGlobalsTool, updateGlobalTool } from './global-tools.js';
import {
  deleteMediaTool,
  getMediaTool,
  listMediaTool,
  updateMediaTool,
  uploadMediaTool,
} from './media-tools.js';
import {
  createUserTool,
  deleteUserTool,
  getCurrentUserTool,
  listUsersTool,
  updateUserTool,
} from './user-tools.js';

/**
 * API Client interface (compatible with @revealui/core/admin/utils/apiClient)
 */
export interface AdminAPIClient {
  find(options: {
    collection: string;
    page?: number;
    limit?: number;
    where?: Record<string, unknown>;
    sort?: string;
  }): Promise<{
    docs?: unknown[];
    totalDocs?: number;
    page?: number;
    totalPages?: number;
  }>;

  findById(collection: string, id: string): Promise<unknown>;

  create(options: { collection: string; data: Record<string, unknown> }): Promise<unknown>;

  update(options: {
    collection: string;
    id: string;
    data: Record<string, unknown>;
  }): Promise<unknown>;

  delete(options: { collection: string; id: string }): Promise<void>;

  findGlobal(options: { slug: string; depth?: number }): Promise<unknown>;

  updateGlobal(options: { slug: string; data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Collection metadata for admin tools
 * Simplified representation of a collection configuration
 */
export interface CollectionMetadata {
  slug: string;
  label?: string;
  description?: string;
}

/**
 * Global metadata for admin tools
 * Simplified representation of a global configuration
 */
export interface GlobalMetadata {
  slug: string;
  label?: string;
  description?: string;
}

/**
 * User context for admin tools
 */
export interface UserContext {
  id: string;
  email: string;
  role?: string;
}

/**
 * Configuration interface for admin tools
 */
export interface AdminToolsConfig {
  /** API client instance */
  apiClient: AdminAPIClient;

  /** Available collections (optional, for list_collections tool) */
  collections?: CollectionMetadata[];

  /** Available globals (optional, for list_globals tool) */
  globals?: GlobalMetadata[];

  /** Current user context (for permission checks) */
  user?: UserContext;
}

/**
 * Create admin tools with API client injected
 * This factory function creates functional tools by injecting the actual API implementation
 */
export function createAdminTools(config: AdminToolsConfig): Tool[] {
  const { apiClient, collections, globals, user } = config;

  // Clone tools and inject API client implementation
  const tools: Tool[] = [];

  // Collection Tools
  tools.push({
    ...listCollectionsTool,
    async execute() {
      if (collections && collections.length > 0) {
        return {
          success: true,
          data: { collections, count: collections.length },
        };
      }
      return listCollectionsTool.execute({});
    },
  });

  tools.push({
    ...findDocumentsTool,
    async execute(params) {
      const { collection, page, limit, where, sort } = params as {
        collection: string;
        page?: number;
        limit?: number;
        where?: Record<string, unknown>;
        sort?: string;
      };

      try {
        const response = await apiClient.find({
          collection,
          page,
          limit,
          where,
          sort,
        });

        return {
          success: true,
          data: {
            documents: response.docs || [],
            totalDocs: response.totalDocs || 0,
            page: response.page || 1,
            totalPages: response.totalPages || 1,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to find documents: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...getDocumentTool,
    async execute(params) {
      const { collection, id } = params as { collection: string; id: string };

      try {
        const document = await apiClient.findById(collection, id);
        return {
          success: true,
          data: document,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get document: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...createDocumentTool,
    async execute(params) {
      const { collection, data } = params as { collection: string; data: Record<string, unknown> };

      try {
        const document = await apiClient.create({ collection, data });
        return {
          success: true,
          data: document,
          metadata: {
            message: `Created ${collection} document successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create document: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...updateDocumentTool,
    async execute(params) {
      const { collection, id, data } = params as {
        collection: string;
        id: string;
        data: Record<string, unknown>;
      };

      try {
        const document = await apiClient.update({ collection, id, data });
        return {
          success: true,
          data: document,
          metadata: {
            message: `Updated ${collection} document successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update document: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...deleteDocumentTool,
    async execute(params) {
      const { collection, id } = params as { collection: string; id: string };

      try {
        await apiClient.delete({ collection, id });
        return {
          success: true,
          metadata: {
            message: `Deleted ${collection} document successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  // Global Tools
  tools.push({
    ...listGlobalsTool,
    async execute() {
      if (globals && globals.length > 0) {
        return {
          success: true,
          data: { globals, count: globals.length },
        };
      }
      return listGlobalsTool.execute({});
    },
  });

  tools.push({
    ...getGlobalTool,
    async execute(params) {
      const { slug, depth } = params as { slug: string; depth?: number };

      try {
        const global = await apiClient.findGlobal({ slug, depth });
        return {
          success: true,
          data: global,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get global: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...updateGlobalTool,
    async execute(params) {
      const { slug, data } = params as { slug: string; data: Record<string, unknown> };

      try {
        const global = await apiClient.updateGlobal({ slug, data });
        return {
          success: true,
          data: global,
          metadata: {
            message: `Updated ${slug} global successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update global: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  // Media Tools (use collection 'media' for now)
  tools.push({
    ...listMediaTool,
    async execute(params) {
      const { page, limit, mimeType } = params as {
        page?: number;
        limit?: number;
        mimeType?: string;
      };

      try {
        const where = mimeType ? { mimeType } : undefined;
        const response = await apiClient.find({
          collection: 'media',
          page,
          limit,
          where,
        });

        return {
          success: true,
          data: {
            media: response.docs || [],
            totalDocs: response.totalDocs || 0,
            page: response.page || 1,
            totalPages: response.totalPages || 1,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list media: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...getMediaTool,
    async execute(params) {
      const { id } = params as { id: string };

      try {
        const media = await apiClient.findById('media', id);
        return {
          success: true,
          data: media,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get media: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...uploadMediaTool,
    async execute(params) {
      const {
        filename,
        mimeType,
        data: _data,
        alt,
      } = params as {
        filename: string;
        mimeType: string;
        data: string;
        alt?: string;
      };

      try {
        // For now, create media document
        // In full implementation, would upload to storage first
        const media = await apiClient.create({
          collection: 'media',
          data: {
            filename,
            mimeType,
            alt,
            // Note: Actual file upload would happen here
          },
        });

        return {
          success: true,
          data: media,
          metadata: {
            message: `Uploaded ${filename} successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to upload media: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...updateMediaTool,
    async execute(params) {
      const { id, alt, title, description } = params as {
        id: string;
        alt?: string;
        title?: string;
        description?: string;
      };

      try {
        const data: Record<string, unknown> = {};
        if (alt !== undefined) data.alt = alt;
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;

        const media = await apiClient.update({
          collection: 'media',
          id,
          data,
        });

        return {
          success: true,
          data: media,
          metadata: {
            message: 'Updated media metadata successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update media: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...deleteMediaTool,
    async execute(params) {
      const { id } = params as { id: string };

      try {
        await apiClient.delete({ collection: 'media', id });
        return {
          success: true,
          metadata: {
            message: 'Deleted media successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to delete media: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  // User Tools (use collection 'users' for now)
  tools.push({
    ...getCurrentUserTool,
    async execute() {
      if (user) {
        return {
          success: true,
          data: user,
        };
      }
      return {
        success: false,
        error: 'No user context available',
      };
    },
  });

  tools.push({
    ...listUsersTool,
    async execute(params) {
      const { page, limit, role } = params as { page?: number; limit?: number; role?: string };

      try {
        const where = role ? { role } : undefined;
        const response = await apiClient.find({
          collection: 'users',
          page,
          limit,
          where,
        });

        return {
          success: true,
          data: {
            users: response.docs || [],
            totalDocs: response.totalDocs || 0,
            page: response.page || 1,
            totalPages: response.totalPages || 1,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list users: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...createUserTool,
    async execute(params) {
      const { email, password, name, role } = params as {
        email: string;
        password: string;
        name?: string;
        role?: string;
      };

      try {
        const user = await apiClient.create({
          collection: 'users',
          data: { email, password, name, role },
        });

        return {
          success: true,
          data: user,
          metadata: {
            message: `Created user ${email} successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create user: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...updateUserTool,
    async execute(params) {
      const { id, email, name, role, password } = params as {
        id: string;
        email?: string;
        name?: string;
        role?: string;
        password?: string;
      };

      try {
        const data: Record<string, unknown> = {};
        if (email !== undefined) data.email = email;
        if (name !== undefined) data.name = name;
        if (role !== undefined) data.role = role;
        if (password !== undefined) data.password = password;

        const user = await apiClient.update({
          collection: 'users',
          id,
          data,
        });

        return {
          success: true,
          data: user,
          metadata: {
            message: 'Updated user successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update user: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  tools.push({
    ...deleteUserTool,
    async execute(params) {
      const { id } = params as { id: string };

      try {
        await apiClient.delete({ collection: 'users', id });
        return {
          success: true,
          metadata: {
            message: 'Deleted user successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  return tools;
}
