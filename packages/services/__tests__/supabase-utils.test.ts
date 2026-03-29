import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClientMock = vi.fn();
const createServerClientMock = vi.fn();
const parseCookieHeaderMock = vi.fn();
const serializeCookieHeaderMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
  createServerClient: createServerClientMock,
  parseCookieHeader: parseCookieHeaderMock,
  serializeCookieHeader: serializeCookieHeaderMock,
}));

const originalEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function restoreSupabaseEnv() {
  if (originalEnv.supabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.supabaseUrl;
  }

  if (originalEnv.supabaseAnonKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.supabaseAnonKey;
  }
}

describe('supabase utility clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    restoreSupabaseEnv();
  });

  describe('createBrowserClient', () => {
    it('returns null when public Supabase env vars are missing', async () => {
      const { default: createClient } = await import('../src/supabase/utils/client.js');

      expect(createClient()).toBeNull();
      expect(createBrowserClientMock).not.toHaveBeenCalled();
    });

    it('creates a browser client when env vars are present', async () => {
      const client = { kind: 'browser-client' };
      createBrowserClientMock.mockReturnValue(client);
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      const { default: createClient } = await import('../src/supabase/utils/client.js');

      expect(createClient()).toBe(client);
      expect(createBrowserClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
      );
    });
  });

  describe('createServerClient', () => {
    it('returns null when public Supabase env vars are missing', async () => {
      const { default: createClient } = await import('../src/supabase/utils/server.js');
      const context = {
        req: { headers: {} } as IncomingMessage,
        res: { appendHeader: vi.fn() } as unknown as ServerResponse,
      };

      expect(createClient(context)).toBeNull();
      expect(createServerClientMock).not.toHaveBeenCalled();
      expect(parseCookieHeaderMock).not.toHaveBeenCalled();
    });

    it('passes parsed cookies through and appends serialized cookies on setAll', async () => {
      const client = { kind: 'server-client' };
      const appendHeader = vi.fn();

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      parseCookieHeaderMock.mockReturnValue([
        { name: 'sb-access-token', value: 'access' },
        { name: 'sb-refresh-token', value: undefined },
      ]);
      serializeCookieHeaderMock
        .mockReturnValueOnce('sb-access-token=new-access; Path=/')
        .mockReturnValueOnce('sb-refresh-token=new-refresh; Path=/');
      createServerClientMock.mockImplementation((_url, _key, options) => {
        void options.cookies.getAll();
        options.cookies.setAll([
          {
            name: 'sb-access-token',
            value: 'new-access',
            options: { path: '/' },
          },
          {
            name: 'sb-refresh-token',
            value: 'new-refresh',
            options: { path: '/' },
          },
        ]);
        return client;
      });

      const { default: createClient } = await import('../src/supabase/utils/server.js');
      const context = {
        req: { headers: { cookie: 'sb-access-token=access; sb-refresh-token=refresh' } },
        res: { appendHeader },
      } as unknown as {
        req: IncomingMessage;
        res: ServerResponse;
      };

      expect(createClient(context)).toBe(client);
      expect(parseCookieHeaderMock).toHaveBeenCalledWith(
        'sb-access-token=access; sb-refresh-token=refresh',
      );
      expect(createServerClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        }),
      );

      const options = createServerClientMock.mock.calls[0]?.[2];
      await expect(options.cookies.getAll()).resolves.toEqual([
        { name: 'sb-access-token', value: 'access' },
        { name: 'sb-refresh-token', value: '' },
      ]);

      expect(serializeCookieHeaderMock).toHaveBeenNthCalledWith(
        1,
        'sb-access-token',
        'new-access',
        { path: '/' },
      );
      expect(serializeCookieHeaderMock).toHaveBeenNthCalledWith(
        2,
        'sb-refresh-token',
        'new-refresh',
        { path: '/' },
      );
      expect(appendHeader).toHaveBeenNthCalledWith(
        1,
        'Set-Cookie',
        'sb-access-token=new-access; Path=/',
      );
      expect(appendHeader).toHaveBeenNthCalledWith(
        2,
        'Set-Cookie',
        'sb-refresh-token=new-refresh; Path=/',
      );
    });
  });

  describe('createServerClientFromRequest', () => {
    it('returns null when public Supabase env vars are missing', async () => {
      const { createServerClientFromRequest } = await import('../src/supabase/utils/web.js');

      expect(createServerClientFromRequest(new Request('https://example.com'))).toBeNull();
      expect(createServerClientMock).not.toHaveBeenCalled();
    });

    it('parses cookies from the request header and treats setAll as a no-op', async () => {
      const client = { kind: 'web-client' };
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      createServerClientMock.mockReturnValue(client);

      const { createServerClientFromRequest } = await import('../src/supabase/utils/web.js');

      expect(
        createServerClientFromRequest(
          new Request('https://example.com', {
            headers: {
              cookie: 'foo=bar; hello=world; bare-cookie',
            },
          }),
        ),
      ).toBe(client);

      expect(createServerClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        }),
      );

      const options = createServerClientMock.mock.calls[0]?.[2];
      await expect(options.cookies.getAll()).resolves.toEqual([
        { name: 'foo', value: 'bar' },
        { name: 'hello', value: 'world' },
        { name: 'bare-cookie', value: '' },
      ]);

      expect(() =>
        options.cookies.setAll([
          { name: 'sb-access-token', value: 'updated', options: { path: '/' } },
        ]),
      ).not.toThrow();
    });

    it('returns an empty cookie list when the request has no cookie header', async () => {
      const client = { kind: 'web-client' };
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      createServerClientMock.mockReturnValue(client);

      const { createServerClientFromRequest } = await import('../src/supabase/utils/web.js');

      createServerClientFromRequest(new Request('https://example.com'));

      const options = createServerClientMock.mock.calls[0]?.[2];
      await expect(options.cookies.getAll()).resolves.toEqual([]);
    });
  });
});
