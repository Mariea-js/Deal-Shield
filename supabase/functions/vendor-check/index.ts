// vendor-check — Supabase Edge Function
//
// Screens a vendor by searching public web data via Bright Data SERP API and
// analysing the results with an AI/ML model. Returns a structured risk
// assessment with clear disclaimers about what this is (and isn't).
//
// Design (v3):
//   - AI returns ONLY structured evidence signals — NOT trustScore, riskLevel,
//     or confidence — so all three are computed deterministically in code.
//   - Results are cached for 24h to stabilise repeated checks of the same vendor.
//   - Missing data does NOT reduce the score and never becomes High/Critical.
//   - "Not assessed" replaces any claim about absent negative findings.
//
// Input:  { "companyName": "string", "websiteUrl": "optional string" }
// Output: structured VendorCheckResult (see types).
//
// Security:
//   - Bright Data API key lives solely in Supabase Edge Function secrets.
//   - AI/ML API key lives solely in Supabase Edge Function secrets.
//   - No raw API errors are exposed to the client.
//   - No secrets are logged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Config ─────────────────────────────────────────────────────────────────

const BRIGHTDATA_API_URL = "https://api.brightdata.com/request";
const BRIGHTDATA_ZONE = "deal_shield_serp";

const AI_API_URL =
  Deno.env.get("AI_ML_API_URL") ?? "https://api.aimlapi.com/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_ML_MODEL") ?? "openai/gpt-4o-mini";

const AI_TIMEOUT_MS = 30_000;
const SERP_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 2_000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ── Normalisation ──────────────────────────────────────────────────────────

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeUrl(raw: string): string {
  let u = raw.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "");
  u = u.replace(/\/+$/, "");
  u = u.replace(/^www\./, "");
  return u;
}

function buildCacheKey(companyName: string, websiteUrl: string): string {
  return `${normalizeName(companyName)}|${normalizeUrl(websiteUrl)}`;
}

// ── Auth ───────────────────────────────────────────────────────────────────

function isAuthorizedCaller(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return false;
  try {
    const payloadPart = token.split(".")[1];
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      iss?: string;
      ref?: string;
      role?: string;
      exp?: number;
    };
    const projectRef = (Deno.env.get("SUPABASE_URL") ?? "")
      .replace(/^https?:\/\//, "")
      .split(".")[0];
    return (
      claims.iss === "supabase" &&
      claims.ref === projectRef &&
      (claims.role === "anon" || claims.role === "authenticated") &&
      typeof claims.exp === "number" &&
      claims.exp * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");

  let key: string | undefined;
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, string>;
      key = parsed["default"];
    } catch {
      // fall through to legacy env var
    }
  }
  key ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("No service credentials are configured");
  return createClient(supabaseUrl, key);
}

// ── Bright Data SERP helpers ───────────────────────────────────────────────

interface SerpOrganicResult {
  title: string;
  link?: string;
  snippet?: string;
}

function parseSerpBody(raw: unknown): SerpOrganicResult[] {
  const top = raw as Record<string, unknown> | undefined;
  if (!top || typeof top !== "object") return [];

  const bodyStr = top.body;
  if (typeof bodyStr !== "string") return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(bodyStr) as Record<string, unknown>;
  } catch {
    return [];
  }

  const organic = parsed.organic;
  if (!Array.isArray(organic)) return [];

  return organic.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return {
      title: typeof entry.title === "string" ? entry.title : "",
      link: typeof entry.link === "string" ? entry.link : "",
      snippet: typeof entry.description === "string" ? entry.description : "",
    };
  }).filter((r) => r.title.length > 0 || (r.link?.length ?? 0) > 0);
}

async function searchSerp(
  query: string,
  apiKey: string,
): Promise<SerpOrganicResult[]> {
  const searchUrl =
    `https://www.google.com/search?q=${encodeURIComponent(query)}&brd_json=1&hl=en&gl=us`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERP_TIMEOUT_MS);

  try {
    const res = await fetch(BRIGHTDATA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: searchUrl,
        format: "json",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Bright Data returned status ${res.status}`);
    }

    const raw = await res.json();
    const results = parseSerpBody(raw);
    console.log(`vendor-check SERP: query="${query}" results=${results.length}`);
    return results;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("SERP search timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function formatSerpResults(organic: SerpOrganicResult[]): string {
  return organic
    .map((r, i) => {
      const parts = [`${i + 1}. ${r.title}`];
      if (r.link) parts.push(`   URL: ${r.link}`);
      if (r.snippet) parts.push(`   Snippet: ${r.snippet}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

// ── AI: structured evidence signals only (no trustScore/riskLevel/confidence) ─

const SYSTEM_PROMPT = `You are a public-web evidence extraction engine. You analyse search-engine results (SERP data) for a company and return ONLY valid JSON.

Rules:
- Return ONLY the JSON object described below. No markdown, no code fences, no commentary.
- Base your output ONLY on what is visible in the provided search results.
- Do NOT claim or imply anything about: legal registration status, sanctions list checks, financial stability, creditworthiness, or legal verification.
- "officialWebsiteFound": "yes" if an official company website is clearly identified; "no" if you are confident there is none; "uncertain" if unclear.
- "credibleNewsArticlesFound": "yes" if credible news or press coverage is found; "no" if none; "uncertain" if unclear.
- "reputationIndicators": "positive" if reviews/reputation signals are found and are clearly positive; "neutral" if mixed or factual; "negative" if clearly negative; "none" if no reputation data found.
- "negativeFindings": "yes" ONLY if search results contain actual negative findings (lawsuits, sanctions, fraud, poor reviews, regulatory actions). "no" means you checked and found nothing negative. "uncertain" if unclear.
- "negativeFindingSummary": If negativeFindings is "yes", briefly describe what was found. Otherwise, this MUST be an empty string "".
- Do NOT write "No negative news found" anywhere. If there's nothing negative to report, leave negativeFindingSummary as "".
- "keyFindings": 2-6 specific, evidence-backed observations. If no negative findings exist, do NOT include "no negative news" as a finding. Say "Not assessed for negative news" ONLY in unavailableChecks.
- "recommendations": 2-4 actionable next steps.
- "sourceUrls": list the most relevant URLs from the search results (max 6).
- "unavailableChecks": list areas where information was insufficient to assess.

Return EXACTLY this JSON schema:
{
  "summary": "string — 1-3 sentence overview",
  "industrySector": "string",
  "officialWebsiteFound": "yes | no | uncertain",
  "credibleNewsArticlesFound": "yes | no | uncertain",
  "reputationIndicators": "positive | neutral | negative | none",
  "negativeFindings": "yes | no | uncertain",
  "negativeFindingSummary": "string",
  "keyFindings": ["string", ...],
  "recommendations": ["string", ...],
  "sourceUrls": ["string", ...],
  "unavailableChecks": ["string", ...]
}`;

type AiCallResult =
  | { ok: true; content: string }
  | { ok: false; code: string; message: string };

async function callAi(
  apiKey: string,
  prompt: string,
): Promise<AiCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: "AI_CONFIG_ERROR",
        message: "The analysis service is not configured correctly.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        code: "AI_QUOTA",
        message:
          "Analysis service quota has been reached. Please try again later.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "AI_UNAVAILABLE",
        message: "Analysis service is temporarily unavailable.",
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return {
        ok: false,
        code: "AI_UNAVAILABLE",
        message: "The analysis service returned an empty response.",
      };
    }

    return { ok: true, content };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        code: "AI_TIMEOUT",
        message: "The analysis took too long. Please try again later.",
      };
    }
    return {
      ok: false,
      code: "AI_UNAVAILABLE",
      message: "Analysis service is temporarily unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Evidence signals schema ────────────────────────────────────────────────

type YesNoUncertain = "yes" | "no" | "uncertain";
type ReputationSignal = "positive" | "neutral" | "negative" | "none";

interface EvidenceSignals {
  summary: string;
  industrySector: string;
  officialWebsiteFound: YesNoUncertain;
  credibleNewsArticlesFound: YesNoUncertain;
  reputationIndicators: ReputationSignal;
  negativeFindings: YesNoUncertain;
  negativeFindingSummary: string;
  keyFindings: string[];
  recommendations: string[];
  sourceUrls: string[];
  unavailableChecks: string[];
}

// ── Deterministic scoring ──────────────────────────────────────────────────

interface ComputedScore {
  trustScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
}

function computeScore(ev: EvidenceSignals, hasAnyEvidence: boolean): ComputedScore {
  if (!hasAnyEvidence) {
    return { trustScore: 0, riskLevel: "Unknown" as any, confidence: 0 };
  }

  let score = 65; // neutral baseline

  // 1. Official website evidence (max +15, cap at 80)
  if (ev.officialWebsiteFound === "yes") {
    score += 15;
  }
  score = Math.min(score, 80);

  // 2. News coverage (max +10, cap at 90)
  if (ev.credibleNewsArticlesFound === "yes") {
    score += 10;
  }
  score = Math.min(score, 90);

  // 3. Reputation signals (+10 for positive, -20 for negative, neutral = 0)
  if (ev.reputationIndicators === "positive") {
    score += 10;
  } else if (ev.reputationIndicators === "negative") {
    score -= 20;
  }

  // 4. Negative findings (-35 if confirmed negative findings, -5 if uncertain)
  if (ev.negativeFindings === "yes") {
    score -= 35;
  } else if (ev.negativeFindings === "uncertain") {
    score -= 5;
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Risk level from score
  let riskLevel: "Low" | "Medium" | "High" | "Critical";
  if (score >= 75) riskLevel = "Low";
  else if (score >= 50) riskLevel = "Medium";
  else if (score >= 25) riskLevel = "High";
  else riskLevel = "Critical";

  // Confidence: how many signal categories resolved (not "uncertain" / "none")
  const resolved = [
    ev.officialWebsiteFound !== "uncertain",
    ev.credibleNewsArticlesFound !== "uncertain",
    ev.reputationIndicators !== "none",
    ev.negativeFindings !== "uncertain",
  ].filter(Boolean).length;
  const confidence = resolved / 4;

  return { trustScore: score, riskLevel, confidence };
}

// ── Validation ─────────────────────────────────────────────────────────────

const YES_NO_UNCERTAIN = ["yes", "no", "uncertain"];
const REPUTATION_SIGNALS = ["positive", "neutral", "negative", "none"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function validateEvidenceSignals(
  raw: unknown,
): { ok: true; value: EvidenceSignals } | { ok: false; problems: string[] } {
  const problems: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, problems: ["response is not a JSON object"] };
  }

  if (!isNonEmptyString(raw.summary)) problems.push("summary: missing or not a string");
  if (!isNonEmptyString(raw.industrySector)) problems.push("industrySector: missing or not a string");

  const owf = raw.officialWebsiteFound;
  if (!YES_NO_UNCERTAIN.includes(owf as string)) {
    problems.push("officialWebsiteFound: must be yes | no | uncertain");
  }

  const cnf = raw.credibleNewsArticlesFound;
  if (!YES_NO_UNCERTAIN.includes(cnf as string)) {
    problems.push("credibleNewsArticlesFound: must be yes | no | uncertain");
  }

  const ri = raw.reputationIndicators;
  if (!REPUTATION_SIGNALS.includes(ri as string)) {
    problems.push("reputationIndicators: must be positive | neutral | negative | none");
  }

  const nf = raw.negativeFindings;
  if (!YES_NO_UNCERTAIN.includes(nf as string)) {
    problems.push("negativeFindings: must be yes | no | uncertain");
  }

  if (typeof raw.negativeFindingSummary !== "string") {
    problems.push("negativeFindingSummary: must be a string");
  }

  if (!isStringArray(raw.keyFindings)) problems.push("keyFindings: must be an array of strings");
  if (!isStringArray(raw.recommendations)) problems.push("recommendations: must be an array of strings");
  if (!isStringArray(raw.sourceUrls)) problems.push("sourceUrls: must be an array of strings");
  if (!isStringArray(raw.unavailableChecks)) problems.push("unavailableChecks: must be an array of strings");

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      summary: (raw.summary as string).trim(),
      industrySector: (raw.industrySector as string).trim(),
      officialWebsiteFound: owf as YesNoUncertain,
      credibleNewsArticlesFound: cnf as YesNoUncertain,
      reputationIndicators: ri as ReputationSignal,
      negativeFindings: nf as YesNoUncertain,
      negativeFindingSummary: raw.negativeFindingSummary as string,
      keyFindings: raw.keyFindings as string[],
      recommendations: raw.recommendations as string[],
      sourceUrls: raw.sourceUrls as string[],
      unavailableChecks: raw.unavailableChecks as string[],
    },
  };
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Response helpers ───────────────────────────────────────────────────────

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return json({ success: false, error: { code, message } }, status);
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return errorResponse("INVALID_REQUEST", "Method not allowed.", 405);
    }
    if (!isAuthorizedCaller(req)) {
      return errorResponse("UNAUTHORIZED", "Unauthorized.", 401);
    }

    // 1. Parse and validate input.
    let body: { companyName?: unknown; websiteUrl?: unknown } | null = null;
    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "INVALID_REQUEST",
        "Request body must be valid JSON.",
        400,
      );
    }

    if (!isNonEmptyString(body?.companyName)) {
      return errorResponse(
        "INVALID_REQUEST",
        "A companyName string is required.",
        400,
      );
    }

    const companyName = body.companyName.trim();
    const websiteUrl = isNonEmptyString(body.websiteUrl)
      ? body.websiteUrl.trim()
      : "";

    const normalizedKey = buildCacheKey(companyName, websiteUrl);

    // 2. Load secrets.
    const brightDataKey = Deno.env.get("BRIGHTDATA_API_KEY");
    if (!brightDataKey) {
      return errorResponse(
        "SERVICE_CONFIG_ERROR",
        "The vendor screening service is not fully configured. Please try again later.",
        503,
      );
    }

    const aiApiKey = Deno.env.get("AI_ML_API_KEY");
    if (!aiApiKey) {
      return errorResponse(
        "AI_CONFIG_ERROR",
        "The analysis service is not configured. Please try again later.",
        503,
      );
    }

    const supabase = createServiceClient();

    // 3. Check cache (24-hour TTL).
    const cacheCutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cachedRow, error: cacheReadError } = await supabase
      .from("vendor_cache")
      .select("response_data, created_at")
      .eq("normalized_key", normalizedKey)
      .gte("created_at", cacheCutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheReadError) {
      console.error("vendor-check cache read failed:", cacheReadError.message);
    }

    if (cachedRow) {
      const cached = cachedRow.response_data as Record<string, unknown>;
      console.log(
        `vendor-check: cache HIT for key="${normalizedKey}"`,
      );
      // Ensure checkedAt reflects when the cache was created, not now
      cached.checkedAt = cachedRow.created_at;
      return json({ success: true, data: cached }, 200);
    }

    console.log(
      `vendor-check: cache MISS for key="${normalizedKey}" — will run fresh check`,
    );

    // 4. Run three fixed SERP queries.
    let websiteResults: SerpOrganicResult[] = [];
    let reviewResults: SerpOrganicResult[] = [];
    let newsResults: SerpOrganicResult[] = [];
    const serpErrors: string[] = [];

    try {
      websiteResults = await searchSerp(
        `"${companyName}" official website`,
        brightDataKey,
      );
    } catch (err) {
      serpErrors.push(
        `Website search: ${err instanceof Error ? err.message : "unexpected error"}`,
      );
      console.error("vendor-check SERP 1 (website) failed:", err);
    }

    try {
      reviewResults = await searchSerp(
        `"${companyName}" reviews`,
        brightDataKey,
      );
    } catch (err) {
      serpErrors.push(
        `Review search: ${err instanceof Error ? err.message : "unexpected error"}`,
      );
      console.error("vendor-check SERP 2 (reviews) failed:", err);
    }

    try {
      newsResults = await searchSerp(
        `"${companyName}" news`,
        brightDataKey,
      );
    } catch (err) {
      serpErrors.push(
        `News search: ${err instanceof Error ? err.message : "unexpected error"}`,
      );
      console.error("vendor-check SERP 3 (news) failed:", err);
    }

    // 5. Build the AI prompt from SERP results.
    const allOrganic = [
      ...websiteResults,
      ...reviewResults,
      ...newsResults,
    ];
    const hasAnyEvidence = allOrganic.length > 0 || websiteUrl.length > 0;

    // User-provided website URL as a pseudo-SERP entry
    const websiteHintSection = websiteUrl
      ? `\n${allOrganic.length + 1}. ${companyName} - Official Website (user-provided)\n   URL: ${websiteUrl}\n   Snippet: Official website provided directly by the user.`
      : "";

    // 6. Early return: no evidence → Unknown
    if (!hasAnyEvidence) {
      const unknownResponse = {
        companyName,
        websiteUrl,
        summary:
          "No public data was retrieved from web searches for this vendor.",
        riskLevel: "Unknown",
        trustScore: null,
        confidence: null,
        keyFindings: [] as string[],
        recommendations: [
          "Try a search with different keywords or additional context.",
          "Check legal and financial databases directly.",
          "Contact the vendor directly for references and documentation.",
        ],
        sourceUrls: [] as string[],
        checkedAt: new Date().toISOString(),
        unavailableChecks: [
          "Official website information — no search results returned.",
          "Reviews and reputation data — no search results returned.",
          "News articles or press releases — no search results returned.",
        ],
        limitations: [
          "This is a Public-Web Vendor Risk Screening based on publicly available search results. It does not constitute legal, compliance, or financial advice. No verification of legal registration, sanctions clearance, financial stability, or creditworthiness has been performed.",
          "No public web data could be retrieved for this vendor. This does not indicate either trustworthiness or risk.",
        ],
      };

      // Cache the unknown response too (so repeated lookups return the same thing)
      await supabase.from("vendor_cache").upsert(
        {
          normalized_key: normalizedKey,
          response_data: unknownResponse,
          created_at: new Date().toISOString(),
        },
        { onConflict: "normalized_key" },
      ).catch((err) =>
        console.error("vendor-check cache write (unknown) failed:", err.message)
      );

      console.log(
        `vendor-check: company="${companyName}" → Unknown (no evidence)`,
      );
      return json({ success: true, data: unknownResponse }, 200);
    }

    // 7. Build AI prompt
    const aiPrompt = `Company to screen: "${companyName}"${websiteUrl ? `\nUser-supplied website: ${websiteUrl}` : ""}

=== Search Results: Official Website ===
${formatSerpResults(websiteResults) || "(No results found)"}

=== Search Results: Reviews ===
${formatSerpResults(reviewResults) || "(No results found)"}

=== Search Results: News ===
${formatSerpResults(newsResults) || "(No results found)"}${websiteHintSection}

Extract structured evidence signals for ${companyName}.`;

    // 8. Call the AI (temperature 0 for deterministic output).
    const ai = await callAi(aiApiKey, aiPrompt);
    if (!ai.ok) {
      return errorResponse(
        ai.code,
        ai.message,
        ai.code === "AI_TIMEOUT"
          ? 504
          : ai.code === "AI_QUOTA"
          ? 429
          : 502,
      );
    }

    // 9. Parse AI response into evidence signals.
    const parsed = parseJsonLoose(ai.content);
    const validation = validateEvidenceSignals(parsed);
    if (!validation.ok) {
      console.error(
        "vendor-check: AI returned invalid evidence signals",
        validation.problems,
      );
      return errorResponse(
        "AI_INVALID_RESPONSE",
        "The analysis service returned an invalid response.",
        422,
      );
    }
    const evidence = validation.value;

    // 10. Compute trustScore, riskLevel, confidence in deterministic code.
    const computed = computeScore(evidence, hasAnyEvidence);

    // Build final response
    const sourceUrls = evidence.sourceUrls.length > 0
      ? evidence.sourceUrls
      : [
          ...(websiteUrl ? [websiteUrl] : []),
          ...allOrganic.filter((s) => s.link).map((s) => s.link!),
        ];

    // For the "no negative news" requirement: if keyFindings would include
    // "No negative news", replace it in post-processing.
    const cleanedKeyFindings = evidence.keyFindings.filter(
      (f) =>
        !/no\s+(negative|adverse|unfavorable|bad)\s+(news|finding|result|publicity|press)/i.test(
          f,
        ),
    );
    // Add a note that negative news was Not Assessed if we didn't find any
    if (evidence.negativeFindings === "no" || evidence.negativeFindings === "uncertain") {
      if (
        !evidence.unavailableChecks.some((c) =>
          /negative\s+(news|finding|publicity)/i.test(c)
        )
      ) {
        evidence.unavailableChecks.push(
          "Negative news or regulatory actions: Not assessed — no data found in search results.",
        );
      }
    }

    // Build the limitations list
    const limitations = [
      "This is a Public-Web Vendor Risk Screening based on publicly available search results. It does not constitute legal, compliance, or financial advice. No verification of legal registration, sanctions clearance, financial stability, or creditworthiness has been performed.",
    ];
    if (
      evidence.negativeFindings === "no" || evidence.negativeFindings === "uncertain"
    ) {
      limitations.push(
        "Absence of negative news in search results does not confirm the absence of adverse information. Not assessed.",
      );
    }

    const responseData = {
      companyName,
      websiteUrl,
      summary: evidence.summary,
      riskLevel: computed.riskLevel,
      trustScore: computed.trustScore,
      confidence: computed.confidence,
      keyFindings: cleanedKeyFindings,
      recommendations: evidence.recommendations,
      sourceUrls,
      checkedAt: new Date().toISOString(),
      unavailableChecks: evidence.unavailableChecks,
      limitations,
    };

    // 11. Cache the result for 24 hours.
    await supabase
      .from("vendor_cache")
      .upsert(
        {
          normalized_key: normalizedKey,
          response_data: responseData,
          created_at: new Date().toISOString(),
        },
        { onConflict: "normalized_key" },
      )
      .catch((err) =>
        console.error(
          "vendor-check cache write failed:",
          err.message,
        )
      );

    console.log(
      `vendor-check: company="${companyName}" riskLevel=${computed.riskLevel} trustScore=${computed.trustScore} confidence=${computed.confidence} cached=yes`,
    );

    return json({ success: true, data: responseData }, 200);
  } catch (err) {
    console.error(
      "vendor-check unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return errorResponse(
      "INTERNAL_ERROR",
      "The vendor check could not be completed due to an unexpected error.",
      500,
    );
  }
});