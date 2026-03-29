// import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
// import { supabaseServerClient } from "./supabaseServerClient";
// import { supabaseBrowserClient } from "./supabaseBrowserClient";
// export const supabaseServer = supabaseServerClient(DEFAULT_COOKIE_OPTIONS);
// export const supabaseBrowser = supabaseBrowserClient();

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { Database } from '../types.js';

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
}

export default function createClient(
  context: Context,
): ReturnType<typeof createServerClient<Database>> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return null during build if credentials not available
  if (!(supabaseUrl && supabaseKey)) {
    return null;
  }

  const cookies = parseCookieHeader(context.req.headers.cookie ?? '');

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll(): Promise<Array<{ name: string; value: string }> | null> {
        return Promise.resolve(
          cookies.map((c) => ({
            name: c.name,
            value: c.value || '',
          })),
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options));
        });
      },
    },
  });
}
// {
//   cookies: {
//     getAll() {
//       return cookieStore.getAll();
//     },
//     setAll(cookiesToSet) {
//       try {
//         cookiesToSet.forEach(({ name, value, options }) =>
//           cookieStore.set(name, value, options),
//         );
//       } catch {
//         // The `setAll` method was called from a Server Component.
//         // This can be ignored if you have middleware refreshing
//         // user sessions.
//       }
//     },
//   },
// },
