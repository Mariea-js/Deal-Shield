import { useCallback, useState } from "react";
import { EDGE_FUNCTIONS_URL } from "../lib/supabase";
import { SUPABASE_ANON_KEY } from "../lib/config";
import type { VendorCheckResult } from "../lib/types";

type VendorState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: VendorCheckResult }
  | { status: "error"; message: string };

const URL_REGEX = /^https?:\/\/.+\..+/i;

function validateWebsite(url: string): string | null {
  if (!url.trim()) return null; // optional field
  if (!URL_REGEX.test(url.trim())) {
    return "Enter a valid URL starting with http:// or https://";
  }
  return null;
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Low: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/30" },
  Medium: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  High: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  Critical: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  Unknown: { bg: "bg-muted/30", text: "text-text-muted", border: "border-border/50" },
};

function RiskBadge({ level }: { level: VendorCheckResult["riskLevel"] }) {
  const colors = RISK_COLORS[level] ?? RISK_COLORS.Low;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {level}
    </span>
  );
}

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const hue = value >= 70 ? 142 : value >= 40 ? 48 : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
          <circle
            className="text-border"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            cx="18"
            cy="18"
            r="15"
          />
          <circle
            className="transition-all duration-700 ease-out"
            stroke={`hsl(${hue}, 70%, 50%)`}
            strokeWidth="3"
            fill="none"
            cx="18"
            cy="18"
            r="15"
            strokeDasharray={`${(value / 100) * 94.2} 94.2`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-lg font-bold text-foreground">
          {value}
        </span>
      </div>
      <span className="mt-1 text-xs text-text-muted">{label}</span>
    </div>
  );
}

export function VendorCheck() {
  const [state, setState] = useState<VendorState>({ status: "idle" });
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    website?: string;
  }>({});
  const [expanded, setExpanded] = useState(false);

  const isButtonDisabled =
    !companyName.trim() || state.status === "loading";

  const handleCompanyNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCompanyName(e.target.value);
      setFieldErrors({});
    },
    [],
  );

  const handleWebsiteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWebsite(e.target.value);
      setFieldErrors((prev) => ({ ...prev, website: undefined }));
    },
    [],
  );

  const handleCheck = useCallback(async () => {
    // Validate website only if provided
    const websiteError = validateWebsite(website);
    if (websiteError) {
      setFieldErrors({ website: websiteError });
      return;
    }

    setFieldErrors({});
    setState({ status: "loading" });

    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/vendor-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          websiteUrl: website.trim() || undefined,
        }),
      });

      const body = (await res.json()) as {
        success?: boolean;
        data?: VendorCheckResult;
        error?: { code?: string; message?: string };
      };

      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Vendor check failed. Please try again.");
      }

      setState({ status: "success", result: body.data });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setState({ status: "error", message });
    }
  }, [companyName, website]);

  const handleReset = useCallback(() => {
    setCompanyName("");
    setWebsite("");
    setFieldErrors({});
    setState({ status: "idle" });
    setExpanded(false);
  }, []);

  const handleRetry = useCallback(() => {
    setState({ status: "idle" });
    setExpanded(false);
  }, []);

  // ── IDLE STATE ──
  if (state.status === "idle") {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-6 backdrop-blur-sm sm:p-8">
        {/* Header */}
        <div className="mb-5">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Check a Vendor
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Enter a company name and website for a quick public-web risk screening.
          </p>
        </div>

        {/* Company Name (required) */}
        <div className="mb-4">
          <label
            htmlFor="vendor-company"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Company Name <span className="text-destructive">*</span>
          </label>
          <input
            id="vendor-company"
            type="text"
            value={companyName}
            onChange={handleCompanyNameChange}
            placeholder="e.g. Acme Corporation"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Website URL (optional) */}
        <div className="mb-5">
          <label
            htmlFor="vendor-website"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Website URL <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="vendor-website"
            type="text"
            value={website}
            onChange={handleWebsiteChange}
            placeholder="https://example.com"
            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 ${
              fieldErrors.website
                ? "border-destructive/60 focus:border-destructive/60 focus:ring-destructive/20"
                : "border-border focus:border-accent/60 focus:ring-accent/20"
            }`}
          />
          {fieldErrors.website && (
            <p className="mt-1 text-xs text-destructive">
              {fieldErrors.website}
            </p>
          )}
        </div>

        {/* Check Button */}
        <button
          onClick={handleCheck}
          disabled={isButtonDisabled}
          className={`w-full rounded-xl py-3 text-base font-semibold transition-all duration-150 ${
            isButtonDisabled
              ? "cursor-not-allowed bg-muted text-text-secondary"
              : "cursor-pointer bg-accent text-background hover:bg-accent/90 active:scale-[0.97]"
          }`}
        >
          Check Vendor
        </button>
      </div>
    );
  }

  // ── LOADING STATE ──
  if (state.status === "loading") {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <svg
              className="h-5 w-5 animate-spin text-text-muted"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Checking vendor...
            </p>
            <p className="text-xs text-text-muted">
              Searching public web signals for {companyName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS STATE ──
  if (state.status === "success") {
    const { result } = state;
    const colors = RISK_COLORS[result.riskLevel] ?? RISK_COLORS.Unknown;
    const hasScores = result.trustScore !== null && result.confidence !== null;

    return (
      <div className="rounded-xl border border-border bg-background/60 p-6 backdrop-blur-sm sm:p-8">
        {/* Header with company name */}
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {result.companyName}
              </h2>
              <RiskBadge level={result.riskLevel} />
            </div>
            {result.websiteUrl && (
              <p className="mt-1 text-sm text-text-muted">{result.websiteUrl}</p>
            )}
            <p className="mt-0.5 text-xs text-text-muted">
              Checked{" "}
              {new Date(result.checkedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="shrink-0 cursor-pointer rounded-lg p-2 text-text-muted transition-all hover:bg-background hover:text-foreground"
            aria-label="Check another vendor"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
          </button>
        </div>

        {/* Score card */}
        <div className="mb-5 flex items-start gap-6 rounded-lg border border-border bg-background/40 p-4">
          {hasScores ? (
            <>
              <ScoreGauge value={result.trustScore!} label="Trust Score" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Confidence</span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${colors.bg}`}
                      style={{ width: `${Math.round(result.confidence! * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {Math.round(result.confidence! * 100)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-text-muted">Trust Score</span>
                <span className="text-lg font-bold text-text-muted">Not Available</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-text-muted">Confidence</span>
                <span className="text-sm font-medium text-text-muted">Low</span>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mb-5">
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">Summary</h3>
          <p className="text-sm leading-relaxed text-text-secondary">{result.summary}</p>
        </div>

        {/* Key Findings */}
        {result.keyFindings.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Key Findings</h3>
            <ul className="space-y-1.5">
              {result.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-0.5 shrink-0 text-accent">•</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Recommendations</h3>
            <ul className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-0.5 shrink-0 font-bold text-accent">!</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {result.sourceUrls.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Sources</h3>
            <ul className="space-y-1">
              {result.sourceUrls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-accent underline underline-offset-2 transition-colors hover:text-accent/80"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Unavailable checks */}
        {result.unavailableChecks.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Unable to Verify</h3>
            <ul className="space-y-1">
              {result.unavailableChecks.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 shrink-0 text-yellow-500">⚠</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Limitations (expandable) */}
        {result.limitations.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-text-muted transition-colors hover:text-foreground"
              aria-expanded={expanded}
            >
              <span>Limitations & Disclaimer</span>
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {expanded && (
              <div className="mt-3 space-y-1.5">
                {result.limitations.map((lim, i) => (
                  <p key={i} className="text-xs leading-relaxed text-text-muted">
                    {lim}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── ERROR STATE ──
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 backdrop-blur-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <svg
            className="h-5 w-5 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-destructive">
            Vendor check failed
          </p>
          <p className="mt-1 text-xs text-text-muted">{state.message}</p>
        </div>
        <button
          onClick={handleRetry}
          className="shrink-0 cursor-pointer rounded-lg bg-background/60 px-4 py-2 text-xs font-medium text-accent transition-all hover:bg-background"
        >
          Try again
        </button>
      </div>
    </div>
  );
}