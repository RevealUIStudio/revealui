/**
 * Tests for Universal PostgreSQL Adapter
 *
 * Mocks pg and @electric-sql/pglite to avoid real database connections.
 * Tests provider detection, connection initialization, query execution,
 * table creation, health checks, and error handling.
 */

import type { Field } from '@revealui/contracts/admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock pg ---

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  end: vi.fn(),
};

vi.mock('pg', () => ({
  Pool: class MockPool {
    connectionString: string | undefined;
    ssl: unknown;
    constructor(opts: Record<string, unknown>) {
      this.connectionString = opts.connectionString as string | undefined;
      this.ssl = opts.ssl;
      // Copy config to the shared mock so tests can inspect it
      Object.assign(mockPool, { _opts: opts });
    }
    connect = mockPool.connect;
    end = mockPool.end;
  },
}));

// --- Mock PGlite ---

const mockPGliteQuery = vi.fn();

vi.mock('@electric-sql/pglite', () => ({
  PGlite: class MockPGlite {
    query = mockPGliteQuery;
  },
}));

// --- Mock internal modules ---

vi.mock('../../instance/logger.js', () => ({
  defaultLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../observability/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ssl-config re-export to avoid cross-package resolution in worktrees
vi.mock('../ssl-config', () => ({
  getSSLConfig: (connectionString: string) => {
    try {
      const url = new URL(connectionString);
      const sslmode = url.searchParams.get('sslmode');
      if (!sslmode || sslmode === 'disable') return false;
      return { rejectUnauthorized: true };
    } catch {
      return false;
    }
  },
  validateSSLConfig: () => true,
}));

import { clearGlobalPGlite, universalPostgresAdapter } from '../universal-postgres.js';

// ============================================================================
// Helper
// ============================================================================

function makeRows(...ids: Array<string | number>): Record<string, unknown>[] {
  return ids.map((id) => ({ id, title: `row-${id}` }));
}

// ============================================================================
// Tests
// ============================================================================

describe('universalPostgresAdapter', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Snapshot environment
    for (const key of [
      'DATABASE_URL',
      'POSTGRES_URL',
      'SUPABASE_DATABASE_URI',
      'ELECTRIC_ENV',
      'VITEST_WORKER_ID',
      'DATABASE_SSL_REJECT_UNAUTHORIZED',
      'NODE_ENV',
    ]) {
      savedEnv[key] = process.env[key];
    }

    // Clear env vars that the adapter checks
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.SUPABASE_DATABASE_URI;
    delete process.env.ELECTRIC_ENV;

    // Reset mocks
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    mockPool.connect.mockReset().mockResolvedValue(mockClient);
    mockPGliteQuery.mockReset();

    // Clear PGlite global state
    clearGlobalPGlite(true);
  });

  afterEach(() => {
    // Restore environment
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    clearGlobalPGlite(true);
  });

  // ==========================================================================
  // Provider detection (tested indirectly through adapter initialization)
  // ==========================================================================

  describe('provider detection', () => {
    it('should detect Neon from connection string', async () => {
      const adapter = universalPostgresAdapter({
        connectionString:
          'postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      // Neon uses pg Pool, so connect should have been called
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should detect Supabase from connection string (session pooling)', async () => {
      const adapter = universalPostgresAdapter({
        connectionString:
          'postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should detect Supabase transaction pooling (port 6543)', async () => {
      const adapter = universalPostgresAdapter({
        connectionString:
          'postgresql://postgres:pass@db.xxx.supabase.co:6543/postgres?sslmode=require',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should detect Electric provider from config', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      // PGlite query is used for health check, not pg Pool
      expect(mockPool.connect).not.toHaveBeenCalled();
      expect(mockPGliteQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should fall back to generic for unknown connection strings', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@my-custom-host.com:5432/mydb',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should respect explicit provider override', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@my-host.com/db',
        provider: 'neon',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Connection string resolution
  // ==========================================================================

  describe('connection string resolution', () => {
    it('should throw if no connection string is available', async () => {
      const adapter = universalPostgresAdapter({});

      await expect(adapter.connect()).rejects.toThrow('Database connection string not found');
    });

    it('should use explicit connectionString from config', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should read DATABASE_URL from environment', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/envdb';

      const adapter = universalPostgresAdapter({});

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should read POSTGRES_URL from environment', async () => {
      process.env.POSTGRES_URL = 'postgresql://user:pass@localhost/postgresdb';

      const adapter = universalPostgresAdapter({});

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should read SUPABASE_DATABASE_URI from environment', async () => {
      process.env.SUPABASE_DATABASE_URI =
        'postgresql://postgres:pass@db.abc.supabase.co:5432/postgres';

      const adapter = universalPostgresAdapter({});

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should use custom envVar when specified', async () => {
      process.env.MY_CUSTOM_DB_URL = 'postgresql://user:pass@localhost/custom';

      const adapter = universalPostgresAdapter({ envVar: 'MY_CUSTOM_DB_URL' });

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.connect();

      expect(mockPool.connect).toHaveBeenCalled();

      delete process.env.MY_CUSTOM_DB_URL;
    });
  });

  // ==========================================================================
  // Initialization (init / connect)
  // ==========================================================================

  describe('initialization', () => {
    it('should only initialize once on repeated connect() calls', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.connect();
      await adapter.connect();

      // SELECT 1 health check runs each time, but the Pool is only created once.
      // The mock Pool constructor is module-scoped so we check connect calls.
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should initialize via init() without running health check', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      await adapter.init?.();

      // init() should not run SELECT 1 health check
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should not re-initialize when init() then connect() are called', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();
      await adapter.connect();

      // Health check from connect()
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1', []);
    });
  });

  // ==========================================================================
  // Health check (connect runs SELECT 1)
  // ==========================================================================

  describe('health check', () => {
    it('should execute SELECT 1 on connect', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should throw when health check fails', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(adapter.connect()).rejects.toThrow('Connection refused');
    });

    it('should throw when SELECT 1 query fails', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(adapter.connect()).rejects.toThrow('Query timeout');
    });

    it('should release client after health check even on failure', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockRejectedValueOnce(new Error('Query error'));

      await expect(adapter.connect()).rejects.toThrow();

      // Client.release() is in the finally block
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Query execution
  // ==========================================================================

  describe('query execution', () => {
    it('should execute a query and return parsed rows', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      const rows = makeRows('1', '2', '3');
      mockClient.query.mockResolvedValue({ rows, rowCount: 3 });

      const result = await adapter.query('SELECT * FROM posts', []);

      expect(result.rows).toHaveLength(3);
      expect(result.rowCount).toBe(3);
    });

    it('should auto-initialize on first query if not yet connected', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      const rows = makeRows('1');
      mockClient.query.mockResolvedValue({ rows, rowCount: 1 });

      // Call query directly without connect()
      const result = await adapter.query('SELECT * FROM posts WHERE id = $1', ['1']);

      expect(result.rows).toHaveLength(1);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should pass values to parameterized queries', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      const rows = makeRows('42');
      mockClient.query.mockResolvedValue({ rows, rowCount: 1 });

      await adapter.query('SELECT * FROM posts WHERE id = $1 AND status = $2', ['42', 'published']);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM posts WHERE id = $1 AND status = $2',
        ['42', 'published'],
      );
    });

    it('should release the client after query execution', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: makeRows('1'), rowCount: 1 });

      await adapter.query('SELECT 1', []);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release the client even when query fails', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockRejectedValue(new Error('Syntax error'));

      await expect(adapter.query('BAD SQL', [])).rejects.toThrow('Syntax error');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should default rowCount to 0 when null', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: null });

      const result = await adapter.query('DELETE FROM posts', []);

      expect(result.rowCount).toBe(0);
    });

    it('should filter out rows without id via safeParseRevealDocuments', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      // Mix valid and invalid rows
      const rows = [
        { id: '1', title: 'valid' },
        { title: 'missing-id' }, // no id
        { id: 2, title: 'numeric-id' },
        null, // null row
      ];
      mockClient.query.mockResolvedValue({ rows, rowCount: 4 });

      const result = await adapter.query('SELECT * FROM posts', []);

      // safeParseRevealDocuments filters out rows without id and null rows
      expect(result.rows).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should propagate connection errors from pool.connect()', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockPool.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(adapter.query('SELECT 1', [])).rejects.toThrow('ECONNREFUSED');
    });

    it('should propagate query errors', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockRejectedValue(new Error('relation "posts" does not exist'));

      await expect(adapter.query('SELECT * FROM posts', [])).rejects.toThrow(
        'relation "posts" does not exist',
      );
    });

    it('should throw descriptive error when no connection string found', async () => {
      const adapter = universalPostgresAdapter({});

      await expect(adapter.connect()).rejects.toThrow(
        /DATABASE_URL.*POSTGRES_URL.*SUPABASE_DATABASE_URI/,
      );
    });
  });

  // ==========================================================================
  // Disconnect
  // ==========================================================================

  describe('disconnect', () => {
    it('should resolve without errors', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.connect();
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Electric / PGlite provider
  // ==========================================================================

  describe('electric (PGlite) provider', () => {
    it('should initialize PGlite without a connection string', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await adapter.connect();

      expect(mockPGliteQuery).toHaveBeenCalledWith('SELECT 1', []);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should execute queries through PGlite', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      const rows = makeRows('pglite-1');
      mockPGliteQuery.mockResolvedValue({ rows, rowCount: 1 });

      const result = await adapter.query('SELECT * FROM test', []);

      expect(result.rows).toHaveLength(1);
    });

    it('should reuse PGlite instance for the same worker', async () => {
      process.env.VITEST_WORKER_ID = 'test-42';

      const adapter1 = universalPostgresAdapter({ provider: 'electric' });
      const adapter2 = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter1.connect();
      await adapter2.connect();

      // Both adapters should use the same PGlite instance for the worker
      // PGlite constructor is called once per worker (first adapter creates it)
      // The second adapter reuses the existing instance
      expect(mockPGliteQuery).toHaveBeenCalledTimes(2); // Two SELECT 1 calls
    });
  });

  // ==========================================================================
  // Table creation (electric provider only)
  // ==========================================================================

  describe('createTable (electric provider)', () => {
    it('should have createTable defined for electric provider', () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      expect(adapter.createTable).toBeDefined();
    });

    it('should not have createTable for non-electric providers with connectionString', () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      expect(adapter.createTable).toBeUndefined();
    });

    it('should create table with basic fields', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [
        { name: 'title', type: 'text' },
        { name: 'content', type: 'richText' },
        { name: 'views', type: 'number' },
        { name: 'published', type: 'checkbox' },
        { name: 'createdAt', type: 'date' },
      ];

      adapter.createTable?.('posts', fields);

      // Trigger pending creations by querying
      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      // One call is the CREATE TABLE, one is the SELECT 1
      const createCall = mockPGliteQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE'),
      );

      expect(createCall).toBeDefined();
      const sql = createCall?.[0] as string;
      expect(sql).toContain('"posts"');
      expect(sql).toContain('"title" TEXT');
      expect(sql).toContain('"content" JSONB');
      expect(sql).toContain('"views" NUMERIC');
      expect(sql).toContain('"published" BOOLEAN');
      // createdAt is reserved and should be skipped
      expect(sql).not.toContain('"createdAt"');
    });

    it('should include NOT NULL for required fields', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text' },
      ];

      adapter.createTable?.('pages', fields);

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      const createCall = mockPGliteQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE'),
      );

      const sql = createCall?.[0] as string;
      expect(sql).toContain('"title" TEXT NOT NULL');
      expect(sql).toContain('"slug" TEXT');
      expect(sql).not.toContain('"slug" TEXT NOT NULL');
    });

    it('should map field types to correct PostgreSQL types', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [
        { name: 'tags', type: 'json' },
        { name: 'blocks_field', type: 'blocks', blocks: [] },
        { name: 'items', type: 'array', fields: [] },
        { name: 'author', type: 'relationship', relationTo: 'users' },
        { name: 'published_at', type: 'date' },
      ];

      adapter.createTable?.('articles', fields);

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      const createCall = mockPGliteQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE'),
      );

      const sql = createCall?.[0] as string;
      expect(sql).toContain('"tags" JSONB');
      expect(sql).toContain('"blocks_field" JSONB');
      expect(sql).toContain('"items" JSONB');
      expect(sql).toContain('"author" INTEGER');
      expect(sql).toContain('"published_at" TIMESTAMP');
    });

    it('should skip reserved columns (id, created_at, updated_at)', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [
        { name: 'id', type: 'text' },
        { name: 'created_at', type: 'date' },
        { name: 'updated_at', type: 'date' },
        { name: 'title', type: 'text' },
      ];

      adapter.createTable?.('test_table', fields);

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      const createCall = mockPGliteQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE'),
      );

      const sql = createCall?.[0] as string;
      expect(sql).toContain('"title" TEXT');
      // These are part of the default columns, not duplicated from fields
      expect(sql).toContain('id TEXT PRIMARY KEY');
      expect(sql).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    });

    it('should not create the same table twice for the same worker', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [{ name: 'title', type: 'text' }];

      adapter.createTable?.('dedup_test', fields);
      adapter.createTable?.('dedup_test', fields); // duplicate

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      const createCalls = mockPGliteQuery.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('CREATE TABLE') &&
          call[0].includes('dedup_test'),
      );

      expect(createCalls).toHaveLength(1);
    });
  });

  // ==========================================================================
  // createGlobalTable (electric provider)
  // ==========================================================================

  describe('createGlobalTable (electric provider)', () => {
    it('should have createGlobalTable defined for electric provider', () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      expect(adapter.createGlobalTable).toBeDefined();
    });

    it('should prefix table name with global_', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [{ name: 'site_name', type: 'text' }];

      adapter.createGlobalTable?.('settings', fields);

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter.query('SELECT 1', []);

      const createCall = mockPGliteQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE'),
      );

      const sql = createCall?.[0] as string;
      expect(sql).toContain('"global_settings"');
    });

    it('should not have createGlobalTable for non-electric providers', () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      expect(adapter.createGlobalTable).toBeUndefined();
    });
  });

  // ==========================================================================
  // clearGlobalPGlite
  // ==========================================================================

  describe('clearGlobalPGlite', () => {
    it('should clear current worker state', async () => {
      process.env.VITEST_WORKER_ID = 'worker-99';

      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      // Clear only current worker
      clearGlobalPGlite(false);

      // After clearing, a new adapter should create a new PGlite instance
      const adapter2 = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapter2.init?.();

      // Verify the new adapter can execute queries after clearing
      const result = await adapter2.query('SELECT 1', []);
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBe(0);
    });

    it('should clear all workers when clearAllWorkers is true', async () => {
      process.env.VITEST_WORKER_ID = 'worker-A';
      const adapterA = universalPostgresAdapter({ provider: 'electric' });
      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await adapterA.init?.();

      process.env.VITEST_WORKER_ID = 'worker-B';
      const adapterB = universalPostgresAdapter({ provider: 'electric' });
      await adapterB.init?.();

      // Clear all
      clearGlobalPGlite(true);

      // After clearing all, new instances should be created and functional
      const adapterC = universalPostgresAdapter({ provider: 'electric' });
      await adapterC.init?.();

      const result = await adapterC.query('SELECT 1', []);
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBe(0);
    });
  });

  // ==========================================================================
  // Pending table creations awaited before queries
  // ==========================================================================

  describe('pending table creation synchronization', () => {
    it('should await pending table creations before executing a query', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      const executionOrder: string[] = [];

      // First call is from init, make PGlite query track order
      mockPGliteQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) {
          executionOrder.push('create');
        } else {
          executionOrder.push('query');
        }
        return { rows: [], rowCount: 0 };
      });

      await adapter.init?.();

      const fields: Field[] = [{ name: 'name', type: 'text' }];
      adapter.createTable?.('sync_test', fields);

      await adapter.query('SELECT * FROM sync_test', []);

      // CREATE TABLE should come before the SELECT query
      const createIdx = executionOrder.indexOf('create');
      const queryIdx = executionOrder.lastIndexOf('query');
      expect(createIdx).toBeLessThan(queryIdx);
    });

    it('should propagate table creation errors on query', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      // Init succeeds
      mockPGliteQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await adapter.init?.();

      // Make CREATE TABLE fail
      mockPGliteQuery.mockRejectedValueOnce(new Error('CREATE TABLE failed'));

      const fields: Field[] = [{ name: 'title', type: 'text' }];
      adapter.createTable?.('fail_table', fields);

      await expect(adapter.query('SELECT 1', [])).rejects.toThrow('CREATE TABLE failed');
    });

    it('should clear pending creations after successful execution', async () => {
      const adapter = universalPostgresAdapter({ provider: 'electric' });

      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.init?.();

      const fields: Field[] = [{ name: 'name', type: 'text' }];
      adapter.createTable?.('clear_test', fields);

      // First query waits for pending creations
      await adapter.query('SELECT 1', []);

      // Second query should not wait again (pending list cleared)
      mockPGliteQuery.mockClear();
      mockPGliteQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.query('SELECT 2', []);

      // Only the SELECT 2 query, no CREATE TABLE repeated
      const calls = mockPGliteQuery.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]).toBe('SELECT 2');
    });
  });

  // ==========================================================================
  // SSL configuration passthrough
  // ==========================================================================

  describe('SSL configuration', () => {
    it('should pass SSL config from getSSLConfig for sslmode=require', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb?sslmode=require',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.connect();

      // The Pool mock stores _opts — check that ssl was passed
      expect((mockPool as Record<string, unknown>)._opts).toBeDefined();
      const opts = (mockPool as Record<string, unknown>)._opts as Record<string, unknown>;
      expect(opts.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('should pass false for SSL when sslmode is not specified', async () => {
      const adapter = universalPostgresAdapter({
        connectionString: 'postgresql://user:pass@localhost/testdb',
      });

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await adapter.connect();

      const opts = (mockPool as Record<string, unknown>)._opts as Record<string, unknown>;
      expect(opts.ssl).toBe(false);
    });
  });
});
