/**
 * REST API handler tests  -  validates routing, CRUD operations,
 * query parameter parsing, CORS, error handling, and response formats.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIResponse } from '../../api/rest.js';
import { createRESTHandlers, handleRESTRequest } from '../../api/rest.js';
import type {
  Config,
  RevealCollection,
  RevealDocument,
  RevealGlobal,
  RevealPaginatedResult,
  RevealUIInstance,
} from '../../types/index.js';

// ---------------------------------------------------------------------------
// Mock the logger to suppress output during tests
// ---------------------------------------------------------------------------

vi.mock('../../instance/logger.js', () => ({
  defaultLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  return new Request(url, init);
}

async function parseBody<T = APIResponse>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function createMockCollection(): RevealCollection {
  return {
    slug: 'posts',
    fields: [],
    config: {} as RevealCollection['config'],
  } as unknown as RevealCollection;
}

function createMockGlobal(): RevealGlobal {
  return {
    slug: 'settings',
    fields: [],
    find: vi.fn(),
    update: vi.fn(),
  } as unknown as RevealGlobal;
}

const sampleDoc: RevealDocument = {
  id: '1',
  title: 'Test Post',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const paginatedResult: RevealPaginatedResult = {
  docs: [sampleDoc],
  totalDocs: 1,
  limit: 10,
  totalPages: 1,
  page: 1,
  pagingCounter: 1,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
};

function createMockRevealUI(overrides?: Partial<RevealUIInstance>): RevealUIInstance {
  return {
    db: null,
    collections: {
      posts: createMockCollection(),
    },
    globals: {
      settings: createMockGlobal(),
    },
    config: {} as RevealUIInstance['config'],
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as RevealUIInstance['logger'],
    find: vi.fn().mockResolvedValue(paginatedResult),
    findByID: vi.fn().mockResolvedValue(sampleDoc),
    create: vi.fn().mockResolvedValue(sampleDoc),
    update: vi.fn().mockResolvedValue(sampleDoc),
    delete: vi.fn().mockResolvedValue(sampleDoc),
    login: vi.fn(),
    ...overrides,
  } as unknown as RevealUIInstance;
}

function createMockConfig(overrides?: Partial<Config>): Config {
  return {
    ...overrides,
  } as Config;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REST API handler', () => {
  let revealui: RevealUIInstance;
  let config: Config;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    revealui = createMockRevealUI();
    config = createMockConfig();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS', () => {
    it('returns 200 with CORS headers for OPTIONS preflight', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://example.com' },
      });
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('returns null body for OPTIONS preflight', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
      });
      const response = await handleRESTRequest(request, config, revealui);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('allows matching origin from config cors string', async () => {
      const corsConfig = createMockConfig({ cors: 'http://example.com' } as Partial<Config>);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://example.com' },
      });
      const response = await handleRESTRequest(request, corsConfig, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
    });

    it('allows matching origin from config cors array', async () => {
      const corsConfig = createMockConfig({
        cors: ['http://example.com', 'http://other.com'],
      } as Partial<Config>);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://other.com' },
      });
      const response = await handleRESTRequest(request, corsConfig, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://other.com');
    });

    it('allows matching origin from config cors object with origins', async () => {
      const corsConfig = createMockConfig({
        cors: { origins: ['http://allowed.com'] },
      } as Partial<Config>);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://allowed.com' },
      });
      const response = await handleRESTRequest(request, corsConfig, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://allowed.com');
    });

    it('allows wildcard origin in development mode', async () => {
      process.env.NODE_ENV = 'development';
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
      });
      const response = await handleRESTRequest(request, config, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('falls back to REVEALUI_CORS_ORIGINS env var', async () => {
      process.env.REVEALUI_CORS_ORIGINS = 'http://env-origin.com, http://other.com';
      process.env.NODE_ENV = 'production';
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://env-origin.com' },
      });
      const response = await handleRESTRequest(request, config, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://env-origin.com');
    });

    it('uses reveal.corsOrigins from config', async () => {
      const corsConfig = createMockConfig({
        reveal: { corsOrigins: ['http://reveal-config.com'] },
      } as Partial<Config>);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
        headers: { Origin: 'http://reveal-config.com' },
      });
      const response = await handleRESTRequest(request, corsConfig, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://reveal-config.com');
    });

    it('sets Access-Control-Allow-Credentials to true', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
      });
      const response = await handleRESTRequest(request, config, revealui);
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('includes CORS headers on non-preflight responses', async () => {
      process.env.NODE_ENV = 'development';
      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  // =========================================================================
  // Routing
  // =========================================================================

  describe('routing', () => {
    it('returns 404 for unknown routes', async () => {
      const request = createRequest('http://localhost:3000/api/unknown');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(404);
      expect(body.message).toBe('Route not found');
    });

    it('returns 404 for collection-less path', async () => {
      const request = createRequest('http://localhost:3000/api/collections');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(404);
      expect(body.message).toBe('Route not found');
    });

    it('returns 404 for non-existent collection', async () => {
      const request = createRequest('http://localhost:3000/api/collections/nonexistent');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(404);
      expect(body.message).toContain('nonexistent');
      expect(body.message).toContain('not found');
    });

    it('returns 404 for non-existent global', async () => {
      const request = createRequest('http://localhost:3000/api/globals/nonexistent');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(404);
      expect(body.message).toContain('nonexistent');
      expect(body.message).toContain('not found');
    });

    it('returns 404 for global-less path', async () => {
      const request = createRequest('http://localhost:3000/api/globals');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(404);
    });

    it('strips api prefix from path', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(200);
    });

    it('handles paths without api prefix', async () => {
      const request = createRequest('http://localhost:3000/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(200);
    });

    it('extracts ID from path segments', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts/123');
      await handleRESTRequest(request, config, revealui);

      expect(revealui.findByID).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'posts', id: '123' }),
      );
    });
  });

  // =========================================================================
  // Collection CRUD Operations
  // =========================================================================

  describe('collection operations', () => {
    describe('GET (list)', () => {
      it('returns paginated result for collection listing', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts');
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody<RevealPaginatedResult>(response);

        expect(response.status).toBe(200);
        expect(body.docs).toHaveLength(1);
        expect(body.totalDocs).toBe(1);
        expect(body.limit).toBe(10);
        expect(body.page).toBe(1);
        expect(body.hasPrevPage).toBe(false);
        expect(body.hasNextPage).toBe(false);
      });

      it('calls revealui.find with collection name', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ collection: 'posts' }),
        );
      });

      it('sets Content-Type to application/json', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts');
        const response = await handleRESTRequest(request, config, revealui);

        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });

    describe('GET (by ID)', () => {
      it('returns a single document', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts/1');
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody<RevealDocument>(response);

        expect(response.status).toBe(200);
        expect(body.id).toBe('1');
        expect(body.title).toBe('Test Post');
      });

      it('calls revealui.findByID with correct params', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts/abc-123');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.findByID).toHaveBeenCalledWith(
          expect.objectContaining({ collection: 'posts', id: 'abc-123' }),
        );
      });
    });

    describe('POST (create)', () => {
      it('creates a document and returns 200', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts', {
          method: 'POST',
          body: { title: 'New Post', content: 'Hello' },
        });
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody<RevealDocument>(response);

        expect(response.status).toBe(200);
        expect(body.id).toBe('1');
      });

      it('passes request body as data to create', async () => {
        const createData = { title: 'New Post', content: 'Hello' };
        const request = createRequest('http://localhost:3000/api/collections/posts', {
          method: 'POST',
          body: createData,
        });
        await handleRESTRequest(request, config, revealui);

        expect(revealui.create).toHaveBeenCalledWith(
          expect.objectContaining({
            collection: 'posts',
            data: createData,
          }),
        );
      });
    });

    describe('PATCH (update)', () => {
      it('updates a document and returns 200', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts/1', {
          method: 'PATCH',
          body: { title: 'Updated Post' },
        });
        const response = await handleRESTRequest(request, config, revealui);

        expect(response.status).toBe(200);
      });

      it('passes request body and ID to update', async () => {
        const updateData = { title: 'Updated Post' };
        const request = createRequest('http://localhost:3000/api/collections/posts/1', {
          method: 'PATCH',
          body: updateData,
        });
        await handleRESTRequest(request, config, revealui);

        expect(revealui.update).toHaveBeenCalledWith(
          expect.objectContaining({
            collection: 'posts',
            id: '1',
            data: updateData,
          }),
        );
      });

      it('returns 400 when PATCH has no ID', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts', {
          method: 'PATCH',
          body: { title: 'Updated' },
        });
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody(response);

        expect(response.status).toBe(400);
        expect(body.message).toContain('ID required');
      });
    });

    describe('DELETE', () => {
      it('deletes a document and returns 200', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts/1', {
          method: 'DELETE',
        });
        const response = await handleRESTRequest(request, config, revealui);

        expect(response.status).toBe(200);
      });

      it('calls revealui.delete with correct params', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts/1', {
          method: 'DELETE',
        });
        await handleRESTRequest(request, config, revealui);

        expect(revealui.delete).toHaveBeenCalledWith(
          expect.objectContaining({ collection: 'posts', id: '1' }),
        );
      });

      it('returns 400 when DELETE has no ID', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts', {
          method: 'DELETE',
        });
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody(response);

        expect(response.status).toBe(400);
        expect(body.message).toContain('ID required');
      });
    });

    describe('unsupported methods', () => {
      it('returns 405 for PUT on collections', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts', {
          method: 'PUT',
        });
        const response = await handleRESTRequest(request, config, revealui);
        const body = await parseBody(response);

        expect(response.status).toBe(405);
        expect(body.message).toBe('Method not allowed');
      });
    });
  });

  // =========================================================================
  // Query Parameter Parsing
  // =========================================================================

  describe('query parameter parsing', () => {
    describe('pagination', () => {
      it('parses limit parameter', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?limit=25');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
      });

      it('parses page parameter', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?page=3');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
      });

      it('parses limit and page together', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?limit=5&page=2');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, page: 2 }));
      });
    });

    describe('sorting', () => {
      it('parses sort parameter', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?sort=-createdAt',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ sort: '-createdAt' }));
      });
    });

    describe('field selection', () => {
      it('parses select parameter as JSON', async () => {
        const selectObj = { title: true, content: true };
        const encoded = encodeURIComponent(JSON.stringify(selectObj));
        const request = createRequest(
          `http://localhost:3000/api/collections/posts?select=${encoded}`,
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ select: selectObj }));
      });

      it('ignores invalid select JSON', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?select=not-json',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.not.objectContaining({ select: expect.anything() }),
        );
      });
    });

    describe('relationship population', () => {
      it('parses populate parameter as JSON', async () => {
        const populateObj = { author: { depth: 1 } };
        const encoded = encodeURIComponent(JSON.stringify(populateObj));
        const request = createRequest(
          `http://localhost:3000/api/collections/posts?populate=${encoded}`,
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ populate: populateObj }),
        );
      });

      it('ignores invalid populate JSON', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?populate={broken',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.not.objectContaining({ populate: expect.anything() }),
        );
      });
    });

    describe('where filter', () => {
      it('parses where parameter as JSON', async () => {
        const whereObj = { status: { equals: 'published' } };
        const encoded = encodeURIComponent(JSON.stringify(whereObj));
        const request = createRequest(
          `http://localhost:3000/api/collections/posts?where=${encoded}`,
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ where: whereObj }));
      });

      it('ignores invalid where JSON', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?where=invalid');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.not.objectContaining({ where: expect.anything() }),
        );
      });
    });

    describe('depth', () => {
      it('parses depth parameter', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?depth=2');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ depth: 2 }));
      });
    });

    describe('locale', () => {
      it('parses locale parameter', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?locale=en');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
      });

      it('parses fallbackLocale parameter', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?fallbackLocale=de',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ fallbackLocale: 'de' }),
        );
      });
    });

    describe('boolean parameters', () => {
      it('parses overrideAccess=true', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?overrideAccess=true',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ overrideAccess: true }),
        );
      });

      it('parses overrideAccess=false', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?overrideAccess=false',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ overrideAccess: false }),
        );
      });

      it('parses showHiddenFields=true', async () => {
        const request = createRequest(
          'http://localhost:3000/api/collections/posts?showHiddenFields=true',
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({ showHiddenFields: true }),
        );
      });

      it('parses draft=true', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?draft=true');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ draft: true }));
      });

      it('parses draft=false', async () => {
        const request = createRequest('http://localhost:3000/api/collections/posts?draft=false');
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(expect.objectContaining({ draft: false }));
      });
    });

    describe('combined parameters', () => {
      it('parses multiple parameters simultaneously', async () => {
        const whereObj = { status: { equals: 'published' } };
        const encoded = encodeURIComponent(JSON.stringify(whereObj));
        const request = createRequest(
          `http://localhost:3000/api/collections/posts?limit=5&page=2&sort=-createdAt&depth=1&locale=en&where=${encoded}&draft=true`,
        );
        await handleRESTRequest(request, config, revealui);

        expect(revealui.find).toHaveBeenCalledWith(
          expect.objectContaining({
            collection: 'posts',
            limit: 5,
            page: 2,
            sort: '-createdAt',
            depth: 1,
            locale: 'en',
            where: whereObj,
            draft: true,
          }),
        );
      });
    });
  });

  // =========================================================================
  // Global Operations
  // =========================================================================

  describe('global operations', () => {
    const mockGlobal = (): RevealGlobal => {
      const g = createMockGlobal();
      (g.find as ReturnType<typeof vi.fn>).mockResolvedValue(sampleDoc);
      (g.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...sampleDoc, title: 'Updated' });
      return g;
    };

    beforeEach(() => {
      const g = mockGlobal();
      revealui = createMockRevealUI({
        globals: { settings: g },
      });
    });

    it('returns global data for GET', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody<RevealDocument>(response);

      expect(response.status).toBe(200);
      expect(body.id).toBe('1');
    });

    it('calls global.find for GET', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings');
      await handleRESTRequest(request, config, revealui);

      expect(revealui.globals.settings.find).toHaveBeenCalled();
    });

    it('updates global data for POST', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings', {
        method: 'POST',
        body: { siteName: 'New Site' },
      });
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(200);
      expect(revealui.globals.settings.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { siteName: 'New Site' } }),
      );
    });

    it('updates global data for PATCH', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings', {
        method: 'PATCH',
        body: { siteName: 'Updated Site' },
      });
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(200);
      expect(revealui.globals.settings.update).toHaveBeenCalled();
    });

    it('returns 405 for DELETE on globals', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings', {
        method: 'DELETE',
      });
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(405);
      expect(body.message).toBe('Method not allowed');
    });

    it('returns 405 for PUT on globals', async () => {
      const request = createRequest('http://localhost:3000/api/globals/settings', {
        method: 'PUT',
      });
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(405);
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  describe('error handling', () => {
    it('returns 500 with sanitized message for server errors', async () => {
      const findMock = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(500);
      expect(body.message).toBe('An internal server error occurred');
      expect(body.errors).toEqual([{ message: 'An internal server error occurred' }]);
    });

    it('does not expose internal error details in response', async () => {
      const findMock = vi.fn().mockRejectedValue(new Error('secret database info: password=abc'));
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(body.message).not.toContain('secret');
      expect(body.message).not.toContain('password');
    });

    it('preserves custom status codes from errors', async () => {
      const error = new Error('Not authorized') as Error & { status: number };
      error.status = 403;
      const findMock = vi.fn().mockRejectedValue(error);
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(403);
      expect(body.message).toBe('Not authorized');
    });

    it('returns client-visible message for 4xx errors', async () => {
      const error = new Error('Validation failed: title is required') as Error & { status: number };
      error.status = 422;
      const findMock = vi.fn().mockRejectedValue(error);
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(422);
      expect(body.message).toBe('Validation failed: title is required');
    });

    it('sanitizes 5xx error messages', async () => {
      const error = new Error('Internal stack trace') as Error & { status: number };
      error.status = 502;
      const findMock = vi.fn().mockRejectedValue(error);
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(502);
      expect(body.message).toBe('An internal server error occurred');
    });

    it('handles non-Error thrown values', async () => {
      const findMock = vi.fn().mockRejectedValue('string error');
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.status).toBe(500);
    });

    it('includes CORS headers on error responses', async () => {
      process.env.NODE_ENV = 'development';
      const findMock = vi.fn().mockRejectedValue(new Error('fail'));
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('returns JSON content type on error responses', async () => {
      const findMock = vi.fn().mockRejectedValue(new Error('fail'));
      revealui = createMockRevealUI({ find: findMock });

      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('handles global operation errors', async () => {
      const g = createMockGlobal();
      (g.find as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Global read error'));
      revealui = createMockRevealUI({ globals: { settings: g } });

      const request = createRequest('http://localhost:3000/api/globals/settings');
      const response = await handleRESTRequest(request, config, revealui);
      const body = await parseBody(response);

      expect(response.status).toBe(500);
      expect(body.message).toBe('An internal server error occurred');
    });
  });

  // =========================================================================
  // Response Format
  // =========================================================================

  describe('response format', () => {
    it('returns valid JSON for all responses', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handleRESTRequest(request, config, revealui);
      const text = await response.text();

      expect(() => JSON.parse(text)).not.toThrow();
    });

    it('returns JSON for 404 responses', async () => {
      const request = createRequest('http://localhost:3000/api/unknown');
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      const body = await parseBody(response);
      expect(body.message).toBeDefined();
    });

    it('returns JSON for 400 responses', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'PATCH',
        body: {},
      });
      const response = await handleRESTRequest(request, config, revealui);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  // =========================================================================
  // createRESTHandlers
  // =========================================================================

  describe('createRESTHandlers', () => {
    it('returns handlers for all HTTP methods', () => {
      const handlers = createRESTHandlers(config, revealui);

      expect(handlers.GET).toBeTypeOf('function');
      expect(handlers.POST).toBeTypeOf('function');
      expect(handlers.PUT).toBeTypeOf('function');
      expect(handlers.DELETE).toBeTypeOf('function');
      expect(handlers.PATCH).toBeTypeOf('function');
      expect(handlers.OPTIONS).toBeTypeOf('function');
    });

    it('GET handler delegates to handleRESTRequest', async () => {
      const handlers = createRESTHandlers(config, revealui);
      const request = createRequest('http://localhost:3000/api/collections/posts');
      const response = await handlers.GET(request);

      expect(response.status).toBe(200);
      expect(revealui.find).toHaveBeenCalled();
    });

    it('POST handler processes create operations', async () => {
      const handlers = createRESTHandlers(config, revealui);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'POST',
        body: { title: 'Created via handler' },
      });
      const response = await handlers.POST(request);

      expect(response.status).toBe(200);
      expect(revealui.create).toHaveBeenCalled();
    });

    it('OPTIONS handler returns CORS preflight', async () => {
      const handlers = createRESTHandlers(config, revealui);
      const request = createRequest('http://localhost:3000/api/collections/posts', {
        method: 'OPTIONS',
      });
      const response = await handlers.OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('accepts optional context parameter', async () => {
      const handlers = createRESTHandlers(config, revealui);
      const request = createRequest('http://localhost:3000/api/collections/posts');
      const context = { params: { slug: 'posts' } };

      // Should not throw when context is provided
      const response = await handlers.GET(request, context);
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Query options forwarded to findByID, create, update, delete
  // =========================================================================

  describe('options forwarding', () => {
    it('forwards depth to findByID', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts/1?depth=3');
      await handleRESTRequest(request, config, revealui);

      expect(revealui.findByID).toHaveBeenCalledWith(expect.objectContaining({ depth: 3 }));
    });

    it('forwards locale to create', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts?locale=fr', {
        method: 'POST',
        body: { title: 'Bonjour' },
      });
      await handleRESTRequest(request, config, revealui);

      expect(revealui.create).toHaveBeenCalledWith(expect.objectContaining({ locale: 'fr' }));
    });

    it('forwards overrideAccess to update', async () => {
      const request = createRequest(
        'http://localhost:3000/api/collections/posts/1?overrideAccess=true',
        {
          method: 'PATCH',
          body: { title: 'Updated' },
        },
      );
      await handleRESTRequest(request, config, revealui);

      expect(revealui.update).toHaveBeenCalledWith(
        expect.objectContaining({ overrideAccess: true }),
      );
    });

    it('forwards draft to delete', async () => {
      const request = createRequest('http://localhost:3000/api/collections/posts/1?draft=true', {
        method: 'DELETE',
      });
      await handleRESTRequest(request, config, revealui);

      expect(revealui.delete).toHaveBeenCalledWith(expect.objectContaining({ draft: true }));
    });

    it('forwards showHiddenFields to find', async () => {
      const request = createRequest(
        'http://localhost:3000/api/collections/posts?showHiddenFields=true',
      );
      await handleRESTRequest(request, config, revealui);

      expect(revealui.find).toHaveBeenCalledWith(
        expect.objectContaining({ showHiddenFields: true }),
      );
    });
  });
});
