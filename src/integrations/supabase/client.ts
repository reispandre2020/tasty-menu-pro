import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(key: string): string | undefined {
  const viteVal = (import.meta.env as Record<string, string | undefined>)[key];
  if (viteVal) return viteVal;
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
}

const SUPABASE_URL =
  readEnv("VITE_SUPABASE_URL") ?? readEnv("SUPABASE_URL") ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  readEnv("SUPABASE_ANON_KEY") ??
  readEnv("VITE_SUPABASE_ANON_KEY") ??
  "";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
  return _client;
}

// Proxy so module-level import never throws; createClient runs lazily on first use.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
