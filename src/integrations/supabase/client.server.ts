import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Admin client - service role key. NEVER import in client code.
let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin env missing: set VITE_SUPABASE_URL and SB_SERVICE_ROLE_KEY",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const c = getAdmin();
    const v = Reflect.get(c as object, prop, receiver);
    return typeof v === "function" ? v.bind(c) : v;
  },
});
