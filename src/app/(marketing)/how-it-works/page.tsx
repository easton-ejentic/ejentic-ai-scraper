import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHero } from "@/components/marketing/page-hero";
import { Card, Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";
import { dimensions } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From seeding a market to receiving qualified leads: how Ejentic crawls, extracts, scores on seven dimensions and qualifies companies.",
};

const stages = [
  {
    step: "01",
    title: "Seed the market",
    duration: "Minutes",
    body: "You define the universe: a list of domains, a set of seed URLs, a directory, or a search-defined segment. Scoping filters — geography, sector, company size — narrow the crawl before a single request is issued.",
    detail: [
      "Domain and URL-list seeding",
      "Scope by sector, region and headcount band",
      "Exclusion lists for competitors and existing accounts",
    ],
  },
  {
    step: "02",
    title: "Crawl politely",
    duration: "Hours",
    body: "A standalone worker fetches pages under strict controls: per-host throttling, manual redirect handling, response-size caps, robots.txt checks and resolved-DNS validation that blocks private-network destinations. Retries use exponential backoff.",
    detail: [
      "robots.txt policy checks before fetch",
      "Per-host throttling and backoff on failure",
      "SSRF and private-network destination blocking",
      "5 MB response cap, HTML content types only",
    ],
  },
  {
    step: "03",
    title: "Extract workflows",
    duration: "Minutes",
    body: "Fetched pages are parsed into text and structured data, and same-origin links are fed back into the queue. From that text Ejentic identifies candidate workflows — the recurring, document-driven processes that keep showing up in a company's own words.",
    detail: [
      "Text and structured-data extraction",
      "Same-origin link discovery and queue growth",
      "Signals tagged: labour, repetition, documents, economic impact",
    ],
  },
  {
    step: "04",
    title: "Score on seven dimensions",
    duration: "Seconds",
    body: "Each workflow is scored 0–10 across the seven dimensions and averaged into an overall score out of 100. Confidence is computed separately, from evidence count and source coverage, so a high score built on one page looks different from one built on six.",
    detail: [
      "Seven dimensions, each scored 0–10",
      "Overall score out of 100",
      "Independent confidence value from evidence and source coverage",
    ],
  },
  {
    step: "05",
    title: "Qualify and deliver",
    duration: "Continuous",
    body: "Companies clearing your thresholds enter the qualified-lead queue — ranked, with every dimension score and its source-linked evidence. Delivery is via the dashboard, CSV, webhooks or the REST API, and sources are re-crawled so stale scores decay rather than linger.",
    detail: [
      "Configurable qualification thresholds",
      "Ranked queue with source-linked evidence",
      "CSV export, webhooks and REST API",
      "Scheduled re-crawl and change alerts",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="A pipeline, not a black box"
        description="Five stages, each inspectable. You can open any score, see the pages behind it, and decide for yourself whether the reasoning holds."
      />

      <Section className="bg-white">
        <Container>
          <div className="flex flex-col gap-6">
            {stages.map((stage, index) => (
              <Reveal key={stage.step} delay={index * 60}>
                <Card className="p-7 sm:p-9">
                  <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
                    <div>
                      <div
                        className="text-[42px] font-bold leading-none text-[var(--border-strong)]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {stage.step}
                      </div>
                      <h2 className="mk-h3 mt-3">{stage.title}</h2>
                      <span className="mk-pill mt-3">{stage.duration}</span>
                    </div>
                    <div>
                      <p className="mk-lead !text-[1rem]">{stage.body}</p>
                      <div className="mt-5 flex flex-col gap-2.5">
                        {stage.detail.map((item) => (
                          <div key={item} className="flex items-start gap-2.5 text-[14px] text-[var(--text-secondary)]">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section dark>
        <div className="mk-grid-lines-dark opacity-70" aria-hidden="true" />
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="The framework"
              title="What each dimension actually measures"
              description="The seven dimensions exist to separate genuinely automatable work from work that merely looks busy."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map((dimension, index) => (
              <Reveal key={dimension.key} delay={index * 50}>
                <Card className="h-full">
                  <div
                    className="mb-4 text-[13px] font-bold tracking-[0.08em] text-[var(--mk-on-dark-muted)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mk-h3 !text-white">{dimension.label}</h3>
                  <p className="mk-body mt-2">{dimension.description}</p>
                </Card>
              </Reveal>
            ))}
            <Reveal delay={350}>
              <Card className="flex h-full flex-col justify-center">
                <h3 className="mk-h3 !text-white">Overall score</h3>
                <p className="mk-body mt-2">
                  The seven dimensions are averaged into a single figure out of 100. Today they are
                  equally weighted — an explicit, inspectable starting point rather than a tuned
                  proprietary model.
                </p>
                <p className="mk-body mt-4 text-[13px]">
                  Published as <span className="text-[#9dbaff]">heuristic-v1</span>.
                </p>
              </Card>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section className="bg-white">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Qualification"
              title="What counts as a qualified lead"
              description="Development thresholds today; configurable thresholds on Enterprise."
            />
          </Reveal>
          <Reveal delay={80}>
            <div className="mx-auto mt-12 grid max-w-[760px] gap-4 sm:grid-cols-2">
              <Card>
                <div className="text-[13px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Overall workflow score
                </div>
                <div
                  className="mt-2 text-[2.6rem] font-bold leading-none text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  75<span className="text-[1.3rem] text-[var(--text-muted)]">/100</span>
                </div>
                <p className="mk-body mt-3">Minimum score for a workflow to generate an opportunity.</p>
              </Card>
              <Card>
                <div className="text-[13px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Evidence confidence
                </div>
                <div
                  className="mt-2 text-[2.6rem] font-bold leading-none text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  65<span className="text-[1.3rem] text-[var(--text-muted)]">%</span>
                </div>
                <p className="mk-body mt-3">
                  Minimum confidence, derived from evidence count and source coverage.
                </p>
              </Card>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mx-auto mt-12 max-w-[760px] rounded-[var(--mk-radius)] border border-[var(--border)] bg-[var(--surface-subtle)] p-7">
              <h3 className="mk-h3">Honest limitations</h3>
              <p className="mk-body mt-2.5">
                The current evaluation model is a transparent heuristic, not a trained model or an LLM
                judgement. It is designed to be understood and argued with, and it will miss nuance a
                human researcher would catch. Coverage depends entirely on what a company publishes
                publicly — a company with thin public documentation will score lower, not because it is
                a worse prospect, but because there is less evidence to work from. Treat output as a
                prioritisation aid, never as a substitute for qualification.
              </p>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-12 text-center">
              <Link href="/platform" className="mk-btn mk-btn-secondary">
                See the platform
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>
            </div>
          </Reveal>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
