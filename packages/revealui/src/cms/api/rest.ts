// RevealUI REST API Implementation
// Based on RevealUI CMS REST API but adapted for RevealUI

import type { Config, Payload, PayloadRequest } from '../types/index.js';

export interface APIResponse<T = any> {
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
  where?: any;
  limit?: number;
  page?: number;
  sort?: string;
  select?: any;
  populate?: any;
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

  // Parse overrideAccess
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
      options.where = JSON.parse(where);
    } catch (e) {
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
      options.select = JSON.parse(select);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Parse populate (JSON)
  const populate = searchParams.get('populate');
  if (populate) {
    try {
      options.populate = JSON.parse(populate);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  return options;
}

function createPayloadRequest(request: Request, user?: any): PayloadRequest {
  const url = new URL(request.url);
  return {
    payload: null as any, // Will be set by the handler
    user,
    locale: url.searchParams.get('locale') || undefined,
    fallbackLocale: url.searchParams.get('fallbackLocale') || undefined,
    context: {},
    transactionID: undefined,
    url: request.url,
    method: request.method as any,
    headers: request.headers,
    json: () => request.json(),
    text: () => request.text(),
    formData: () => request.formData(),
    arrayBuffer: () => request.arrayBuffer(),
    blob: () => request.blob(),
  };
}

function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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
  payload: Payload,
  request: Request,
  options: RESTOptions
): Promise<Response> {
  try {
    let result: any;

    switch (method) {
      case 'GET':
        if (id) {
          // Find by ID
          result = await payload.findByID({
            collection,
            id,
            ...options,
          });
        } else {
          // Find multiple
          result = await payload.find({
            collection,
            ...options,
          });
        }
        break;

      case 'POST':
        // Create
        const createData = await request.json();
        result = await payload.create({
          collection,
          data: createData,
          ...options,
        });
        break;

      case 'PATCH':
        if (!id) {
          return new Response(JSON.stringify({ message: 'ID required for update operation' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Update
        const updateData = await request.json();
        result = await payload.update({
          collection,
          id,
          data: updateData,
          ...options,
        });
        break;

      case 'DELETE':
        if (!id) {
          return new Response(JSON.stringify({ message: 'ID required for delete operation' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Delete
        result = await payload.delete({
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });

  } catch (error: any) {
    console.error('RevealUI API Error:', error);
    return new Response(JSON.stringify({
      message: error.message || 'Internal server error',
      errors: [{ message: error.message || 'Internal server error' }]
    }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function handleGlobalOperation(
  method: string,
  global: string,
  payload: Payload,
  request: Request,
  options: RESTOptions
): Promise<Response> {
  try {
    let result: any;

    switch (method) {
      case 'GET':
        // Find global
        result = await payload.globals[global].find(options);
        break;

      case 'POST':
      case 'PATCH':
        // Update global
        const updateData = await request.json();
        result = await payload.globals[global].update({
          data: updateData,
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });

  } catch (error: any) {
    console.error('RevealUI Global API Error:', error);
    return new Response(JSON.stringify({
      message: error.message || 'Internal server error',
      errors: [{ message: error.message || 'Internal server error' }]
    }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function handleRESTRequest(
  request: Request,
  config: Config,
  payload: Payload
): Promise<Response> {
  // Handle CORS
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    return corsResponse;
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Parse query parameters
  const options = parseQueryParams(url.searchParams);

  // Create payload request
  const payloadRequest = createPayloadRequest(request);
  payloadRequest.payload = payload;

  try {
    // Route handling
    if (pathParts[0] === 'collections' && pathParts[1]) {
      const collection = pathParts[1];
      const id = pathParts[2]; // Optional ID

      if (!payload.collections[collection]) {
        return new Response(JSON.stringify({ message: `Collection '${collection}' not found` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return await handleCollectionOperation(
        request.method,
        collection,
        id,
        payload,
        request,
        options
      );

    } else if (pathParts[0] === 'globals' && pathParts[1]) {
      const global = pathParts[1];

      if (!payload.globals[global]) {
        return new Response(JSON.stringify({ message: `Global '${global}' not found` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return await handleGlobalOperation(
        request.method,
        global,
        payload,
        request,
        options
      );

    } else {
      return new Response(JSON.stringify({ message: 'Route not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('RevealUI REST API Error:', error);
    return new Response(JSON.stringify({
      message: error.message || 'Internal server error',
      errors: [{ message: error.message || 'Internal server error' }]
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// Route handlers for Next.js
export function createRESTHandlers(config: Config, payload: Payload) {
  const handler = async (request: Request, context?: any) => {
    return await handleRESTRequest(request, config, payload);
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
