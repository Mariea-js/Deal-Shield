export const SAMPLE_ANALYSIS = {
  id: "demo-001",
  deal_safety_score: 72,
  contract_name: "Sample Vendor Agreement — AcmeCorp",
  analyzed_at: new Date().toISOString(),
  clauses: [
    {
      id: "clause-001",
      title: "Limitation of Liability",
      risk: "high",
      description:
        "Liability capped at 50% of contract value, with broad exclusion of indirect, consequential, and lost-profit damages. No cap for willful misconduct or data breaches.",
      confidence: "high",
    },
    {
      id: "clause-002",
      title: "Termination for Convenience",
      risk: "low",
      description:
        "Either party may terminate without cause on 30 days written notice. No early termination fee for Customer.",
      confidence: "high",
    },
    {
      id: "clause-003",
      title: "Data Protection & GDPR",
      risk: "low",
      description:
        "Vendor agrees to process data in accordance with GDPR, provides DPA, and notifies Customer of any data breaches within 48 hours.",
      confidence: "high",
    },
    {
      id: "clause-004",
      title: "Service Level Agreement (SLA)",
      risk: "medium",
      description:
        "99.5% uptime guarantee. Service credits of 5% per 0.5% below target, capped at 15% of monthly fees. No granular per-endpoint SLAs.",
      confidence: "high",
    },
    {
      id: "clause-005",
      title: "Indemnification",
      risk: "medium",
      description:
        "Mutual indemnification for IP infringement and third-party claims. Vendor indemnifies for data breaches caused by their negligence. Customer indemnifies for misuse of the service.",
      confidence: "low",
    },
    {
      id: "clause-006",
      title: "Auto-Renewal & Price Escalation",
      risk: "high",
      description:
        "Contract auto-renews annually. Pricing may increase up to 8% year-over-year. Customer must provide 90 days notice to prevent renewal.",
      confidence: "high",
    },
    {
      id: "clause-007",
      title: "Governing Law & Dispute Resolution",
      risk: "medium",
      description:
        "Governed by New York law. Mandatory binding arbitration for disputes under $500K. Class action waiver included.",
      confidence: "high",
    },
  ],
  vendor_screening: {
    name: "AcmeCorp Technologies Inc.",
    jurisdiction: "Delaware, USA",
    contract_value: "$240,000/year",
    term: "36 months (auto-renewing)",
    known_risk_flags: [
      "Auto-renewal with year-over-year 8% price escalator locked for 3-year term",
      "Liability cap excludes consequential damages — but only 50% of contract value",
      "Arbitration clause with class action waiver",
    ],
  },
  recommendations: [
    {
      priority: "critical",
      text: "Negotiate the liability cap upward to at least 100% of contract value, or 2x annual fees — current 50% cap is below market standard.",
    },
    {
      priority: "high",
      text: "Remove or cap the 8% year-over-year price escalation. Request CPI-linked escalation or a fixed annual increase of 3-4%.",
    },
    {
      priority: "high",
      text: "Extend the auto-renewal notice period from 90 to 120 days and add a 60-day termination window without cause after renewal notice.",
    },
    {
      priority: "medium",
      text: "Request per-endpoint SLA targets for critical API integrations alongside the overall uptime guarantee.",
    },
    {
      priority: "low",
      text: "Confirm the 48-hour data breach notification timeline meets your internal compliance requirements.",
    },
  ],
};