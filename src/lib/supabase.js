import { createClient } from "@supabase/supabase-js";

export function resolveSupabaseClient(url, anonKey, createClientFn = createClient) {
  const isSupabaseConfigured = Boolean(url && anonKey);

  if (!isSupabaseConfigured) {
    console.warn(
      "[supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY missing — auth and data features are disabled in this environment.",
    );
  }

  return {
    supabase: isSupabaseConfigured ? createClientFn(url, anonKey) : null,
    isSupabaseConfigured,
  };
}

const env = import.meta.env ?? {};
const { supabase, isSupabaseConfigured } = resolveSupabaseClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
);

export { supabase, isSupabaseConfigured };

export const SUPABASE_UNAVAILABLE_MESSAGE =
  "Authentication unavailable in this environment.";
export const SUPABASE_UNAVAILABLE_ERROR = { message: SUPABASE_UNAVAILABLE_MESSAGE };
