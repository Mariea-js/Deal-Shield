// Publishable (public) Supabase configuration for the browser client.
// The anon key is NOT a secret — it is designed to be public.
// The service-role key and AI provider keys live ONLY in Supabase Edge Function
// secrets and are never bundled into the frontend.

export const SUPABASE_URL = "https://tcitzqvatwiupswedokl.supabase.co";
// Legacy anon JWT — required by edge function auth (isAuthorizedCaller checks JWT shape).
// Listed as a publishable key (disabled:false) via the Supabase Management API.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaXR6cXZhdHdpdXBzd2Vkb2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwODc1MDcsImV4cCI6MjEwMTY2MzUwN30.qH57O4N9Xq39Mv-AMqoAa0Kb-H90Ll_tfyI31877mBc";