import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Admin client - service role key. NEVER import in client code.
let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://wpgblkvhktecscgxmxou.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin env missing: set SUPABASE_SERVICE_ROLE_KEY or SB_SERVICE_ROLE_KEY",
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
