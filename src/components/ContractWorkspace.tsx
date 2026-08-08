import { SAMPLE_ANALYSIS } from "../lib/sampleData";
import type { PipelineResult, PipelineStage } from "../lib/types";

interface ContractWorkspaceProps {
  mode: "empty" | "loading" | "demo" | "success" | "error";
  message?: string;
  stage?: PipelineStage;
  result?: PipelineResult;
  onBackToUpload: () => void;
  onRetry?: () => void;
}

const STAGE_MESSAGES: Record<PipelineStage, string> = {
  uploading: "Uploading your contract…",
  extracting: "Reading text from the PDF…",
  analyzing: "Analyzing clauses with AI…",
};

export function ContractWorkspace({
  mode,
  message,
  stage,
  result,
  onBackToUpload,
  onRetry,
}: ContractWorkspaceProps) {
  // --- EMPTY STATE ---
  if (mode === "empty") {
    return (
      <div className="bg-grid flex min-h-screen items-center justify-center">
        <div className="bg-glow pointer-events-none fixed inset-0" />
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background/50 border border-border">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12l6-6m0 0l-6-6m6 6H3"
              />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            No analysis yet
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Upload a contract or try the demo to see results here.
          </p>
          <button
            onClick={onBackToUpload}
            className="mt-4 cursor-pointer rounded-lg bg-accent/10 px-5 py-2 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-[0.97]"
          >
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (mode === "loading") {
    return (
      <div className="bg-grid flex min-h-screen items-center justify-center">
        <div className="bg-glow pointer-events-none fixed inset-0" />
        <div className="relative z-10 text-center">
          <svg
            className="mx-auto mb-4 h-10 w-10 animate-spin text-accent"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
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
          <p className="text-sm text-text-muted">
            {stage ? STAGE_MESSAGES[stage] : (message ?? "Loading...")}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            This usually takes about 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (mode === "error") {
    return (
      <div className="bg-grid flex min-h-screen items-center justify-center">
        <div className="bg-glow pointer-events-none fixed inset-0" />
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            We hit a snag
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {message ?? "Something went wrong."}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {onRetry && (
              <button
                onClick={onRetry}
                className="cursor-pointer rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent/90 active:scale-[0.97]"
              >
                Retry
              </button>
            )}
            <button
              onClick={onBackToUpload}
              className="cursor-pointer rounded-lg bg-accent/10 px-6 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-[0.97]"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SUCCESS / DEMO STATE (Dashboard Shell) ---
  const isDemo = mode === "demo";

  return (
    <div className="bg-grid min-h-screen">
      <div className="bg-glow pointer-events-none fixed inset-0" />

      {/* Demo Banner */}
      {isDemo && (
        <div className="relative z-20 border-b border-accent/20 bg-accent/5 px-4 py-3 text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              />
            </svg>
            <p className="text-sm font-medium text-accent">
              Demo Mode — exploring sample data
            </p>
          </div>
          <button
            onClick={onBackToUpload}
            className="mt-1 cursor-pointer text-xs text-text-muted underline underline-offset-2 hover:text-foreground"
          >
            Upload Your Own Contract
          </button>
        </div>
      )}

      {/* Back button */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 pt-6">
        <button
          onClick={onBackToUpload}
          className="mb-6 flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-all hover:text-foreground"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Upload
        </button>

        {isDemo ? (
          <DemoDashboard />
        ) : (
          <LiveDashboard result={result} />
        )}
      </div>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */

function riskBadgeClasses(risk: string): string {
  const normalized = risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
  if (normalized === "Critical" || normalized === "High") {
    return "bg-destructive/10 text-destructive";
  }
  if (normalized === "Medium") {
    return "bg-amber-500/10 text-amber-400";
  }
  return "bg-emerald-500/10 text-emerald-400";
}

function riskTextColor(risk: string): string {
  const normalized = risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
  if (normalized === "Critical" || normalized === "High") return "text-destructive";
  if (normalized === "Medium") return "text-amber-500";
  return "text-emerald-500";
}

/* ── Demo dashboard — renders full sample data ──────────────────────────── */

function DemoDashboard() {
  const { deal_safety_score, contract_name, clauses, vendor_screening, recommendations } =
    SAMPLE_ANALYSIS;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-border bg-background/30 p-8 backdrop-blur-sm">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Contract analysis (demo)
            </p>
            <h2 className="mt-1 truncate font-heading text-2xl font-semibold text-foreground">
              {contract_name}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Vendor agreement · {clauses.length} clauses detected ·{" "}
              {vendor_screening.jurisdiction}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-text-muted">Deal safety score</p>
              <p
                className={`font-heading text-4xl font-bold ${
                  deal_safety_score < 50
                    ? "text-destructive"
                    : deal_safety_score < 75
                      ? "text-amber-500"
                      : "text-emerald-500"
                }`}
              >
                {deal_safety_score}
                <span className="text-lg font-medium text-text-muted">/100</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clause cards */}
      <section aria-label="Analyzed clauses">
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
          Clause Analysis
        </h3>
        <ul className="space-y-3">
          {clauses.map((clause) => (
            <li
              key={clause.id}
              className="rounded-xl border border-border bg-background/30 p-5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-medium text-foreground">{clause.title}</h4>
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${riskBadgeClasses(clause.risk)}`}>
                    {clause.risk.charAt(0).toUpperCase() + clause.risk.slice(1)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {clause.confidence === "high" ? "High confidence" : "Low confidence"}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-text-muted">{clause.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Vendor screening */}
      {vendor_screening && (
        <section aria-label="Vendor screening" className="rounded-xl border border-border bg-background/30 p-6 backdrop-blur-sm">
          <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
            Vendor Screening
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-muted">Vendor name</p>
              <p className="text-sm font-medium text-foreground">{vendor_screening.name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Jurisdiction</p>
              <p className="text-sm font-medium text-foreground">{vendor_screening.jurisdiction}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Contract value</p>
              <p className="text-sm font-medium text-foreground">{vendor_screening.contract_value}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Term</p>
              <p className="text-sm font-medium text-foreground">{vendor_screening.term}</p>
            </div>
          </div>
          {vendor_screening.known_risk_flags.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-destructive">
                Risk flags
              </p>
              <ul className="space-y-1">
                {vendor_screening.known_risk_flags.map((flag, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-text-muted"
                  >
                    <span className="mt-0.5 text-destructive">•</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Recommendations */}
      <section aria-label="Recommendations">
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
          Recommendations
        </h3>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="rounded-xl border border-border bg-background/30 p-4 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-foreground">{rec.text}</p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    rec.priority === "critical"
                      ? "bg-destructive/10 text-destructive"
                      : rec.priority === "high"
                        ? "bg-amber-500/10 text-amber-400"
                        : rec.priority === "medium"
                          ? "bg-accent/10 text-accent"
                          : "bg-background/50 border border-border text-text-muted"
                  }`}
                >
                  {rec.priority}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── Live dashboard — renders validated backend analysis ────────────────── */

function LiveDashboard({ result }: { result?: PipelineResult }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/30 p-12 text-center backdrop-blur-sm">
        <h2 className="font-heading text-2xl font-semibold text-foreground">
          Analysis Complete
        </h2>
        <p className="mt-2 text-sm text-text-muted">No result data available.</p>
      </div>
    );
  }

  const { analysis } = result;
  const riskColor = riskTextColor(analysis.overallRisk);

  return (
    <div className="space-y-6">
      {/* Summary card — contract type, overall risk, executive summary */}
      <div className="rounded-xl border border-border bg-background/30 p-8 backdrop-blur-sm">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Contract analysis
            </p>
            <h2 className="mt-1 truncate font-heading text-2xl font-semibold text-foreground">
              {result.contractName}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {analysis.contractType} · {analysis.clauses.length} clauses
              detected ·{" "}
              {(analysis.confidenceScore * 100).toFixed(0)}% confidence
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-text-muted">Risk score</p>
              <p className={`font-heading text-4xl font-bold ${riskColor}`}>
                {analysis.contractRiskScore}
                <span className="text-lg font-medium text-text-muted">/100</span>
              </p>
            </div>
            <div className={riskBadgeClasses(analysis.overallRisk)}>
              <span className="rounded-lg px-3 py-1.5 text-sm font-semibold inline-block">
                {analysis.overallRisk}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-text-muted">
          {analysis.executiveSummary}
        </p>
      </div>

      {/* Clause cards — each with risk, excerpt, explanation, reason, recommendation */}
      <section aria-label="Analyzed clauses">
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
          Clause Analysis
        </h3>
        <ul className="space-y-3">
          {analysis.clauses.map((clause, i) => (
            <li
              key={`${clause.name}-${i}`}
              className="rounded-xl border border-border bg-background/30 p-5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-medium text-foreground">{clause.name}</h4>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${riskBadgeClasses(clause.riskLevel)}`}
                >
                  {clause.riskLevel}
                </span>
              </div>

              {/* Original clause excerpt */}
              <blockquote className="mt-2 border-l-2 border-border pl-3 text-xs italic text-text-muted">
                &ldquo;{clause.originalText}&rdquo;
              </blockquote>

              {/* Plain-English explanation */}
              <p className="mt-2 text-sm text-text-muted">{clause.explanation}</p>

              {/* Reason */}
              <p className="mt-2 text-xs text-text-muted">
                <span className="font-medium text-foreground">Why:</span>{" "}
                {clause.reason}
              </p>

              {/* Recommendation */}
              <p className="mt-2 text-xs text-text-muted">
                <span className="font-medium text-foreground">Recommendation:</span>{" "}
                {clause.recommendation}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Missing protections */}
      {analysis.missingProtections.length > 0 && (
        <section aria-label="Missing protections">
          <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
            Missing Protections
          </h3>
          <ul className="space-y-2">
            {analysis.missingProtections.map((mp, i) => (
              <li
                key={`${mp.name}-${i}`}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background/30 p-4 backdrop-blur-sm"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{mp.name}</p>
                  <p className="mt-1 text-xs text-text-muted">{mp.reason}</p>
                </div>
                <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  {mp.priority} priority
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      <section aria-label="Recommendations">
        <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
          Recommendations
        </h3>
        <ul className="space-y-2">
          {analysis.recommendations.map((rec, i) => (
            <li
              key={`${rec.title}-${i}`}
              className="rounded-xl border border-border bg-background/30 p-4 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-foreground">{rec.title}</p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    rec.priority === "High"
                      ? "bg-destructive/10 text-destructive"
                      : rec.priority === "Medium"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-accent/10 text-accent"
                  }`}
                >
                  {rec.priority}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{rec.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}