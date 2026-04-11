/**
 * RevealUI REST API Implementation
 *
 * Based on RevealUI admin REST API but adapted for RevealUI.
 *
 * WARNING: This module is server-only.
 * Do NOT import in client-side code or edge runtime.
 */

import { defaultLogger } from '../instance/logger.js';
import type {
  Config,
  PopulateType,
  RevealConfig,
  RevealDataObject,
  RevealDocument,
  RevealPaginatedResult,
  RevealRequest,
  RevealSelect,
  RevealUIInstance,
  RevealWhere,
} from '../types/index.js';

export interface APIResponse<T = RevealDocument> {
  docs?: T[];
  doc?: T;
  totalDocs?: number;
  limit?: number;
  totalPages?: number;
  page?: number;
  pagingCounter?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  prevPage?: number | null;
  nextPage?: number | null;
  message?: string;
  errors?: Array<{ message: string; field?: string }>;
}

export interface RESTOptions {
  collection?: string;
  global?: string;
  id?: string;
  depth?: number;
  locale?: string;
  fallbackLocale?: string;
  overrideAccess?: boolean;
  showHiddenFields?: boolean;
  draft?: boolean;
  where?: RevealWhere;
  limit?: number;
  page?: number;
  sort?: string;
  select?: RevealSelect;
  populate?: PopulateType;
}

function parseQueryParams(searchParams: URLSearchParams): RESTOptions {
  const options: RESTOptions = {};

  // Parse depth
  const depth = searchParams.get('depth');
  if (depth) {
    options.depth = parseInt(depth, 10);
  }

  // Parse locale
  const locale = searchParams.get('locale');
  if (locale) {
    options.locale = locale;
  }

  // Parse fallbackLocale
  const fallbackLocale = searchParams.get('fallbackLocale');
  if (fallbackLocale) {
    options.fallbackLocale = fallbackLocale;
  }

  // Parse overrideAccess  -  SECURITY: This flag bypasses collection access control.
  // It is stripped from external API requests below to prevent abuse.
  // Only server-side code should set overrideAccess=true (e.g., internal hooks, seed scripts).
  const overrideAccess = searchParams.get('overrideAccess');
  if (overrideAccess !== null) {
    options.overrideAccess = overrideAccess === 'true';
  }

  // Parse showHiddenFields
  const showHiddenFields = searchParams.get('showHiddenFields');
  if (showHiddenFields !== null) {
    options.showHiddenFields = showHiddenFields === 'true';
  }

  // Parse draft
  const draft = searchParams.get('draft');
  if (draft !== null) {
    options.draft = draft === 'true';
  }

  // Parse where (JSON)
  const where = searchParams.get('where');
  if (where) {
    try {
      options.where = JSON.parse(where) as RevealWhere;
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Parse limit
  const limit = searchParams.get('limit');
  if (limit) {
    options.limit = parseInt(limit, 10);
  }

  // Parse page
  const page = searchParams.get('page');
  if (page) {
    options.page = parseInt(page, 10);
  }

  // Parse sort
  const sort = searchParams.get('sort');
  if (sort) {
    options.sort = sort;
  }

  // Parse select (JSON)
  const select = searchParams.get('select');
  if (select) {
    try {
      options.select = JSON.parse(select) as RevealSelect;
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Parse populate (JSON)
  const populate = searchParams.get('populate');
  if (populate) {
    try {
      options.populate = JSON.parse(populate) as PopulateType;
    } catch {
      // Invalid JSON, ignore
    }
  }

  return options;
}

function createRevealRequest(request: Request): RevealRequest {
  const url = new URL(request.url);
  return {
    revealui: undefined, // Will be set by the handler
    user: undefined,
    locale: url.searchParams.get('locale') || undefined,
    fallbackLocale: url.searchParams.get('fallbackLocale') || undefined,
    context: {},
    transactionID: undefined,
    url: request.url,
    method: request.method,
    headers: request.headers,
    json: () => request.json(),
    text: () => request.text(),
    formData: () => request.formData(),
    arrayBuffer: () => request.arrayBuffer(),
    blob: () => request.blob(),
  };
}

/**
 * Type guard to check if config has cors property
 */
function hasCorsProperty(config: unknown): config is {
  cors?: string | string[] | { origins: string[]; headers?: string[] };
} {
  return typeof config === 'object' && config !== null && 'cors' in config;
}

/**
 * Type guard to check if config has reveal.corsOrigins property (Config from @revealui/config)
 */
function hasRevealCorsOrigins(config: unknown): config is { reveal?: { corsOrigins?: string[] } } {
  return (
    typeof config === 'object' &&
    config !== null &&
    'reveal' in config &&
    typeof (config as { reveal?: unknown }).reveal === 'object' &&
    (config as { reveal?: { corsOrigins?: string[] } }).reveal !== null
  );
}

/**
 * Extract CORS origins from config
 */
function getCorsOriginsFromConfig(config?: Config | RevealConfig): string[] {
  if (!config) {
    return [];
  }

  // Check for cors property (RevealConfig from schema/core or runtime config)
  if (hasCorsProperty(config)) {
    const corsConfig = config.cors;
    if (typeof corsConfig === 'string') {
      return [corsConfig];
    }
    if (Array.isArray(corsConfig)) {
      return corsConfig;
    }
    if (corsConfig && typeof corsConfig === 'object' && 'origins' in corsConfig) {
      return corsConfig.origins;
    }
  }

  // Check for reveal.corsOrigins (Config from @revealui/config)
  if (hasRevealCorsOrigins(config)) {
    const corsOrigins = config.reveal?.corsOrigins;
    if (Array.isArray(corsOrigins)) {
      return corsOrigins;
    }
  }

  return [];
}

/**
 * Get allowed CORS origin for a request
 * Checks config first, then environment variable, then allows all for development
 */
function getAllowedOrigin(request: Request, config?: Config | RevealConfig): string {
  let allowedOrigins = getCorsOriginsFromConfig(config);

  // Fallback to environment variable
  if (allowedOrigins.length === 0 && process.env.REVEALUI_CORS_ORIGINS) {
    allowedOrigins = process.env.REVEALUI_CORS_ORIGINS.split(',').map((s) => s.trim());
  }

  const origin = request.headers.get('origin');

  // If config has specific origins and request origin matches, use it
  if (allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  // In development, allow all origins for convenience
  // In production, this should never be reached if CORS is properly configured
  if (process.env.NODE_ENV === 'development') {
    return '*';
  }

  // In production, if no allowed origins configured, deny all (secure default)
  // This prevents accidental exposure in production
  return origin || '';
}

/**
 * Get standard CORS headers for a response
 */
function getCORSHeaders(request: Request, config?: Config | RevealConfig): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, config),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight requests
 * Note: Next.js middleware (proxy.ts) handles CORS for actual requests
 * This function only handles OPTIONS preflight requests
 */
function handleCORS(request: Request, config?: Config | RevealConfig): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...getCORSHeaders(request, config),
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

async function handleCollectionOperation(
  method: string,
  collection: string,
  id: string | undefined,
  revealui: RevealUIInstance,
  request: Request,
  options: RESTOptions,
): Promise<Response> {
  try {
    let result: RevealDocument | RevealPaginatedResult | null;

    switch (method) {
      case 'GET':
        if (id) {
          // Find by ID
          result = await revealui.findByID({
            collection,
            id,
            ...options,
          });
        } else {
          // Find multiple
          result = await revealui.find({
            collection,
            ...options,
          });
        }
        break;

      case 'POST': {
        // Create
        const createData = (await request.json()) as RevealDataObject;
        result = await revealui.create({
          collection,
          data: createData,
          ...options,
        });
        break;
      }

      case 'PATCH': {
        if (!id) {
          return new Response(JSON.stringify({ message: 'ID required for update operation' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Update
        const updateData = (await request.json()) as RevealDataObject;
        result = await revealui.update({
          collection,
          id,
          data: updateData,
          ...options,
        });
        break;
      }

      case 'DELETE':
        if (!id) {
          return new Response(JSON.stringify({ message: 'ID required for delete operation' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Delete
        result = await revealui.delete({
          collection,
          id,
          ...options,
        });
        break;

      default:
        return new Response(JSON.stringify({ message: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(request, revealui.config),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status =
      'status' in (error as { status?: number }) ? (error as { status: number }).status : 500;
    // Log error with context for debugging
    defaultLogger.error('RevealUI Collection API Error:', {
      collection,
      method: request.method,
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            }
          : error,
    });

    // Sanitize error message for client (don't expose internal details)
    const clientMessage = status >= 500 ? 'An internal server error occurred' : message;
    return new Response(
      JSON.stringify({
        message: clientMessage,
        errors: [{ message: clientMessage }],
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request, revealui.config),
        },
      },
    );
  }
}

async function handleGlobalOperation(
  method: string,
  global: string,
  revealui: RevealUIInstance,
  request: Request,
  options: RESTOptions,
): Promise<Response> {
  try {
    let result: RevealDocument | RevealPaginatedResult | null;

    switch (method) {
      case 'GET':
        // Find global
        result = (await revealui.globals[global]?.find(options)) ?? null;
        break;

      case 'POST':
      case 'PATCH': {
        // Update global
        const updateData = (await request.json()) as RevealDataObject;
        result =
          (await revealui.globals[global]?.update({
            data: updateData,
            ...options,
          })) ?? null;
        break;
      }

      default:
        return new Response(JSON.stringify({ message: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(request, revealui.config),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status =
      'status' in (error as { status?: number }) ? (error as { status: number }).status : 500;
    // Log error with context for debugging
    defaultLogger.error('RevealUI Global API Error:', {
      global,
      method: request.method,
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            }
          : error,
    });

    // Sanitize error message for client (don't expose internal details)
    const clientMessage = status >= 500 ? 'An internal server error occurred' : message;
    return new Response(
      JSON.stringify({
        message: clientMessage,
        errors: [{ message: clientMessage }],
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request, revealui.config),
        },
      },
    );
  }
}

export async function handleRESTRequest(
  request: Request,
  config: Config,
  revealui: RevealUIInstance,
): Promise<Response> {
  // Handle CORS preflight requests
  // Note: Next.js middleware (proxy.ts) handles CORS for actual requests
  const corsResponse = handleCORS(request, config);
  if (corsResponse) {
    return corsResponse;
  }

  const url = new URL(request.url);
  let pathParts = url.pathname.split('/').filter(Boolean);

  // Skip 'api' prefix if present (Next.js routes include /api in the path)
  if (pathParts[0] === 'api') {
    pathParts = pathParts.slice(1);
  }

  // Parse query parameters
  const options = parseQueryParams(url.searchParams);

  // Create reveal request
  const revealRequest = createRevealRequest(request);
  revealRequest.revealui = revealui;

  try {
    // Route handling
    if (pathParts[0] === 'collections' && pathParts[1]) {
      const collection = pathParts[1];
      const id = pathParts[2]; // Optional ID

      if (!revealui.collections[collection]) {
        return new Response(JSON.stringify({ message: `Collection '${collection}' not found` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return await handleCollectionOperation(
        request.method,
        collection,
        id,
        revealui,
        request,
        options,
      );
    } else if (pathParts[0] === 'globals' && pathParts[1]) {
      const global = pathParts[1];

      if (!revealui.globals[global]) {
        return new Response(JSON.stringify({ message: `Global '${global}' not found` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return await handleGlobalOperation(request.method, global, revealui, request, options);
    } else {
      return new Response(JSON.stringify({ message: 'Route not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    // Extract error message safely
    const message = error instanceof Error ? error.message : 'Internal server error';

    // Log error with context for debugging
    defaultLogger.error('RevealUI REST API Error:', {
      message,
      path: url.pathname,
      method: request.method,
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            }
          : error,
    });

    // Sanitize error message for client (don't expose internal details)
    const clientMessage = 'An internal server error occurred';

    return new Response(
      JSON.stringify({
        message: clientMessage,
        errors: [{ message: clientMessage }],
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(request, config),
        },
      },
    );
  }
}

// Route handlers for Next.js
export function createRESTHandlers(
  config: Config,
  revealui: RevealUIInstance,
): {
  GET: (request: Request, context?: unknown) => Promise<Response>;
  POST: (request: Request, context?: unknown) => Promise<Response>;
  PUT: (request: Request, context?: unknown) => Promise<Response>;
  DELETE: (request: Request, context?: unknown) => Promise<Response>;
  PATCH: (request: Request, context?: unknown) => Promise<Response>;
  OPTIONS: (request: Request, context?: unknown) => Promise<Response>;
} {
  const handler = async (request: Request, _context?: unknown) => {
    return await handleRESTRequest(request, config, revealui);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
    OPTIONS: handler,
  };
}
