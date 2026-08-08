// pdf-extract — Supabase Edge Function
//
// Storage-first upload flow:
//   browser → Supabase Storage ("contracts" bucket, private) → storagePath
//   browser → this function with { storagePath }
//   this function → reads the PDF server-side (service-role client), validates it,
//   extracts text (pdfjs-dist, Deno-compatible — NO native deps), persists a
//   contract record.
//
// Phase boundary: NO AI call is made yet (LIVE_ANALYSIS_ENABLED stays false).
// OCR / RAG / scoring / vendor intelligence / dashboards are out of scope.
//
// Dependencies:
//   npm:pdfjs-dist@5.4.296 — pure JS/ESM, no native bindings (text extraction only,
//   no canvas rendering needed). Uses a DOMMatrix polyfill below because the Supabase
//   Edge Runtime omits that Web API.
//
// Compatibility note:
//   pdfjs-dist v5 references DOMMatrix at module top-level (SCALE_MATRIX). The Edge
//   Runtime does not define globalThis.DOMMatrix. We polyfill it before a dynamic
//   import. The polyfill is safe because the text-extraction code path never calls
//   matrix methods — it only processes plain text items returned by the worker.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET_NAME = "contracts";
const PDF_MAGIC = "%PDF-";

class PdfExtractionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

interface ExtractedText {
  text: string;
  pageCount: number;
}

// ── DOMMatrix polyfill ─────────────────────────────────────────────────────
// The Supabase Edge Runtime lacks globalThis.DOMMatrix. pdfjs-dist v5's
// legacy bundle creates `SCALE_MATRIX = new DOMMatrix()` at module top-level,
// which crashes without this polyfill. The text-extraction code path never
// calls any matrix methods — the polyfill only needs to be constructible.

function polyfillDOMMatrix(): void {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  class DOMMatrixPolyfill {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: string | number[] | Float64Array | Record<string, number>) {
      if (typeof init === "string" && init.includes("matrix")) {
        const m = init.match(/matrix\(([^)]+)\)/i);
        if (m) {
          const nums = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
          if (nums.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = nums;
        }
      } else if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init as number[];
      } else if (init && typeof init === "object" && !Array.isArray(init)) {
        this.a = init.a ?? this.a;
        this.b = init.b ?? this.b;
        this.c = init.c ?? this.c;
        this.d = init.d ?? this.d;
        this.e = init.e ?? this.e;
        this.f = init.f ?? this.f;
      }
    }

    multiplySelf(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      const { a, b, c, d, e, f } = this;
      this.a = a * other.a + c * other.b;
      this.b = b * other.a + d * other.b;
      this.c = a * other.c + c * other.d;
      this.d = b * other.c + d * other.d;
      this.e = a * other.e + c * other.f + e;
      this.f = b * other.e + d * other.f + f;
      return this;
    }

    preMultiplySelf(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      return this.multiplySelf(other);
    }

    invertSelf(): DOMMatrixPolyfill {
      const det = this.a * this.d - this.b * this.c;
      if (det === 0) return this;
      const { a, b, c, d, e, f } = this;
      const inv = 1 / det;
      this.a = d * inv;
      this.b = -b * inv;
      this.c = -c * inv;
      this.d = a * inv;
      this.e = (c * f - d * e) * inv;
      this.f = (b * e - a * f) * inv;
      return this;
    }

    translate(x: number, y: number): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(this).translateSelf(x, y);
    }

    translateSelf(x: number, y: number): DOMMatrixPolyfill {
      this.e += x;
      this.f += y;
      return this;
    }

    scale(x: number, y = x): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill(this).scaleSelf(x, y);
    }

    scaleSelf(x: number, y = x): DOMMatrixPolyfill {
      this.a *= x;
      this.b *= x;
      this.c *= y;
      this.d *= y;
      return this;
    }

    rotate(angle: number): DOMMatrixPolyfill {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return this.multiplySelf(new DOMMatrixPolyfill([cos, sin, -sin, cos, 0, 0]));
    }

    toString(): string {
      return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`;
    }
  }

  globalThis.DOMMatrix = DOMMatrixPolyfill as unknown as typeof globalThis.DOMMatrix;
}

/**
 * Lazy-load pdfjs-dist with the DOMMatrix polyfill applied first.
 * Static ESM imports are hoisted (cannot run code before them), so we use a
 * dynamic import inside the handler. Module load happens once per function
 * instance (cold start).
 */
let pdfJsModule: { getDocument: (opts: Record<string, unknown>) => { promise: Promise<unknown>; destroy: () => void } } | null = null;

async function getPdfJs() {
  if (!pdfJsModule) {
    polyfillDOMMatrix();
    pdfJsModule = await import("npm:pdfjs-dist@5.4.296/legacy/build/pdf.mjs");
  }
  return pdfJsModule;
}

/**
 * Standard font data URL — fetched lazily by pdf.js only when a PDF references
 * a non-embedded CID font. ASCII-standard-font PDFs never need it.
 */
const STANDARD_FONT_DATA_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/";

/**
 * Extracts text from PDF bytes using pdfjs-dist's text layer API directly
 * (no worker, no canvas — pure text extraction).
 * Verified compatible with the Deno Edge Runtime.
 */
async function extractText(pdfBuffer: ArrayBuffer): Promise<ExtractedText> {
  const { getDocument } = await getPdfJs();

  const loadingTask = getDocument({
    data: pdfBuffer,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown PDF error";
    if (/password|encrypted/i.test(msg)) {
      throw new PdfExtractionError(
        "PDF_CORRUPTED",
        "The PDF is encrypted or password-protected and cannot be opened.",
        422,
      );
    }
    throw new PdfExtractionError(
      "PDF_CORRUPTED",
      "The PDF file is corrupted or could not be parsed.",
      422,
    );
  }

  try {
    const pageCount = doc.numPages;
    if (pageCount === 0) {
      throw new PdfExtractionError("PDF_EMPTY", "The PDF file contains no pages.");
    }

    const pageTexts: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: Record<string, unknown>) =>
          typeof item.str === "string" ? item.str : ""
        )
        .join(" ")
        .trim();
      if (pageText.length > 0) {
        pageTexts.push(pageText);
      }
    }

    if (pageTexts.length === 0) {
      throw new PdfExtractionError(
        "PDF_TEXT_NOT_EXTRACTABLE",
        "No text could be extracted from this PDF. The file may be scanned or image-based.",
        422,
      );
    }

    return { text: pageTexts.join("\n\n"), pageCount };
  } finally {
    await doc.destroy();
  }
}

/** Creates a Supabase client with the service-role / secret key (server-side only). */
function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }

  // Prefer the modern secret-keys JSON, fall back to the legacy service-role key.
  let key: string | undefined;
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, string>;
      key = parsed["default"];
    } catch {
      // Malformed JSON — fall through to legacy env var.
    }
  }
  key ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    throw new Error("No service credentials are configured");
  }
  return createClient(supabaseUrl, key);
}

/**
 * Lightweight caller check: requires a Supabase-issued anon/authenticated JWT
 * for THIS project with a future-expiry date.
 * NOTE: Signature is NOT verified (no JWT secret in the function). This rejects
 * only missing / garbage / expired tokens. Real auth-based policies (Supabase Auth
 * + RLS) are required before production — see the PRD security roadmap.
 */
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    // NOTE: a 204 response MUST have a null body — the Deno Edge Runtime
    // rejects `new Response("ok", { status: 204 })` with
    // "Response with null body status cannot have body", which makes the
    // CORS preflight fail (500) and the browser block the POST.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(
      { success: false, error: { code: "STORAGE_ERROR", message: "Method not allowed." } },
      405,
    );
  }

  if (!isAuthorizedCaller(req)) {
    return json(
      { success: false, error: { code: "STORAGE_ERROR", message: "Unauthorized." } },
      401,
    );
  }

  try {
    let body: { storagePath?: unknown } | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const storagePath = body?.storagePath;
    if (typeof storagePath !== "string" || storagePath.trim().length === 0) {
      return json(
        { success: false, error: { code: "STORAGE_ERROR", message: "A storagePath is required." } },
        400,
      );
    }

    const supabase = createServiceClient();

    // 1. Download from the private bucket — also verifies the file exists.
    //    Service role bypasses RLS; anon cannot read this bucket directly.
    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);
    if (downloadError || !file) {
      return json(
        { success: false, error: { code: "STORAGE_ERROR", message: "The file could not be found in storage." } },
        404,
      );
    }

    const fileSize = file.size;

    // 2. Size check — defense-in-depth; the bucket file_size_limit is the primary gate.
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return json(
        { success: false, error: { code: "PDF_TOO_LARGE", message: "The file exceeds the maximum size of 15 MB." } },
        413,
      );
    }

    // P1-fix: Reject zero-byte / empty files before any PDF parsing.
    if (fileSize === 0) {
      return json(
        { success: false, error: { code: "PDF_INVALID", message: "The uploaded PDF is empty." } },
        400,
      );
    }

    // 3. PDF magic-bytes check — the upload Content-Type header can be spoofed.
    const arrayBuffer = await file.arrayBuffer();
    const magic = new TextDecoder().decode(
      new Uint8Array(arrayBuffer, 0, PDF_MAGIC.length),
    );
    if (magic !== PDF_MAGIC) {
      return json(
        { success: false, error: { code: "PDF_INVALID", message: "The file is not a valid PDF." } },
        400,
      );
    }

    // 4. Extract text (throws PdfExtractionError with a structured code).
    let extracted: ExtractedText;
    try {
      extracted = await extractText(arrayBuffer);
    } catch (err) {
      if (err instanceof PdfExtractionError) {
        return json({ success: false, error: { code: err.code, message: err.message } }, err.status);
      }
      throw err;
    }

    // 5. Persist the contract record (service role bypasses RLS; anon has NO table access).
    const contractId = crypto.randomUUID();
    const filename = storagePath.split("/").pop() ?? "contract.pdf";
    const { error: insertError } = await supabase.from("contracts").insert({
      id: contractId,
      filename,
      file_size_bytes: fileSize,
      file_path: storagePath,
      text_content: extracted.text,
      text_length: extracted.text.length,
      status: "extracted",
    });
    if (insertError) {
      console.error("contract insert failed:", insertError.message);
      return json(
        { success: false, error: { code: "EXTRACTION_ERROR", message: "The contract record could not be saved." } },
        500,
      );
    }

    return json(
      {
        success: true,
        message: "PDF text extracted successfully",
        data: {
          contractId,
          storagePath,
          textLength: extracted.text.length,
        },
      },
      200,
    );
  } catch (err) {
    console.error("pdf-extract unexpected error:", err);
    return json(
      { success: false, error: { code: "EXTRACTION_ERROR", message: "An unexpected error occurred." } },
      500,
    );
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}