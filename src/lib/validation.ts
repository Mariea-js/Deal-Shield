/**
 * Runtime validation for the contract analysis response from analyze-contract.
 * Validates the LiveAnalysis shape before rendering to ensure the response
 * matches the expected schema. Throws PipelineError with "INVALID_RESPONSE"
 * on any structural or type mismatch.
 */

import type { LiveAnalysis, RiskLevel } from "./types";
import { PipelineError } from "./types";

const VALID_RISK_LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidRiskLevel(v: unknown): v is RiskLevel {
  return VALID_RISK_LEVELS.includes(v as RiskLevel);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Validates a raw analysis object (from the analyze-contract `data.analysis`
 * field) against the LiveAnalysis schema. Returns the validated/normalized
 * LiveAnalysis, or throws a PipelineError with a safe message.
 *
 * The validate-contract Edge Function already validates server-side; this is
 * defense-in-depth so the UI never renders a structurally invalid response.
 */
export function validateLiveAnalysis(raw: unknown): LiveAnalysis {
  const problems: string[] = [];

  if (!isRecord(raw)) {
    throw new PipelineError(
      "INVALID_RESPONSE",
      "The analysis came back in an unexpected format.",
    );
  }

  // ── contractType ──
  if (!isNonEmptyString(raw.contractType)) {
    problems.push("contractType: missing or empty");
  }

  // ── contractRiskScore ──
  if (!isFiniteNumber(raw.contractRiskScore)) {
    problems.push("contractRiskScore: missing or not a number");
  }

  // ── overallRisk ──
  if (!isValidRiskLevel(raw.overallRisk)) {
    problems.push("overallRisk: must be one of Low | Medium | High | Critical");
  }

  // ── confidenceScore ──
  if (!isFiniteNumber(raw.confidenceScore)) {
    problems.push("confidenceScore: missing or not a number");
  }

  // ── executiveSummary ──
  if (!isNonEmptyString(raw.executiveSummary)) {
    problems.push("executiveSummary: missing or empty");
  }

  // ── clauses ──
  const clauses: LiveAnalysis["clauses"] = [];
  if (!Array.isArray(raw.clauses)) {
    problems.push("clauses: must be an array");
  } else {
    raw.clauses.forEach((c: unknown, i: number) => {
      if (!isRecord(c)) {
        problems.push(`clauses[${i}]: not an object`);
        return;
      }
      const sub: string[] = [];
      if (!isNonEmptyString(c.name)) sub.push("name");
      if (!isNonEmptyString(c.originalText)) sub.push("originalText");
      if (!isNonEmptyString(c.explanation)) sub.push("explanation");
      if (!isValidRiskLevel(c.riskLevel)) sub.push("riskLevel");
      if (!isFiniteNumber(c.confidenceScore)) sub.push("confidenceScore");
      if (!isNonEmptyString(c.reason)) sub.push("reason");
      if (!isNonEmptyString(c.recommendation)) sub.push("recommendation");
      if (sub.length > 0) {
        problems.push(`clauses[${i}]: missing/invalid: ${sub.join(", ")}`);
        return;
      }
      clauses.push({
        name: (c.name as string).trim(),
        originalText: (c.originalText as string).trim(),
        explanation: (c.explanation as string).trim(),
        riskLevel: c.riskLevel as RiskLevel,
        confidenceScore: clamp01(c.confidenceScore as number),
        reason: (c.reason as string).trim(),
        recommendation: (c.recommendation as string).trim(),
      });
    });
  }

  // ── missingProtections (optional — may be empty) ──
  if (!Array.isArray(raw.missingProtections)) {
    problems.push("missingProtections: must be an array");
  }

  // ── recommendations ──
  const recommendations: LiveAnalysis["recommendations"] = [];
  if (!Array.isArray(raw.recommendations)) {
    problems.push("recommendations: must be an array");
  } else {
    raw.recommendations.forEach((r: unknown, i: number) => {
      if (!isRecord(r)) {
        problems.push(`recommendations[${i}]: not an object`);
        return;
      }
      const sub: string[] = [];
      if (!isNonEmptyString(r.title)) sub.push("title");
      if (!isNonEmptyString(r.description)) sub.push("description");
      if (!isNonEmptyString(r.reason)) sub.push("reason");
      if (!isNonEmptyString(r.priority) || !["Low", "Medium", "High"].includes(r.priority as string)) {
        sub.push("priority");
      }
      if (sub.length > 0) {
        problems.push(`recommendations[${i}]: missing/invalid: ${sub.join(", ")}`);
        return;
      }
      recommendations.push({
        title: (r.title as string).trim(),
        description: (r.description as string).trim(),
        reason: (r.reason as string).trim(),
        priority: r.priority as "Low" | "Medium" | "High",
      });
    });
  }

  if (problems.length > 0) {
    console.warn("[validation] LiveAnalysis validation failed:", problems);
    throw new PipelineError(
      "INVALID_RESPONSE",
      "The analysis came back in an unexpected format. Please try again.",
    );
  }

  return {
    contractType: (raw.contractType as string).trim(),
    contractRiskScore: clamp100(raw.contractRiskScore as number),
    overallRisk: raw.overallRisk as RiskLevel,
    confidenceScore: clamp01(raw.confidenceScore as number),
    executiveSummary: (raw.executiveSummary as string).trim(),
    clauses,
    missingProtections: Array.isArray(raw.missingProtections)
      ? raw.missingProtections.map((m: Record<string, unknown>) => ({
          name: (m.name as string).trim(),
          reason: (m.reason as string).trim(),
          priority: m.priority as "Low" | "Medium" | "High",
        }))
      : [],
    recommendations,
  };
}