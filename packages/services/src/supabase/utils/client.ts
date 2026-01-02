"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../types";

export default function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Return null during build if credentials not available
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseKey,
  );
}
