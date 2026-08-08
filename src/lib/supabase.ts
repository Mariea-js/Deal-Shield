import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Browser-safe Supabase client. Uses the publishable anon key from config.ts.
// Env-var overrides are honored when present (e.g. local dev).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Edge function base URL (functions live under /functions/v1).
export const EDGE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;