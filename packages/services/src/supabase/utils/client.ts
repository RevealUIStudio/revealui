'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types.js';

export default function createClient(): ReturnType<typeof createBrowserClient<Database>> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return null during build if credentials not available
  if (!(supabaseUrl && supabaseKey)) {
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
