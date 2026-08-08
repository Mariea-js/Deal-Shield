import { useCallback, useEffect, useRef, useState } from "react";
import { PdfUpload, AnalyzeButton } from "./PdfUpload";
import { VendorCheck } from "./VendorCheck";

interface LandingPageProps {
  onStartAnalysis: (file: File) => void;
  onTryDemo: () => void;
}

export type AnalysisPhase =
  | "uploading"
  | "extracting"
  | "analyzing"
  | "scoring"
  | "complete";

export function LandingPage({ onStartAnalysis, onTryDemo }: LandingPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [progressPhase, setProgressPhase] = useState<AnalysisPhase | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldownRemaining(60);
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup cooldown interval on unmount (e.g. when App navigates to workspace).
  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!selectedFile || isAnalyzing) return;
    setProgressPhase("uploading");
    setIsAnalyzing(true);
    onStartAnalysis(selectedFile);
    startCooldown();
  }, [selectedFile, isAnalyzing, onStartAnalysis, startCooldown]);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleFileRemoved = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div id="home" className="bg-grid relative min-h-screen">
      <div className="bg-glow pointer-events-none fixed inset-0" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-16">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-bold text-foreground sm:text-5xl">
            Deal Shield
          </h1>
          <p className="mt-3 text-base text-text-secondary">
            Upload a vendor contract and get an instant risk assessment — clause
            analysis, vendor screening signal, and a clear{" "}
            <span className="text-accent">Deal Safety Score</span>.
          </p>
        </div>

        {/* ── Analyze Contract section ── */}
        <section
          id="contract-analysis"
          className="w-full"
          style={{ scrollMarginTop: 96 }}
        >
          <PdfUpload
            onFileSelected={handleFileSelected}
            onFileRemoved={handleFileRemoved}
            disabled={isAnalyzing}
          />
          <div className="mt-4">
            <AnalyzeButton
              disabled={!selectedFile}
              loading={isAnalyzing}
              onClick={handleAnalyze}
              cooldownRemaining={cooldownRemaining}
            />
          </div>
          {progressPhase && (
            <div className="mt-6 w-full">
              <ProgressTracker currentPhase={progressPhase} />
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="my-8 flex w-full items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ── Try Demo section ── */}
        <section
          id="demo"
          className="w-full"
          style={{ scrollMarginTop: 96 }}
        >
          <button
            onClick={onTryDemo}
            disabled={isAnalyzing}
            className="group w-full cursor-pointer rounded-xl border-2 border-border bg-background/60 px-8 py-4 text-center backdrop-blur-sm transition-all hover:border-accent/50 hover:bg-background/80 active:scale-[0.97] disabled:opacity-50"
          >
            <div className="mb-1 flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
              <span className="text-sm font-semibold text-foreground group-hover:text-accent">
                Try Demo
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Explore the full dashboard with sample data — no file needed
            </p>
          </button>
        </section>

        {/* ── Check Vendor section ── */}
        <section
          id="vendor-section"
          data-section="check-vendor"
          className="mt-12 w-full"
          style={{ scrollMarginTop: 96 }}
        >
          <VendorCheck />
        </section>

        {/* How it works — workflow explanation cards */}
        <div className="mt-12 grid w-full gap-6 sm:grid-cols-3">
          {[
            { step: "1", title: "Upload Contract", description: "Drop a PDF vendor agreement or NDA — max 15 MB." },
            { step: "2", title: "AI Analysis", description: "Our engine extracts clauses, flags risks, and generates a vendor signal from contract text." },
            { step: "3", title: "Deal Safety Score", description: "Get a clear, explainable score with recommendations you can act on." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {item.step}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-xs leading-relaxed text-text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressTracker({ currentPhase }: { currentPhase: AnalysisPhase }) {
  const phases: { key: AnalysisPhase; label: string }[] = [
    { key: "uploading", label: "Uploading" },
    { key: "extracting", label: "Extracting text" },
    { key: "analyzing", label: "Analyzing" },
    { key: "scoring", label: "Scoring" },
  ];

  const currentIndex = phases.findIndex((p) => p.key === currentPhase);

  return (
    <div className="rounded-xl border border-border bg-background/50 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {phases.map((phase, i) => (
          <div key={phase.key} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= currentIndex
                  ? "bg-accent text-background"
                  : "bg-background/50 border border-border text-text-muted"
              }`}
            >
              {i < currentIndex ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs ${
                i <= currentIndex ? "text-foreground" : "text-text-muted"
              }`}
            >
              {phase.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}