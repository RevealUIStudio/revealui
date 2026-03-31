import { createServerClient as createSSRClient } from '@supabase/ssr';
import type { Database } from '../types.js';

export function createServerClientFromRequest(
  request: Request,
): ReturnType<typeof createSSRClient<Database>> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!(supabaseUrl && supabaseKey)) {
    return null;
  }

  const client = createSSRClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get('cookie') || '';
        // Parse cookies from header
        if (!cookieHeader) {
          return Promise.resolve([]);
        }
        const cookies = cookieHeader.split(';').map((c) => {
          const trimmed = c.trim();
          const equalIndex = trimmed.indexOf('=');
          if (equalIndex === -1) {
            return { name: trimmed, value: '' };
          }
          const name = trimmed.slice(0, equalIndex);
          const value = trimmed.slice(equalIndex + 1);
          return { name, value };
        });
        return Promise.resolve(cookies);
      },
      setAll() {
        // In serverless/Web API environment, we can't set cookies directly here
        // Cookies should be set via Response headers in the route handler
        // This is a no-op here - actual cookie setting happens in route handler
      },
    },
  });

  return client;
}
