export interface Clause {
  id: string;
  title: string;
  risk: "low" | "medium" | "high" | "critical";
  description: string;
  confidence: "high" | "low";
}

export interface VendorScreening {
  name: string;
  jurisdiction: string;
  contract_value: string;
  term: string;
  known_risk_flags: string[];
}

export interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  text: string;
}

export interface AnalysisResult {
  id: string;
  deal_safety_score: number;
  contract_name: string;
  analyzed_at: string;
  clauses: Clause[];
  vendor_screening: VendorScreening;
  recommendations: Recommendation[];
}

export type AnalysisState = "idle" | "loading" | "success" | "error";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ── Live analysis types (from backend edge function) ──────────────────────

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type Priority = "Low" | "Medium" | "High";

export interface LiveClause {
  name: string;
  originalText: string;
  explanation: string;
  riskLevel: RiskLevel;
  confidenceScore: number;
  reason: string;
  recommendation: string;
}

export interface MissingProtection {
  name: string;
  reason: string;
  priority: Priority;
}

export interface LiveRecommendation {
  title: string;
  description: string;
  reason: string;
  priority: Priority;
}

export interface LiveAnalysis {
  contractType: string;
  contractRiskScore: number;
  overallRisk: RiskLevel;
  confidenceScore: number;
  executiveSummary: string;
  clauses: LiveClause[];
  missingProtections: MissingProtection[];
  recommendations: LiveRecommendation[];
}

/** Shape of analyze-contract's `data` field on success. */
export interface AnalyzeResponse {
  analysisId: string;
  contractId: string;
  aiModel: string;
  aiDurationMs: number;
  wasTruncated: boolean;
  analysis: LiveAnalysis;
}

export type PipelineStage = "uploading" | "extracting" | "analyzing";

export interface PipelineResult {
  contractName: string;
  analysis: LiveAnalysis;
}

// ── Vendor check types (from vendor-check Edge Function) ──────────────────

export interface VendorCheckResult {
  companyName: string;
  websiteUrl: string;
  summary: string;
  riskLevel: "Low" | "Medium" | "High" | "Critical" | "Unknown";
  trustScore: number | null;
  confidence: number | null;
  keyFindings: string[];
  recommendations: string[];
  sourceUrls: string[];
  checkedAt: string;
  unavailableChecks: string[];
  limitations: string[];
}

/** User-facing pipeline error with a code and safe message. */
export class PipelineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}