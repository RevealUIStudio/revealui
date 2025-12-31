// import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
// import { supabaseServerClient } from "./supabaseServerClient";
// import { supabaseBrowserClient } from "./supabaseBrowserClient";
// export const supabaseServer = supabaseServerClient(DEFAULT_COOKIE_OPTIONS);
// export const supabaseBrowser = supabaseBrowserClient();
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { IncomingMessage, ServerResponse } from "http";
import { Database } from "../types";

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
}

export default function createClient(context: Context) {
  const cookies = parseCookieHeader(context.req.headers.cookie ?? "");

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(): Promise<Array<{ name: string; value: string }> | null> {
          return Promise.resolve(
            cookies.map((c) => ({
              name: c.name,
              value: c.value || "",
            }))
          );
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            context.res.appendHeader(
              "Set-Cookie",
              serializeCookieHeader(name, value, options),
            ),
          );
        },
      },
    },
  );
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
