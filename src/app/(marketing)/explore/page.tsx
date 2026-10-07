import type { Metadata } from "next";
import { Globe, Lock, Radar, ShieldCheck } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { PublicExplorer } from "@/components/marketing/public-explorer";
import { Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Search the open web for real businesses by name, niche or location — free, no account needed. See what Ejentic finds before you sign in.",
};

const notes = [
  {
    icon: Radar,
    title: "Live, not a demo dataset",
    body: "Every result comes from a real web search at the moment you ask. Nothing is pre-loaded, seeded or invented.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing is stored about you",
    body: "The public search runs, answers, and forgets. We throttle per connection to keep it fair — that is the only thing we keep, briefly.",
  },
  {
    icon: Lock,
    title: "The deeper work needs an account",
    body: "Crawling a site costs real time and bandwidth. Reading pages, extracting evidence and scoring workflows therefore sit behind the login.",
  },
  {
    icon: Globe,
    title: "Ask the way you think",
    body: "Type a trade, a niche or a city — “emergency plumbers in Manchester”. You never need to paste a URL.",
  },
];

export default function ExplorePage() {
  return (
    <>
      <Section className="pt-16 lg:pt-24">
        <Container>
          <div className="mx-auto max-w-[760px] text-center">
            <span className="mk-eyebrow">FREE · NO ACCOUNT NEEDED</span>
            <h1 className="mk-h1 mt-4">
              Find real businesses on the{" "}
              <span className="mk-gradient-text">open web</span>
            </h1>
            <p className="mk-lead mx-auto mt-5 max-w-[620px]">
              Describe the companies you are curious about. We run a live search and show you
              the actual websites it returns — no sign-up, no URLs to paste.
            </p>
          </div>

          <div className="mt-12">
            <PublicExplorer />
          </div>
        </Container>
      </Section>

      <Section className="mk-section-sm border-t border-[var(--border)] bg-[var(--surface-subtle)]">
        <Container>
          <SectionTitle
            eyebrow="HOW THE FREE SEARCH WORKS"
            title="Honest about what it does"
            description="The public tool is deliberately shallow. Here is exactly where the line is."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {notes.map((note, index) => (
              <Reveal key={note.title} delay={index * 70}>
                <div className="mk-card h-full p-7">
                  <note.icon size={20} className="text-[var(--primary)]" strokeWidth={1.9} />
                  <h3 className="mk-h4 mt-4">{note.title}</h3>
                  <p className="mk-body mt-2">{note.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
