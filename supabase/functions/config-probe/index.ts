// config-probe — temporary dev helper to check which Edge Function secrets exist.
// Returns boolean flags only (no values). Harmless to deploy alongside other functions.
// DELETE AFTER USE: This is a dev-only probe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // NOTE: a 204 response MUST have a null body — the Deno Edge Runtime
    // rejects `new Response("ok", { status: 204 })` with
    // "Response with null body status cannot have body", which makes the
    // CORS preflight fail (500) and the browser block the POST.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response(
    JSON.stringify({
      hasAiMlApiKey: Boolean(Deno.env.get("AI_ML_API_KEY")),
      liveAnalysisEnabled: Deno.env.get("LIVE_ANALYSIS_ENABLED") === "true",
      hasAiMlModel: Boolean(Deno.env.get("AI_ML_MODEL")),
      hasAiMlUrl: Boolean(Deno.env.get("AI_ML_API_URL")),
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
});