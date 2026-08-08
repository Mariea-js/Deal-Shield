import { useCallback, useEffect, useRef, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { ContractWorkspace } from "./components/ContractWorkspace";
import { AboutPage } from "./components/AboutPage";
import { Header } from "./components/Header";
import type { HeaderNavItem } from "./components/Header";
import { runAnalysisPipeline } from "./lib/pipeline";
import type { PipelineResult, PipelineStage } from "./lib/types";
import { PipelineError } from "./lib/types";

type Page =
  | { route: "upload" }
  | { route: "about" }
  | { route: "workspace"; mode: "demo" }
  | { route: "workspace"; mode: "loading"; stage: PipelineStage }
  | { route: "workspace"; mode: "success"; result: PipelineResult }
  | { route: "workspace"; mode: "error"; message: string };

/**
 * Maps backend error codes to user-safe messages.
 * The full list comes from pdf-extract and analyze-contract error responses.
 */
function toUserMessage(err: unknown): string {
  if (err instanceof PipelineError) {
    switch (err.code) {
      // Upload / Storage
      case "UPLOAD_FAILED":
        return err.message;
      case "STORAGE_ERROR":
        return "We couldn't save your file. Please check your connection and try again.";

      // PDF validation (pdf-extract)
      case "PDF_TOO_LARGE":
        return "That file is too large. Maximum size is 15 MB.";
      case "PDF_INVALID":
        return "That file doesn't look like a valid PDF.";
      case "PDF_CORRUPTED":
        return "We couldn't open that PDF. It may be corrupted or password-protected.";
      case "PDF_EMPTY":
        return "That PDF seems to be empty.";
      case "PDF_TEXT_NOT_EXTRACTABLE":
        return "No readable text was found in that PDF. It may be a scanned document.";

      // Extraction
      case "EXTRACTION_ERROR":
      case "EXTRACTION_FAILED":
        return "We couldn't read the contract from this PDF. Please try a different file.";

      // Contract
      case "TEXT_MISSING":
      case "TEXT_INSUFFICIENT":
        return "We couldn't find enough readable text in this PDF. It may be image-based.";

      // AI / Live analysis
      case "LIVE_ANALYSIS_DISABLED":
        return "Live analysis is currently unavailable. Try the demo to explore the dashboard.";
      case "AI_CONFIG_ERROR":
        return "The analysis engine isn't configured yet. Please try the demo instead.";
      case "AI_QUOTA":
        return "The analysis service is a bit busy right now. Please try again in a moment.";
      case "AI_TIMEOUT":
        return "The analysis took too long. Please try again.";
      case "AI_UNAVAILABLE":
        return "The analysis service is temporarily unavailable. Please try again.";
      case "AI_INVALID_RESPONSE":
      case "ANALYSIS_FAILED":
        return "The analysis came back in an unexpected format. Please try again.";
      case "CONTRACT_NOT_FOUND":
        return "We couldn't find that contract. Please try uploading again.";

      // Client timeouts / network
      case "TIMEOUT":
        return err.message;
      case "NETWORK_ERROR":
        return err.message;
      case "INVALID_RESPONSE":
        return "We got an unexpected response. Please try again.";

      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export default function App() {
  const [page, setPage] = useState<Page>({ route: "upload" });
  const [activeNav, setActiveNav] = useState<HeaderNavItem>("home");

  // ── Centralized scroll restoration ───────────────────────────────
  const [navGeneration, setNavGeneration] = useState(0);
  const pendingScrollHashRef = useRef<string | null>(null);
  const scrollRetriesRef = useRef(0);

  useEffect(() => {
    const hash = pendingScrollHashRef.current;
    pendingScrollHashRef.current = null;
    scrollRetriesRef.current = 0;

    const tryScroll = () => {
      if (!hash) {
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // Element not yet mounted — retry with RAF up to 10 times
      if (scrollRetriesRef.current < 10) {
        scrollRetriesRef.current += 1;
        requestAnimationFrame(tryScroll);
      }
    };

    const raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [navGeneration]);
  // ──────────────────────────────────────────────────────────────────

  const lastFileRef = useRef<File | null>(null);
  const isRunningRef = useRef(false);

  const runPipeline = useCallback(async (file: File) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    lastFileRef.current = file;

    setPage({ route: "workspace", mode: "loading", stage: "uploading" });
    console.log("[pipeline] starting analysis for", file.name);

    try {
      const result = await runAnalysisPipeline(file, (stage) => {
        setPage({ route: "workspace", mode: "loading", stage });
      });

      setPage({ route: "workspace", mode: "success", result });
      console.log("[pipeline] ✓ complete —", result.analysis.clauses.length, "clauses");
    } catch (err) {
      const message = toUserMessage(err);
      setPage({ route: "workspace", mode: "error", message });
      console.error("[pipeline] ✗ failed —", message);
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  const handleStartAnalysis = useCallback(
    (file: File) => {
      runPipeline(file);
    },
    [runPipeline],
  );

  // ── Navigation helpers ────────────────────────────────────────────
  const navigateToHomeSection = useCallback(
    (hash: string | null, navItem: HeaderNavItem) => {
      setActiveNav(navItem);
      pendingScrollHashRef.current = hash;
      setPage({ route: "upload" });
      setNavGeneration((g) => g + 1);
    },
    [],
  );

  const handleTryDemo = useCallback(() => {
    setActiveNav("dashboard");
    pendingScrollHashRef.current = null;
    setPage({ route: "workspace", mode: "demo" });
    setNavGeneration((g) => g + 1);
  }, []);

  const handleBackToUpload = useCallback(() => {
    navigateToHomeSection(null, "home");
  }, [navigateToHomeSection]);

  const handleAboutCtaAnalyze = useCallback(() => {
    navigateToHomeSection("contract-analysis", "analyze");
  }, [navigateToHomeSection]);

  const handleRetry = useCallback(() => {
    if (lastFileRef.current) {
      runPipeline(lastFileRef.current);
    }
  }, [runPipeline]);

  const handleNavClick = useCallback(
    (item: HeaderNavItem) => {
      switch (item) {
        case "home":
          navigateToHomeSection(null, "home");
          break;
        case "analyze":
          navigateToHomeSection("contract-analysis", "analyze");
          break;
        case "vendor":
          navigateToHomeSection("vendor-section", "vendor");
          break;
        case "about":
          setActiveNav("about");
          setPage({ route: "about" });
          setNavGeneration((g) => g + 1);
          break;
        case "dashboard":
          setActiveNav("dashboard");
          setPage({ route: "workspace", mode: "demo" });
          setNavGeneration((g) => g + 1);
          break;
      }
    },
    [navigateToHomeSection],
  );
  // ──────────────────────────────────────────────────────────────────

  const renderWorkspaceContent = (workspacePage: Extract<Page, { route: "workspace" }>) => {
    switch (workspacePage.mode) {
      case "loading":
        return (
          <ContractWorkspace
            mode="loading"
            stage={workspacePage.stage}
            onBackToUpload={handleBackToUpload}
          />
        );
      case "success":
        return (
          <ContractWorkspace
            mode="success"
            result={workspacePage.result}
            onBackToUpload={handleBackToUpload}
          />
        );
      case "error":
        return (
          <ContractWorkspace
            mode="error"
            message={workspacePage.message}
            onBackToUpload={handleBackToUpload}
            onRetry={handleRetry}
          />
        );
      default:
        return (
          <ContractWorkspace
            mode="demo"
            onBackToUpload={handleBackToUpload}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeNav={activeNav}
        onNavigate={handleNavClick}
        onTryDemo={handleTryDemo}
      />
      <div className="pt-[72px]">
        {page.route === "about" ? (
          <AboutPage onNavigateAnalyze={handleAboutCtaAnalyze} />
        ) : page.route === "workspace" ? (
          renderWorkspaceContent(page)
        ) : (
          <LandingPage
            onStartAnalysis={handleStartAnalysis}
            onTryDemo={handleTryDemo}
          />
        )}
      </div>
    </div>
  );
}