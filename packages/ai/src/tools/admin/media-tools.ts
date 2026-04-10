/**
 * Admin Media Tools
 * Tools for managing media files (images, videos, documents)
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';

/**
 * Tool: List media files
 * Browse the media library
 */
export const listMediaTool: Tool = {
  name: 'list_media',
  description:
    'Get a list of media files from the admin media library. Use this to browse uploaded images, videos, and documents.',
  parameters: z.object({
    page: z.number().optional().describe('Page number for pagination (default: 1)'),
    limit: z.number().optional().describe('Number of results per page (default: 10)'),
    mimeType: z
      .string()
      .optional()
      .describe('Filter by MIME type (e.g., "image/jpeg", "image/png", "video/mp4")'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      page: _page = 1,
      limit: _limit = 10,
      mimeType: _mimeType,
    } = params as {
      page?: number;
      limit?: number;
      mimeType?: string;
    };

    try {
      // API client will be injected at runtime
      // This will use the collection tools to query the media collection
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to list media: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Get media by ID
 * Retrieve a specific media file
 */
export const getMediaTool: Tool = {
  name: 'get_media',
  description: 'Get details of a specific media file by ID, including URL, filename, and metadata.',
  parameters: z.object({
    id: z.string().describe('The media file ID'),
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
        error: `Failed to get media: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Upload media
 * Upload a new media file
 */
export const uploadMediaTool: Tool = {
  name: 'upload_media',
  description:
    'Upload a new media file (image, video, or document) to the admin. The file should be provided as a base64-encoded string.',
  parameters: z.object({
    filename: z.string().describe('The filename (e.g., "logo.png")'),
    mimeType: z.string().describe('The MIME type (e.g., "image/png", "image/jpeg")'),
    data: z
      .string()
      .describe(
        'The file content as a base64-encoded string or data URL (data:image/png;base64,...)',
      ),
    alt: z.string().optional().describe('Alt text for accessibility (recommended for images)'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      filename: _filename,
      mimeType: _mimeType,
      data: _data,
      alt: _alt,
    } = params as {
      filename: string;
      mimeType: string;
      data: string;
      alt?: string;
    };

    try {
      // API client will be injected at runtime
      // This will handle file upload to storage and create media document
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to upload media: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Delete media
 * Remove a media file from the library
 */
export const deleteMediaTool: Tool = {
  name: 'delete_media',
  description:
    'Delete a media file from the admin media library. This removes both the database record and the file from storage. This action is permanent.',
  parameters: z.object({
    id: z.string().describe('The media file ID to delete'),
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
        error: `Failed to delete media: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Tool: Update media metadata
 * Update media file metadata (alt text, title, etc.)
 */
export const updateMediaTool: Tool = {
  name: 'update_media',
  description:
    'Update metadata for a media file such as alt text, title, or description. Does not change the actual file.',
  parameters: z.object({
    id: z.string().describe('The media file ID'),
    alt: z.string().optional().describe('Alt text for accessibility'),
    title: z.string().optional().describe('Title/name of the media'),
    description: z.string().optional().describe('Description of the media content'),
  }),

  async execute(params): Promise<ToolResult> {
    const {
      id: _id,
      alt: _alt,
      title: _title,
      description: _description,
    } = params as {
      id: string;
      alt?: string;
      title?: string;
      description?: string;
    };

    try {
      // API client will be injected at runtime
      throw new Error(
        'API client not configured. This tool must be registered with an API client instance.',
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to update media: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
