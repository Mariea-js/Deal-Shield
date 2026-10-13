# 🛡️ Deal Shield
### AI-Powered Contract Analysis & Vendor Risk Intelligence

**Top-5 Finalist — AI Factory Hackathon by lablab.ai | Team Project**

Deal Shield is an AI-assisted decision-support prototype designed to help businesses identify contractual risks, investigate vendor credibility, and make more informed decisions before entering commercial agreements.

The platform combines document processing, AI-assisted contract review, public-web vendor intelligence, and structured risk assessment in a unified interface.

> **Project status:** Hackathon prototype. Some capabilities require configured Supabase services, external APIs, and enabled AI analysis. This is not a production-certified legal or financial risk assessment tool.

---

## 🎯 Problem Statement

Businesses often evaluate contracts and potential vendors using fragmented processes. Contractual obligations, unfavorable clauses, missing protections, and vendor credibility concerns can be difficult to identify consistently.

Deal Shield explores how AI and structured evidence analysis can make these early-stage reviews more accessible, explainable, and efficient.

## ✨ Key Capabilities

### 1. AI-Assisted Contract Review

- Upload PDF contracts for processing.
- Extract text through a server-side document-processing pipeline.
- Identify and explain potentially risky clauses.
- Generate structured risk classifications and recommendations.
- Highlight missing contractual protections.
- Present findings in a readable analysis workspace.

### 2. Vendor Risk Intelligence

- Search publicly available vendor information using Bright Data.
- Analyze evidence signals using an AI service.
- Generate structured vendor risk assessments.
- Calculate vendor scores using deterministic scoring logic.
- Cache vendor checks to reduce repeated requests.
- Distinguish insufficient information from evidence of actual risk.

### 3. Explainable Risk Assessment

Deal Shield emphasizes interpretable outputs rather than unexplained AI judgments.

The implementation includes structured risk categories, supporting explanations, confidence indicators, and actionable recommendations.

**Important:** Contract analysis and vendor screening are implemented as separate workflows. A final unified Deal Safety Score is not implemented in the inspected contract-analysis pipeline.

---

## 🏗️ System Architecture

**Frontend:** React + TypeScript + Vite + Tailwind CSS

**Backend services:** Supabase Storage, database services, and Edge Functions

**External intelligence:** Bright Data SERP API

**AI integration:** AI/ML API with configurable model selection

### Contract Analysis Workflow

1. The user uploads a PDF contract.
2. The file is stored in a Supabase Storage bucket.
3. The `pdf-extract` Edge Function extracts and stores contract text.
4. The `analyze-contract` Edge Function requests structured AI analysis when live analysis is enabled.
5. The returned data is validated before being presented in the interface.

### Vendor Screening Workflow

1. The user enters vendor identification information.
2. The `vendor-check` Edge Function retrieves relevant public-web evidence.
3. AI-assisted analysis identifies structured evidence signals.
4. Application logic calculates vendor risk indicators.
5. The interface displays the resulting assessment and supporting information.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, Lucide React |
| Backend | Supabase Edge Functions |
| Storage & Database | Supabase |
| PDF Processing | PDF.js |
| AI Integration | AI/ML API |
| Vendor Intelligence | Bright Data SERP API |
| Validation | TypeScript runtime validation |

---

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- A configured Supabase project
- Required Supabase Storage and database resources
- Deployed Supabase Edge Functions
- API credentials for the external services used

### Install and Run

Clone the repository:

```bash
git clone https://github.com/Mariea-js/Deal-Shield.git
cd Deal-Shield
```

Install dependencies:

```bash
npm install
```

Create a local `.env` file with the relevant public frontend configuration:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Start the development server:

```bash
npm run dev
```

For production builds:

```bash
npm run build
```

**Backend configuration:** The frontend alone is not sufficient for live contract analysis or vendor screening. The Supabase Edge Functions, storage permissions, database resources, and server-side API credentials must also be configured.

Never place AI provider credentials, Bright Data secrets, or Supabase service-role credentials in frontend environment variables.

---

## 📂 Project Structure

```text
Deal-Shield/
├── public/
├── src/
│   ├── components/
│   │   ├── ContractWorkspace.tsx
│   │   ├── PdfUpload.tsx
│   │   ├── VendorCheck.tsx
│   │   ├── LandingPage.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── pipeline.ts
│   │   ├── validation.ts
│   │   ├── pdf.ts
│   │   ├── supabase.ts
│   │   └── ...
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── functions/
│       ├── analyze-contract/
│       ├── pdf-extract/
│       └── vendor-check/
├── package.json
└── README.md
```

---

## 🔍 Engineering Considerations

The implementation includes several reliability and security-oriented design decisions:

- Server-side handling of external AI provider credentials.
- Structured validation of AI-generated responses.
- Request timeouts and user-facing error handling.
- Separation of document extraction from AI analysis.
- Deterministic vendor scoring based on evidence signals.
- Vendor-check caching.
- Explicit handling of incomplete vendor information.

These measures improve prototype robustness but do not replace production security testing, independent risk validation, or legal review.

---

## 🏆 Hackathon Context

Deal Shield was developed as a collaborative project during the **AI Factory Hackathon organized through lablab.ai**, where the team was selected among the **Top 5 finalists**.

The project brought together AI integration, vendor research, contract-processing workflows, frontend development, and risk-assessment design within a hackathon development cycle.

### Team Collaboration

This repository represents a collaborative team project. Contributions included application development, system architecture, AI integration, vendor-risk research, evaluation refinement, technical documentation, and project presentation.

Individual responsibilities should be attributed accurately in contributors' personal portfolios.

---

## 🔮 Future Improvements

- Integrate contract and vendor findings into a validated combined risk score.
- Expand automated testing and evaluation datasets.
- Add stronger evidence traceability and source references.
- Improve document handling for scanned PDFs.
- Introduce human-review workflows for high-risk findings.
- Evaluate scoring consistency, false positives, and model reliability.
- Conduct production security and privacy assessments.

---

## ⚠️ Limitations and Disclaimer

Deal Shield is an experimental AI-assisted risk-analysis prototype.

AI-generated interpretations may be incomplete or incorrect. Public-web vendor information can be outdated or misleading. Risk scores should not be treated as definitive evidence of vendor trustworthiness or contractual safety.

The system is intended to support preliminary review, not replace qualified legal, compliance, procurement, or financial professionals.

---


[View Deal Shield on GitHub](https://github.com/Mariea-js/Deal-Shield)

**Developed collaboratively for the AI Factory Hackathon.**
