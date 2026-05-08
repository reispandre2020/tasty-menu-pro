import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Admin client - service role key. NEVER import in client code.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
