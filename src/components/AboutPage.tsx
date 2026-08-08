import { ShieldCheck, Upload, Search, Scale, Lightbulb, Shield, FileText, Building2, Users, Briefcase, ClipboardCheck, ArrowRight } from "lucide-react";

interface AboutPageProps {
  onNavigateAnalyze: () => void;
}

const workflows = [
  {
    icon: Upload,
    title: "Upload",
    description:
      "Drop a vendor contract or NDA as a PDF — max 15 MB. Your file is encrypted at rest and processed server-side. Nothing is stored longer than needed for the analysis cycle.",
  },
  {
    icon: Search,
    title: "Analyze",
    description:
      "Our extraction engine reads every clause — payment terms, termination, liability, indemnification, data privacy, non-compete, and more. Each clause is tagged and presented in plain language.",
  },
  {
    icon: Scale,
    title: "Assess",
    description:
      "Every clause receives a risk level — Low, Medium, High, or Critical — based on how it deviates from standard market practice. A vendor reputation signal is cross-referenced from published records.",
  },
  {
    icon: Lightbulb,
    title: "Decide",
    description:
      "A clear Deal Safety Score and an executive summary give you what you need: a yes, a no, or a list of points to negotiate. No legal degree required.",
  },
];

const userGroups = [
  {
    icon: Building2,
    label: "Small Business Owners",
    description: "Sign NDAs and vendor agreements without a legal team on staff.",
  },
  {
    icon: Briefcase,
    label: "Startup Founders",
    description: "Move fast without signing something that comes back to haunt you.",
  },
  {
    icon: ClipboardCheck,
    label: "Procurement Teams",
    description: "Screen vendors and standardise contract review across deals.",
  },
  {
    icon: Users,
    label: "Operations & Consultants",
    description: "Advise clients with objective, repeatable risk data.",
  },
];

export function AboutPage({ onNavigateAnalyze }: AboutPageProps) {
  return (
    <div className="bg-grid relative min-h-screen">
      {/* Glow backdrop */}
      <div className="bg-glow pointer-events-none fixed inset-0" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* ───────────────────── Hero ───────────────────── */}
        <section className="mb-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <ShieldCheck className="h-8 w-8 text-brand" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground sm:text-5xl">
            About Deal Shield
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            Deal Shield helps you identify contract risks and vendor concerns
            before making business decisions. We translate complex legal language
            into clear, actionable insights — so you know the risk before you sign.
          </p>
        </section>

        {/* ───────────────────── The Problem ───────────────────── */}
        <section className="mb-16">
          <div className="rounded-2xl border border-border/40 bg-background/60 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="font-heading text-2xl font-semibold text-foreground">
              The Problem
            </h2>
            <p className="mt-3 leading-relaxed text-text-secondary">
              Every business signs contracts. NDAs, vendor agreements, service
              terms, partnership letters — they arrive as PDFs, get skimmed, and
              get signed. Dense legal language hides risk in plain sight:
              auto-renewal traps, one-sided liability caps, data ownership
              giveaways, and termination penalties that only apply to you.
            </p>
            <p className="mt-3 leading-relaxed text-text-secondary">
              Meanwhile, checking who you are doing business with means
              cross-referencing spreadsheets, public records, and hearsay. Small
              teams and founders rarely have the time — or the legal budget —
              to do it properly.
            </p>
          </div>
        </section>

        {/* ───────────────────── The Solution ───────────────────── */}
        <section className="mb-16">
          <div className="rounded-2xl border border-border/40 bg-background/60 p-6 backdrop-blur-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="mt-1 hidden shrink-0 sm:block">
                <Shield className="h-6 w-6 text-accent" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-2xl font-semibold text-foreground">
                  How Deal Shield Solves It
                </h2>
                <p className="mt-3 leading-relaxed text-text-secondary">
                  Deal Shield automates the two things every deal needs:{" "}
                  <strong className="text-foreground">contract clause analysis</strong> and{" "}
                  <strong className="text-foreground">vendor risk awareness</strong>.
                  Upload a PDF and within seconds you see:
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    "Every significant clause extracted and written in plain language.",
                    "A per-clause risk rating from Low to Critical, with explanation.",
                    "A vendor reputation signal based on available public data.",
                    "An overall Deal Safety Score that tells you how risky this deal is.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────── Workflow ───────────────────── */}
        <section className="mb-16">
          <h2 className="mb-2 text-center font-heading text-2xl font-semibold text-foreground">
            How It Works
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-text-muted">
            Four steps from PDF to a decision you can stand behind.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {workflows.map((step, i) => (
              <div
                key={step.title}
                className="group rounded-xl border border-border/30 bg-background/40 p-5 backdrop-blur-sm transition-all duration-200 hover:border-brand/30 hover:bg-background/70"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-text-muted">
                    STEP {i + 1}
                  </span>
                </div>
                <h3 className="mb-1.5 text-base font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────────── Intended Users ───────────────────── */}
        <section className="mb-16">
          <h2 className="mb-2 text-center font-heading text-2xl font-semibold text-foreground">
            Who It Is For
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-text-muted">
            Built for teams that need contract clarity without a legal department.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {userGroups.map((group) => (
              <div
                key={group.label}
                className="rounded-xl border border-border/20 bg-background/30 p-5 text-center backdrop-blur-sm"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <group.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mb-1 text-sm font-bold text-foreground">
                  {group.label}
                </h3>
                <p className="text-xs leading-relaxed text-text-muted">
                  {group.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────────── Disclaimer ───────────────────── */}
        <section className="mb-16">
          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Responsible AI & Legal Disclaimer
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  Deal Shield uses artificial intelligence to analyse contract language and
                  surface potential risks. The output — including clause ratings, the vendor
                  signal, and the Deal Safety Score — is generated by a statistical model and
                  is provided for <strong className="text-foreground">informational and
                  decision-support purposes only</strong>. It does not constitute legal advice,
                  and it does not create an attorney-client relationship.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  We recommend you consult a qualified legal professional before signing any
                  contract, especially for high-value or complex agreements. Deal Shield is a
                  tool that helps you ask better questions — it is not a replacement for
                  professional judgement.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-text-muted">
                  Deal Shield does not store the content of uploaded contracts beyond the
                  analysis session. Extracted text is processed ephemerally and is not used
                  to train or improve the underlying AI models.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────── CTA ───────────────────── */}
        <section className="text-center">
          <button
            onClick={onNavigateAnalyze}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{ backgroundColor: "#2563EB" }}
          >
            Analyze a Contract
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="mt-3 text-xs text-text-muted">
            No account needed. Upload a PDF or try the interactive demo.
          </p>
        </section>
      </div>
    </div>
  );
}