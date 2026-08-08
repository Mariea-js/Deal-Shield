// analyze-contract — Supabase Edge Function (P2-A)
//
// Secure contract AI analysis. The ONLY place a runtime AI provider is called.
// The AI/ML API key lives exclusively in Supabase Edge Function secrets
// (AI_ML_API_KEY) and is read via Deno.env.get() server-side — it never
// reaches the browser.
//
// Input:  { "contractId": "uuid" }
// Output: validated AI analysis, persisted to analysis_results.
//
// Workflow:
//   1. Validate contractId (UUID).
//   2. Load the contract record (service-role client).
//   3. Load extracted text from contracts.text_content (server-side source).
//   4. Reject missing / insufficient text with a structured error.
//   5. Check LIVE_ANALYSIS_ENABLED budget switch (default false → skip AI).
//   6. Send EXACTLY ONE AI request (JSON-only output requested).
//   7. Validate the returned JSON against the required schema.
//   8. Save ONLY validated results to analysis_results.
//   9. Return the validated analysis.
//
// Phase boundaries (NOT implemented yet — per P2-A scope):
//   - No final Deal Safety Score calculation (deal_safety_score stays null).
//   - No vendor intelligence (vendor_signal stays null).
//   - No chatbot, OCR, RAG, or PDF report generation.
//
// Security:
//   - API key and full contract text are NEVER logged.
//   - No raw AI errors are exposed to the client.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Config (all overridable via Edge Function secrets / env) ──────────────
const AI_TIMEOUT_MS = 30_000; // PRD: 30s timeout
const MAX_TEXT_CHARS = 50_000; // PRD: truncate before AI call
const MIN_TEXT_CHARS = 100; // below this the text is too thin to analyze
const MAX_OUTPUT_TOKENS = 4_000; // PRD: max output tokens

const AI_API_URL =
  Deno.env.get("AI_ML_API_URL") ?? "https://api.aimlapi.com/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_ML_MODEL") ?? "openai/gpt-4o-mini";

// Budget switch (PRD). Unset / anything-but-"true" → live analysis disabled.
function isLiveAnalysisEnabled(): boolean {
  return Deno.env.get("LIVE_ANALYSIS_ENABLED") === "true";
}

// ── Domain types (mirror the required AI response schema) ─────────────────
const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
const PRIORITIES = ["Low", "Medium", "High"] as const;
type RiskLevel = (typeof RISK_LEVELS)[number];
type Priority = (typeof PRIORITIES)[number];

interface AiClause {
  name: string;
  originalText: string;
  explanation: string;
  riskLevel: RiskLevel;
  confidenceScore: number; // 0–1
  reason: string;
  recommendation: string;
}

interface MissingProtection {
  name: string;
  reason: string;
  priority: Priority;
}

interface AiRecommendation {
  title: string;
  description: string;
  reason: string;
  priority: Priority;
}

interface AiAnalysis {
  contractType: string;
  contractRiskScore: number; // 0–100
  overallRisk: RiskLevel;
  confidenceScore: number; // 0–1
  executiveSummary: string;
  clauses: AiClause[];
  missingProtections: MissingProtection[];
  recommendations: AiRecommendation[];
}

// ── Small validation helpers ───────────────────────────────────────────────
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function normalizeEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  if (typeof v !== "string") return null;
  const match = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return match ?? null;
}

/**
 * Validates an unknown AI payload against the required contract-analysis
 * schema. Returns the validated (normalized) analysis or a list of
 * human-readable field problems. The AI response is saved ONLY when this
 * returns ok=true — otherwise the function returns AI_INVALID_RESPONSE.
 */
function validateAiAnalysis(raw: unknown): { ok: true; value: AiAnalysis } | { ok: false; problems: string[] } {
  const problems: string[] = [];

  if (!isRecord(raw)) return { ok: false, problems: ["response is not a JSON object"] };

  if (!isNonEmptyString(raw.contractType)) problems.push("contractType: missing or not a string");
  if (!isFiniteNumber(raw.contractRiskScore)) {
    problems.push("contractRiskScore: missing or not a number");
  }
  if (!isFiniteNumber(raw.confidenceScore)) {
    problems.push("confidenceScore: missing or not a number");
  }
  if (!isNonEmptyString(raw.executiveSummary)) problems.push("executiveSummary: missing or not a string");

  const overallRisk = normalizeEnum(raw.overallRisk, RISK_LEVELS);
  if (!overallRisk) problems.push("overallRisk: must be one of Low | Medium | High | Critical");

  // ── clauses ──
  const clauses: AiClause[] = [];
  if (!Array.isArray(raw.clauses)) {
    problems.push("clauses: must be an array");
  } else {
    raw.clauses.forEach((c, i) => {
      if (!isRecord(c)) {
        problems.push(`clauses[${i}]: not an object`);
        return;
      }
      const sub: string[] = [];
      if (!isNonEmptyString(c.name)) sub.push("name");
      if (!isNonEmptyString(c.originalText)) sub.push("originalText");
      if (!isNonEmptyString(c.explanation)) sub.push("explanation");
      const riskLevel = normalizeEnum(c.riskLevel, RISK_LEVELS);
      if (!riskLevel) sub.push("riskLevel");
      if (!isFiniteNumber(c.confidenceScore)) sub.push("confidenceScore");
      if (!isNonEmptyString(c.reason)) sub.push("reason");
      if (!isNonEmptyString(c.recommendation)) sub.push("recommendation");
      if (sub.length > 0) {
        problems.push(`clauses[${i}]: missing/invalid fields: ${sub.join(", ")}`);
        return;
      }
      clauses.push({
        name: (c.name as string).trim(),
        originalText: (c.originalText as string).trim(),
        explanation: (c.explanation as string).trim(),
        riskLevel,
        confidenceScore: clamp01(c.confidenceScore as number),
        reason: (c.reason as string).trim(),
        recommendation: (c.recommendation as string).trim(),
      });
    });
  }

  // ── missingProtections ──
  const missingProtections: MissingProtection[] = [];
  if (!Array.isArray(raw.missingProtections)) {
    problems.push("missingProtections: must be an array");
  } else {
    raw.missingProtections.forEach((m, i) => {
      if (!isRecord(m)) {
        problems.push(`missingProtections[${i}]: not an object`);
        return;
      }
      const priority = normalizeEnum(m.priority, PRIORITIES);
      if (!isNonEmptyString(m.name) || !isNonEmptyString(m.reason) || !priority) {
        problems.push(`missingProtections[${i}]: missing name, reason, or valid priority`);
        return;
      }
      missingProtections.push({
        name: (m.name as string).trim(),
        reason: (m.reason as string).trim(),
        priority,
      });
    });
  }

  // ── recommendations ──
  const recommendations: AiRecommendation[] = [];
  if (!Array.isArray(raw.recommendations)) {
    problems.push("recommendations: must be an array");
  } else {
    raw.recommendations.forEach((r, i) => {
      if (!isRecord(r)) {
        problems.push(`recommendations[${i}]: not an object`);
        return;
      }
      const priority = normalizeEnum(r.priority, PRIORITIES);
      if (
        !isNonEmptyString(r.title) ||
        !isNonEmptyString(r.description) ||
        !isNonEmptyString(r.reason) ||
        !priority
      ) {
        problems.push(`recommendations[${i}]: missing title, description, reason, or valid priority`);
        return;
      }
      recommendations.push({
        title: (r.title as string).trim(),
        description: (r.description as string).trim(),
        reason: (r.reason as string).trim(),
        priority,
      });
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      contractType: (raw.contractType as string).trim(),
      contractRiskScore: clamp100(raw.contractRiskScore as number),
      overallRisk,
      confidenceScore: clamp01(raw.confidenceScore as number),
      executiveSummary: (raw.executiveSummary as string).trim(),
      clauses,
      missingProtections,
      recommendations,
    },
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ── AI system prompt ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a contract risk analysis engine. You analyze vendor contract text and return ONLY valid JSON. Do not output markdown, code fences, or any commentary outside the JSON object.

Analyze these clause types when present in the contract:
Payment terms, Termination, Confidentiality, Intellectual property, Liability, Indemnification, Force majeure, Governing law, Jurisdiction, Dispute resolution, Renewal and auto-renewal, Cancellation, Data privacy, Hidden fees, Non-compete, Late payment, Limitation of liability, Warranties, Compliance obligations.

Rules:
- Do not invent facts. Every "originalText" field must be a SHORT, EXACT quote from the contract.
- If a clause type is absent from the text, do not fabricate it.
- Detect missing protections separately in "missingProtections": protections a reasonable contract should include but the text lacks.
- Clearly indicate uncertainty by lowering "confidenceScore".
- "contractRiskScore" is an integer from 0 to 100 where 100 is the highest risk.
- "confidenceScore" fields are numbers from 0 to 1.
- "overallRisk" must be one of: Low, Medium, High, Critical.
- "priority" must be one of: High, Medium, Low.
- Use plain-English explanations. Do not provide definitive legal advice; use careful, non-committal wording.
- If the text contains insufficient material, still return a valid JSON object with empty arrays where applicable.

Return EXACTLY this JSON schema:
{
  "contractType": "string",
  "contractRiskScore": 0,
  "overallRisk": "Low | Medium | High | Critical",
  "confidenceScore": 0,
  "executiveSummary": "string",
  "clauses": [
    {
      "name": "string",
      "originalText": "short exact excerpt from the contract",
      "explanation": "plain-English explanation",
      "riskLevel": "Low | Medium | High | Critical",
      "confidenceScore": 0,
      "reason": "string",
      "recommendation": "string"
    }
  ],
  "missingProtections": [
    { "name": "string", "reason": "string", "priority": "High | Medium | Low" }
  ],
  "recommendations": [
    { "title": "string", "description": "string", "reason": "string", "priority": "High | Medium | Low" }
  ]
}`;

// ── Auth / client helpers (mirror pdf-extract) ─────────────────────────────
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── The AI call (EXACTLY ONE request, JSON-only requested) ─────────────────
interface AiCallOk {
  ok: true;
  content: string;
  model: string;
  durationMs: number;
  usage: Record<string, unknown> | null;
}
interface AiCallErr {
  ok: false;
  code: "AI_TIMEOUT" | "AI_QUOTA" | "AI_CONFIG_ERROR" | "AI_UNAVAILABLE";
  message: string;
}

async function callAi(apiKey: string, text: string): Promise<AiCallOk | AiCallErr> {
  const startedAt = Date.now();
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
          { role: "user", content: `Contract text:\n\n${text}` },
        ],
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, code: "AI_CONFIG_ERROR", message: "The analysis service is not configured correctly." };
    }
    if (res.status === 429) {
      return { ok: false, code: "AI_QUOTA", message: "Analysis service quota has been reached. Please try again later." };
    }
    if (!res.ok) {
      // Model-not-found, upstream 5xx, etc. — safe generic message.
      return { ok: false, code: "AI_UNAVAILABLE", message: "Analysis service is temporarily unavailable. Please try again later." };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: Record<string, unknown> | null;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, code: "AI_UNAVAILABLE", message: "The analysis service returned an empty response." };
    }

    return {
      ok: true,
      content,
      model: typeof data.model === "string" ? data.model : AI_MODEL,
      durationMs: Date.now() - startedAt,
      usage: data.usage ?? null,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, code: "AI_TIMEOUT", message: "The analysis took too long. Please try again later." };
    }
    return { ok: false, code: "AI_UNAVAILABLE", message: "Analysis service is temporarily unavailable. Please try again later." };
  } finally {
    clearTimeout(timer);
  }
}

/** Strips optional ```json fences and extracts the first JSON object. */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Try to salvage the first {...} block.
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

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return json({ success: false, error: { code, message } }, status);
}

// ── Handler (with global error catch) ──────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") {
    // NOTE: a 204 response MUST have a null body — the Deno Edge Runtime
    // rejects `new Response("ok", { status: 204 })` with
    // "Response with null body status cannot have body", which makes the
    // CORS preflight fail (500) and the browser block the POST.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse("INVALID_REQUEST", "Method not allowed.", 405);
  }
  if (!isAuthorizedCaller(req)) {
    return errorResponse("UNAUTHORIZED", "Unauthorized.", 401);
  }

  // 1. Validate contractId.
  let body: { contractId?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const contractId = body?.contractId;
  if (typeof contractId !== "string" || !UUID_RE.test(contractId)) {
    return errorResponse("INVALID_REQUEST", "A valid contractId (UUID) is required.", 400);
  }

  const supabase = createServiceClient();

  // 2 + 3. Load the contract and its extracted text (server-side source).
  const { data: contract, error: loadError } = await supabase
    .from("contracts")
    .select("id, filename, text_content, text_length, status")
    .eq("id", contractId)
    .maybeSingle();

  if (loadError) {
    console.error("contract load failed:", loadError.message);
    return errorResponse("ANALYSIS_ERROR", "The contract could not be loaded.", 500);
  }
  if (!contract) {
    return errorResponse("CONTRACT_NOT_FOUND", "The contract was not found.", 404);
  }

  // 4. Reject missing / insufficient text.
  const text = (contract.text_content as string | null) ?? "";
  if (text.trim().length === 0) {
    return errorResponse("TEXT_MISSING", "No extracted text is available for this contract.", 422);
  }
  if (text.trim().length < MIN_TEXT_CHARS) {
    return errorResponse(
      "TEXT_INSUFFICIENT",
      "The extracted contract text is too short to analyze.",
      422,
    );
  }

  // 5. Budget switch — do NOT call the AI while disabled (Demo Mode unaffected).
  if (!isLiveAnalysisEnabled()) {
    return errorResponse(
      "LIVE_ANALYSIS_DISABLED",
      "Live analysis is currently unavailable. Try the demo to explore the dashboard.",
      503,
    );
  }

  const apiKey = Deno.env.get("AI_ML_API_KEY");
  if (!apiKey) {
    console.error("AI_ML_API_KEY secret is not configured");
    return errorResponse(
      "AI_CONFIG_ERROR",
      "The analysis service is not configured.",
      503,
    );
  }

  // 6. Truncate to the PRD limit, then send EXACTLY ONE AI request.
  const wasTruncated = text.length > MAX_TEXT_CHARS;
  const aiText = wasTruncated ? text.slice(0, MAX_TEXT_CHARS) : text;
  console.log(
    `analyze-contract: contract=${contractId} chars=${aiText.length} truncated=${wasTruncated}`,
  );

  const ai = await callAi(apiKey, aiText);
  if (!ai.ok) {
    return errorResponse(ai.code, ai.message, ai.code === "AI_TIMEOUT" ? 504 : ai.code === "AI_QUOTA" ? 429 : 502);
  }

  // 7. Parse + validate. Invalid AI output is NEVER saved.
  const parsed = parseJsonLoose(ai.content);
  const validation = validateAiAnalysis(parsed);
  if (!validation.ok) {
    console.log(
      `analyze-contract: AI returned invalid response (${validation.problems.length} problems) — not saving`,
    );
    return errorResponse("AI_INVALID_RESPONSE", "The analysis service returned an invalid response.", 422);
  }
  const analysis = validation.value;

  // 8. Persist ONLY validated results.
  const analysisId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("analysis_results").insert({
    id: analysisId,
    contract_id: contractId,
    request_id: crypto.randomUUID(),
    raw_ai_response: analysis,
    clauses: analysis.clauses,
    recommendations: analysis.recommendations,
    // deal_safety_score / vendor_signal intentionally null — later phases.
    ai_model: ai.model,
    ai_duration_ms: ai.durationMs,
    ai_token_usage: ai.usage,
    was_truncated: wasTruncated,
    error_message: null,
  });

  if (insertError) {
    console.error("analysis_results insert failed:", insertError.message);
    return errorResponse("ANALYSIS_ERROR", "The analysis could not be saved.", 500);
  }

  console.log(
    `analyze-contract: saved analysis=${analysisId} contract=${contractId} model=${ai.model} durationMs=${ai.durationMs}`,
  );

  // 9. Return the validated analysis.
  return json(
    {
      success: true,
      message: "Contract analysis complete",
      data: {
        analysisId,
        contractId,
        aiModel: ai.model,
        aiDurationMs: ai.durationMs,
        wasTruncated,
        analysis,
      },
    },
    200,
  );
  } catch (err) {
    console.error("analyze-contract unhandled error:", err instanceof Error ? err.message : String(err));
    return errorResponse("ANALYSIS_ERROR", "The analysis could not be completed due to an unexpected error.", 500);
  }
});
