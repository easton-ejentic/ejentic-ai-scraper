import type { Metadata } from "next";
import {
  Activity,
  Code2,
  Cpu,
  Layers,
  ListChecks,
  Radio,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHero } from "@/components/marketing/page-hero";
import { Card, Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "The Ejentic platform: discovery crawler, workflow extraction, seven-dimension evaluation engine, opportunity layer, qualified leads and API delivery.",
};

const capabilities = [
  {
    icon: Cpu,
    title: "Discovery engine",
    body: "A standalone worker process that queues, fetches and re-fetches sources under your control. Seed it with domains, URL lists or directories and let it expand through same-origin link discovery.",
  },
  {
    icon: Workflow,
    title: "Workflow extraction",
    body: "Pages are parsed into text and structured data, then mined for named workflows — the recurring, document-driven processes a company describes in its own language.",
  },
  {
    icon: Layers,
    title: "Evaluation engine",
    body: "Scores every workflow across the seven dimensions out of ten, averages them into an overall score out of 100, and computes an independent confidence value.",
  },
  {
    icon: Target,
    title: "Opportunity layer",
    body: "Evaluated workflows resolve into company-level opportunities with status tracking, so a promising signal becomes something a team can actually work and close out.",
  },
  {
    icon: ListChecks,
    title: "Qualified leads",
    body: "A ranked queue of companies that clear your thresholds — each carrying dimension scores, overall score, confidence and the evidence behind all of it.",
  },
  {
    icon: Radio,
    title: "Continuous monitoring",
    body: "Sources are re-crawled on a schedule. When a company publishes something that changes its score, you get an alert instead of discovering it next quarter.",
  },
];

const controls = [
  "robots.txt policy checks before every fetch",
  "Per-host throttling with configurable concurrency",
  "Resolved-DNS validation blocking private-network destinations",
  "Manual redirect handling with a hard redirect cap",
  "5 MB response-body limit, HTML content types only",
  "Exponential backoff and retry on transient failure",
  "Pause, resume and cancel any job at any time",
  "Full activity log for every fetch decision",
];

const delivery = [
  {
    icon: Activity,
    title: "Dashboard",
    body: "Control centre, job management, queue inspection, source browsing and activity logs.",
  },
  {
    icon: Code2,
    title: "REST API",
    body: "Create and control jobs, pull opportunities, and sync qualified leads into your own systems.",
  },
  {
    icon: Radio,
    title: "Webhooks",
    body: "Push events when a company is qualified, a score changes materially, or a crawl completes.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="Everything behind the score, open to inspection"
        description="Six components, one pipeline. Each one is inspectable, controllable and boring on purpose — so the interesting part stays the signal."
      />

      <Section className="bg-white">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <Reveal key={capability.title} delay={index * 60}>
                  <Card hover className="h-full">
                    <div
                      className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px]"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <h3 className="mk-h3">{capability.title}</h3>
                    <p className="mk-body mt-2.5">{capability.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </Section>

      <Section dark>
        <div className="mk-grid-lines-dark opacity-70" aria-hidden="true" />
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            <Reveal>
              <SectionTitle
                align="left"
                eyebrow="Governance"
                title="A crawler you can defend to a compliance team"
                description="Discovery only works at scale if it behaves. Every control below is on by default, not an opt-in."
              />
            </Reveal>
            <Reveal delay={80}>
              <div className="grid gap-3 sm:grid-cols-2">
                {controls.map((control) => (
                  <div
                    key={control}
                    className="flex items-start gap-2.5 rounded-[10px] border border-[var(--mk-ink-line)] bg-[rgba(255,255,255,0.03)] p-3.5"
                  >
                    <ShieldCheck
                      size={16}
                      strokeWidth={2}
                      className="mt-[3px] shrink-0 text-[#6f9bff]"
                    />
                    <span className="text-[13.5px] leading-[1.5] text-[var(--mk-on-dark)]">{control}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section className="bg-white">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Delivery"
              title="Get the signal where you already work"
              description="However your team consumes pipeline, the evidence travels with it."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {delivery.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={index * 70}>
                  <Card className="h-full">
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

      <CtaBand
        title="See it running against your market"
        description="Bring a segment you already know well. If the ranking disagrees with your own experience, that conversation is useful for both of us."
      />
    </>
  );
}
