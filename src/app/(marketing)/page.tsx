import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Briefcase,
  Building2,
  Cpu,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { LeadPreview } from "@/components/marketing/lead-preview";
import { Card, Container, Eyebrow, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";
import { dimensions } from "@/lib/marketing/site";

const problems = [
  {
    title: "Firmographics tell you who, never why",
    body: "Industry, headcount and tech stack describe a company. None of them say whether there is work inside it worth automating — which is the only thing you actually need to know.",
  },
  {
    title: "Everyone buys the same list",
    body: "When every vendor works from the same purchased data, the only remaining edge is timing. Ejentic finds the signal before it reaches a list.",
  },
  {
    title: "Discovery happens after the deal",
    body: "Most teams uncover the real automation opportunities during delivery — when it is far too late to scope or price them properly.",
  },
];

const differentiators = [
  {
    icon: Search,
    title: "Evidence, not inference",
    body: "Every score traces back to the page it came from. No black-box propensity model, no unverifiable intent data, no guessing.",
  },
  {
    icon: Layers,
    title: "Scored on seven dimensions",
    body: "Labour, repetition, information support, scalability, economic consequence, AI plausibility and strategic advantage — each scored out of ten.",
  },
  {
    icon: RefreshCw,
    title: "Continuous, not quarterly",
    body: "Sources are re-crawled on a schedule. When a company posts the process document that changes its score, you hear about it.",
  },
  {
    icon: ShieldCheck,
    title: "Built to behave",
    body: "robots.txt is honoured, requests are throttled per host, private networks are blocked, and only public business information is collected.",
  },
];

const steps = [
  {
    icon: Target,
    title: "Point it at a market",
    body: "Seed the crawler with domains, a URL list, or a directory. Scope by geography, sector, or company size — then queue it.",
  },
  {
    icon: Cpu,
    title: "Crawl and extract",
    body: "A throttled, robots-aware worker fetches pages, extracts text and structured data, and discovers same-origin links as it goes.",
  },
  {
    icon: Layers,
    title: "Evaluate the workflows",
    body: "Detected workflows are scored across all seven dimensions, with a confidence figure derived from evidence and source coverage.",
  },
  {
    icon: Activity,
    title: "Receive qualified leads",
    body: "Companies clearing your thresholds land in a ranked queue with their scores and evidence — export, sync, or pull via API.",
  },
];

const audiences = [
  {
    icon: Briefcase,
    title: "AI agencies & consultancies",
    body: "Walk into the first call already knowing which three workflows are costing them a week a month — and what you would automate first.",
  },
  {
    icon: Building2,
    title: "Automation & B2B SaaS",
    body: "Build pipeline from live operational signals instead of firmographic filters, and let reps lead with the prospect's own process docs.",
  },
  {
    icon: Users,
    title: "Ops and portfolio teams",
    body: "Scan a portfolio or supply base for automation surface area, then sequence the work by expected value rather than by who complained loudest.",
  },
];

const comparison = [
  { label: "Basis for ranking", purchased: "Industry, headcount, tech stack", ejentic: "Evidence of manual, repetitive work" },
  { label: "Why now", purchased: "Not included", ejentic: "Signal triggered by a detected change" },
  { label: "Verification", purchased: "None — trust the vendor", ejentic: "Every score links to its source page" },
  { label: "Refresh cadence", purchased: "Quarterly export", ejentic: "Continuous re-crawl" },
  { label: "Scoring", purchased: "None", ejentic: "Seven dimensions, configurable weighting" },
];

const faqItems = [
  {
    question: "Where does the data come from?",
    answer:
      "Publicly available web pages: careers pages, process and help documentation, public PDFs, product changelogs and directory listings. Ejentic collects business information only — it does not buy personal data, does not bypass logins, and does not attempt to defeat paywalls.",
  },
  {
    question: "Is this just web scraping?",
    answer:
      "Crawling is one component of the pipeline, and not the valuable one. The product is the extraction and evaluation layer on top: turning unstructured public pages into named workflows, scoring those workflows on seven dimensions, and resolving them into evidence-backed opportunities.",
  },
  {
    question: "How is the score calculated?",
    answer:
      "Each workflow is scored from 0–10 on seven dimensions, averaged into an overall score out of 100, and paired with a confidence value derived from evidence count and source coverage. The current model is published as heuristic-v1 with equal weighting and is deliberately open to inspection.",
  },
  {
    question: "Can I change how the dimensions are weighted?",
    answer:
      "Yes. Enterprise customers can adjust dimension weighting, define their own qualification thresholds, and add custom dimensions specific to their delivery model.",
  },
  {
    question: "What do I actually receive?",
    answer:
      "A ranked queue of qualified leads, each carrying the company record, per-dimension scores, an overall score, a confidence figure and source-linked evidence. Delivery is via the dashboard, CSV export, webhooks or the REST API.",
  },
  {
    question: "What about compliance?",
    answer:
      "The crawler honours robots.txt, throttles requests per host, blocks private-network destinations and limits response size. It collects public business information. We are happy to walk your counsel through the specifics before you sign anything.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mk-grid-lines" aria-hidden="true" />
        <div
          className="mk-glow"
          aria-hidden="true"
          style={{
            width: 620,
            height: 620,
            left: "50%",
            top: -300,
            transform: "translateX(-50%)",
            background: "rgba(37, 99, 235, 0.16)",
          }}
        />
        <Container className="pt-[64px] text-center sm:pt-[88px]">
          <Reveal>
            <Eyebrow>AI opportunity intelligence</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mk-h1 mx-auto mt-6 max-w-[860px]">
              Find the companies where{" "}
              <span className="mk-gradient-text">AI actually pays off</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mk-lead mx-auto mt-6 max-w-[660px]">
              Ejentic crawls the open web for evidence of manual, repetitive knowledge work, scores every
              company on seven dimensions, and hands your team qualified leads with the receipts attached.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="mk-btn mk-btn-primary">
                Request access
                <ArrowRight size={16} strokeWidth={2.2} />
              </Link>
              <Link href="/how-it-works" className="mk-btn mk-btn-secondary">
                See how it works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-7 text-[13px] text-[var(--text-muted)]">
              Polite crawler · robots.txt respected · every score traceable to a source page
            </p>
          </Reveal>
        </Container>

        <Container className="pb-[88px] pt-[56px]">
          <Reveal delay={300}>
            <LeadPreview />
          </Reveal>
        </Container>
      </section>

      {/* Problem */}
      <Section>
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="The problem"
              title="A list of companies is not a pipeline"
              description="Buying a list tells you who exists. It never tells you who has a problem you can solve — or whether they have one at all."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {problems.map((problem, index) => (
              <Reveal key={problem.title} delay={index * 80}>
                <Card className="h-full">
                  <h3 className="mk-h3">{problem.title}</h3>
                  <p className="mk-body mt-3">{problem.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Differentiators */}
      <Section className="bg-white">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Why Ejentic"
              title="Signals you can defend in a meeting"
              description="Every number in the platform can be opened, traced and argued with. If a rep cannot explain why an account ranks highly, it should not be on the list."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {differentiators.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={index * 70}>
                  <Card hover className="h-full">
                    <div
                      className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px]"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <h3 className="mk-h3">{item.title}</h3>
                    <p className="mk-body mt-2.5">{item.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section>
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="How it works"
              title="From a market to a ranked queue in four steps"
              description="No manual research, no spreadsheet stitching, no guessing which account deserves the first call."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={index * 70}>
                  <Card className="h-full">
                    <div className="mb-5 flex items-center justify-between">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                      >
                        <Icon size={19} strokeWidth={1.9} />
                      </div>
                      <span className="mk-step-number">{index + 1}</span>
                    </div>
                    <h3 className="mk-h3">{step.title}</h3>
                    <p className="mk-body mt-2.5">{step.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={100}>
            <div className="mt-10 text-center">
              <Link href="/how-it-works" className="mk-btn mk-btn-secondary">
                Read the full methodology
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Seven dimensions */}
      <Section dark>
        <div className="mk-grid-lines-dark opacity-70" aria-hidden="true" />
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="The framework"
              title="Seven dimensions, one defensible score"
              description="A workflow that is labour-intensive but rare is a bad bet. One that is repetitive, document-driven and economically consequential is a very good one. The framework exists to tell those apart."
            />
          </Reveal>
          <div className="mt-14 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {dimensions.map((dimension, index) => (
              <Reveal key={dimension.key} delay={index * 50}>
                <div className="flex gap-4">
                  <span
                    className="mt-[1px] flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12.5px] font-bold"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color: "#9dbaff",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="mk-h4 !text-white">{dimension.label}</h3>
                    <p className="mk-body mt-1">{dimension.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-12 text-center text-[13px] text-[var(--mk-on-dark-muted)]">
              Currently equal-weighted and published as <span className="text-[#9dbaff]">heuristic-v1</span>.
              Enterprise plans support custom weighting.
            </p>
          </Reveal>
        </Container>
      </Section>

      {/* Comparison */}
      <Section className="bg-white">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Compared"
              title="A purchased list vs. evidence-backed signal"
              description="Same goal, completely different basis for deciding who to call first."
            />
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-12 overflow-hidden rounded-[var(--mk-radius)] border border-[var(--border)]">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
                <span />
                <span>Purchased list</span>
                <span className="text-[var(--primary)]">Ejentic</span>
              </div>
              {comparison.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 border-b border-[var(--border)] px-5 py-4 text-[14px] last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1"
                >
                  <span className="font-medium text-[var(--text-primary)]">{row.label}</span>
                  <span className="text-[var(--text-muted)] max-sm:before:mr-2 max-sm:before:text-[var(--text-disabled)] max-sm:before:content-['List:']">
                    {row.purchased}
                  </span>
                  <span className="font-medium text-[var(--text-primary)] max-sm:before:mr-2 max-sm:before:text-[var(--text-disabled)] max-sm:before:content-['Ejentic:']">
                    {row.ejentic}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Who it's for */}
      <Section>
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Who it's for"
              title="Built for teams that have to justify the automation"
              description="Anyone who needs to answer “why this company, and why now?” with something better than an industry code."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <Reveal key={audience.title} delay={index * 80}>
                  <Card hover className="h-full">
                    <div
                      className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px]"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <h3 className="mk-h3">{audience.title}</h3>
                    <p className="mk-body mt-2.5">{audience.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section className="bg-white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <SectionTitle
                align="left"
                eyebrow="FAQ"
                title="The questions we get asked first"
                description="Still unclear? Ask us directly and we will answer properly."
              />
              <Link href="/contact" className="mk-btn mk-btn-secondary mt-7">
                Contact us
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>
            </Reveal>
            <Reveal delay={80}>
              <Faq items={faqItems} />
            </Reveal>
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
