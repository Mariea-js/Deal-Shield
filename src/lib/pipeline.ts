// src/lib/pipeline.ts — the live analysis pipeline.
//
// Pipeline: browser → Supabase Storage (contracts bucket) → pdf-extract
// Edge Function → analyze-contract Edge Function → dashboard.
//
// Design rules:
//   - Every request has a hard timeout (AbortController) — no request may hang
//     the loading state forever.
//   - Every failure throws a PipelineError with a code + user-safe message;
//     the caller (App) shows it with a Retry button.
//   - analyze-contract is called EXACTLY ONCE per pipeline run (no retries
//     inside the pipeline — retry is user-initiated from the error screen).
//   - Safe diagnostics: stage + request URL/method/status/duration are logged
//     to the console. Never log tokens, keys, or contract text.

import { supabase, EDGE_FUNCTIONS_URL } from "./supabase";
import { SUPABASE_ANON_KEY } from "./config";
import { validateLiveAnalysis } from "./validation";
import type {
  AnalyzeResponse,
  PipelineResult,
  PipelineStage,
  LiveAnalysis,
} from "./types";
import { PipelineError } from "./types";

export const PIPELINE_TIMEOUTS = {
  uploadMs: 30_000,
  extractMs: 90_000, // pdfjs cold start + parsing
  analyzeMs: 75_000, // 30s AI budget + validation + persist
} as const;

export const BUCKET_NAME = "contracts";

export type StageListener = (stage: PipelineStage) => void;

/** Minimal diagnostics logger — stage and request metadata only. */
function diag(stage: PipelineStage, detail: string): void {
  // Safe: no secrets, no contract text, no keys.
  console.log(`[pipeline:${stage}] ${detail}`);
}

/** Wraps a promise so it rejects after `ms` with a TIMEOUT PipelineError. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new PipelineError(
          "TIMEOUT",
          `${label} took too long and timed out. Please try again.`,
        ),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Shape of an Edge Function JSON response (success envelope). */
interface EdgeFunctionResponse<T> {
  success?: boolean;
  error?: { code?: string; message?: string };
  data?: T;
}

/** POSTs a JSON body to an Edge Function with auth headers and a timeout. */
async function callEdgeFunction<T>(
  fnName: string,
  body: unknown,
  timeoutMs: number,
  stage: PipelineStage,
  label: string,
): Promise<T> {
  const url = `${EDGE_FUNCTIONS_URL}/${fnName}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  diag(stage, `POST ${url} body=${JSON.stringify(body)}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const status = res.status;
    let payload: EdgeFunctionResponse<T> | null = null;
    try {
      payload = (await res.json()) as EdgeFunctionResponse<T>;
    } catch {
      payload = null;
    }

    const durationMs = Date.now() - startedAt;
    diag(stage, `  -> ${status} in ${durationMs}ms`);

    if (!res.ok) {
      const code = payload?.error?.code ?? `HTTP_${status}`;
      const message =
        payload?.error?.message ?? `The ${label.toLowerCase()} service returned an error.`;
      throw new PipelineError(code, message);
    }
    if (!payload || payload.success !== true || payload.data === undefined) {
      throw new PipelineError("INVALID_RESPONSE", `The ${label.toLowerCase()} service returned an invalid response.`);
    }
    return payload.data;
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    if (controller.signal.aborted) {
      throw new PipelineError("TIMEOUT", `${label} took too long and timed out. Please try again.`);
    }
    diag(stage, `  !! network error: ${err instanceof Error ? err.message : String(err)}`);
    throw new PipelineError(
      "NETWORK_ERROR",
      `Could not reach the ${label.toLowerCase()} service. Check your connection and try again.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the full live-analysis pipeline once:
 *   1. upload file to the private "contracts" bucket
 *   2. pdf-extract Edge Function (server-side text extraction + contract row)
 *   3. analyze-contract Edge Function (EXACTLY ONE AI call)
 * Returns the validated analysis for the dashboard.
 */
export async function runAnalysisPipeline(
  file: File,
  onStage: StageListener,
): Promise<PipelineResult> {
  // ── 1. Upload to Supabase Storage ──────────────────────────────────────────
  onStage("uploading");
  const storagePath = `uploads/${crypto.randomUUID()}/${file.name.replace(/[^\w.\- ]/g, "_")}`;
  diag("uploading", `target=contracts/${storagePath} size=${file.size}`);

  const uploadPromise = supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || "application/pdf",
      cacheControl: "3600",
      upsert: false,
    });

  const uploadResult = await withTimeout(uploadPromise, PIPELINE_TIMEOUTS.uploadMs, "Upload");
  if (uploadResult.error) {
    throw new PipelineError(
      "UPLOAD_FAILED",
      `We couldn't upload your file (${uploadResult.error.message}). Please try again.`,
    );
  }
  diag("uploading", "  -> stored");

  // ── 2. pdf-extract Edge Function ───────────────────────────────────────────
  onStage("extracting");
  const extractData = await callEdgeFunction<{ contractId: string }>(
    "pdf-extract",
    { storagePath },
    PIPELINE_TIMEOUTS.extractMs,
    "extracting",
    "Text extraction",
  );
  if (!extractData?.contractId) {
    throw new PipelineError("EXTRACTION_FAILED", "We couldn't read your contract. Please try again.");
  }
  diag("extracting", `contractId=${extractData.contractId}`);

  // ── 3. analyze-contract Edge Function (ONE AI call) ────────────────────────
  onStage("analyzing");
  const analyzeData = await callEdgeFunction<AnalyzeResponse>(
    "analyze-contract",
    { contractId: extractData.contractId },
    PIPELINE_TIMEOUTS.analyzeMs,
    "analyzing",
    "Analysis",
  );
  if (!analyzeData?.analysis) {
    throw new PipelineError("ANALYSIS_FAILED", "The analysis came back empty. Please try again.");
  }
  diag("analyzing", `analysisId=${analyzeData.analysisId} model=${analyzeData.aiModel}`);

  // ── 4. Validate the analysis response before returning ────────────────────
  const validatedAnalysis: LiveAnalysis = validateLiveAnalysis(analyzeData.analysis);
  diag("analyzing", `validated — ${validatedAnalysis.clauses.length} clauses, ${validatedAnalysis.recommendations.length} recommendations`);

  return {
    contractName: file.name,
    analysis: validatedAnalysis,
  };
}
