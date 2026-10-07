import type { Metadata } from "next";
import { Compass, Eye, Scale, Wrench } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHero } from "@/components/marketing/page-hero";
import { Card, Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Ejentic exists: a belief that AI automation should start from evidence of real work, and that scoring methodology should be open to inspection.",
};

const principles = [
  {
    icon: Eye,
    title: "Evidence before inference",
    body: "If we cannot point to the page that produced a score, we do not publish the score. Models that cannot show their work are not useful to someone who has to defend a decision in front of a client.",
  },
  {
    icon: Scale,
    title: "Publish the methodology",
    body: "Our scoring model is labelled heuristic-v1, not a proprietary black box. Equal weighting is a starting position we expect to be challenged — and we would rather you challenge it than trust it.",
  },
  {
    icon: Compass,
    title: "Prioritisation, not prophecy",
    body: "Ejentic tells you where to look first. It does not tell you a deal will close, and it should never replace a researcher's judgement — only make that judgement cheaper to apply at scale.",
  },
  {
    icon: Wrench,
    title: "Boring infrastructure",
    body: "Throttling, robots.txt, retries and logs are unglamorous and non-negotiable. Discovery that cannot be run responsibly is not worth running.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="We think AI sales starts with evidence, not a list"
        description="Ejentic was built by people who got tired of finding the real automation opportunity three weeks into a project, when it was too late to price it."
      />

      <Section className="bg-white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <Reveal>
              <h2 className="mk-h2">The problem we kept hitting</h2>
            </Reveal>
            <Reveal delay={80}>
              <div className="flex flex-col gap-5">
                <p className="mk-lead !text-[1rem]">
                  Every automation project we worked on followed the same arc. The pitch was based on
                  industry and headcount. The real opportunity — the specific, repetitive, expensive
                  process that made automation obviously worth it — only surfaced once we were already
                  inside the business.
                </p>
                <p className="mk-body">
                  By then it was too late. The scope was signed, the price was fixed, and the thing that
                  would actually have sold the work was sitting in a public process document nobody had
                  read.
                </p>
                <p className="mk-body">
                  That document was always public. Careers pages describe manual reconciliation. Process
                  documentation describes re-keying. Compliance PDFs describe monthly reporting assembled
                  by hand. The evidence of automatable work is published constantly — it is just spread
                  across thousands of pages nobody has time to read.
                </p>
                <p className="mk-body">
                  Ejentic reads them, scores what it finds, and shows you the reasoning.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Principles"
              title="How we build, and what we will not do"
              description="Four commitments that shape product decisions more than any roadmap."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {principles.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <Reveal key={principle.title} delay={index * 70}>
                  <Card hover className="h-full">
                    <div
                      className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px]"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <h3 className="mk-h3">{principle.title}</h3>
                    <p className="mk-body mt-2.5">{principle.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        title="We would rather be argued with than trusted"
        description="If you disagree with how we weight something, tell us. That feedback is the roadmap."
      />
    </>
  );
}
