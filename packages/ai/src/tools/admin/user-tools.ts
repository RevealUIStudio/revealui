/**
 * Admin User Tools
 * Tools for user management and authentication
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';

/**
 * Tool: Get current user
 * Retrieve information about the logged-in user
 */
export const getCurrentUserTool: Tool = {
  name: 'get_current_user',
  description:
    'Get information about the currently logged-in user, including their role, email, and permissions.',
  parameters: z.object({}),

  async execute(): Promise<ToolResult> {
    try {
      // API client will be injected at runtime
      // This will check auth token and return user data
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to get current user: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: List users
 * Get all users (admin only)
 */
export const listUsersTool: Tool = {
  name: 'list_users',
  description:
    'Get a list of all users in the system. This is typically restricted to admin users only.',
  parameters: z.object({
    page: z.number().optional().describe('Page number for pagination (default: 1)'),
    limit: z.number().optional().describe('Number of results per page (default: 10)'),
    role: z.string().optional().describe('Filter by user role (e.g., "admin", "editor", "user")'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      page: _page = 1,
      limit: _limit = 10,
      role: _role,
    } = params as {
      page?: number;
      limit?: number;
      role?: string;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to list users: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Create user
 * Create a new user account
 */
export const createUserTool: Tool = {
  name: 'create_user',
  description: 'Create a new user account. Typically requires admin permissions.',
  parameters: z.object({
    email: z.string().email().describe('User email address'),
    password: z.string().min(8).describe('User password (minimum 8 characters)'),
    name: z.string().optional().describe('User full name'),
    role: z
      .string()
      .optional()
      .describe('User role (e.g., "admin", "editor", "user"). Defaults to "user"'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      email: _email,
      password: _password,
      name: _name,
      role: _role,
    } = params as {
      email: string;
      password: string;
      name?: string;
      role?: string;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to create user: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Update user
 * Update user account information
 */
export const updateUserTool: Tool = {
  name: 'update_user',
  description: 'Update a user account. Users can update their own account, admins can update any.',
  parameters: z.object({
    id: z.string().describe('User ID to update'),
    email: z.string().email().optional().describe('New email address'),
    name: z.string().optional().describe('New full name'),
    role: z.string().optional().describe('New role (admin only)'),
    password: z.string().min(8).optional().describe('New password'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      id: _id,
      email: _email,
      name: _name,
      role: _role,
      password: _password,
    } = params as {
      id: string;
      email?: string;
      name?: string;
      role?: string;
      password?: string;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to update user: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Delete user
 * Remove a user account
 */
export const deleteUserTool: Tool = {
  name: 'delete_user',
  description:
    'Delete a user account. Typically requires admin permissions. This action is permanent.',
  parameters: z.object({
    id: z.string().describe('User ID to delete'),
  }),

  async execute(params): Promise<ToolResult> {
    const { id: _id } = params as { id: string };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
