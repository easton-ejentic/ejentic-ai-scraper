import type { Metadata } from "next";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/page-hero";
import { Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";
import { Faq } from "@/components/marketing/faq";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Request access to Ejentic, ask about the scoring methodology, or bring us a market you already know well.",
};

const channels = [
  {
    icon: Mail,
    title: "Email us",
    body: "hello@ejentic.ai — we read everything that arrives here.",
  },
  {
    icon: Clock,
    title: "Response time",
    body: "Usually within one working day, often the same afternoon.",
  },
  {
    icon: MessageSquare,
    title: "Technical questions",
    body: "Ask about the crawler, the dimensions or the weighting. We will answer properly, not with a brochure.",
  },
];

const faqItems = [
  {
    question: "What happens after I request access?",
    answer:
      "We get back to you within a working day, ask which market you want to scan, and run it. You see real output against companies you already know before any commercial conversation.",
  },
  {
    question: "Do I need to know my market in advance?",
    answer:
      "It helps. The most useful first run is always against a segment where you can judge our ranking against your own experience — it is the fastest way to find out whether the signal is real for you.",
  },
  {
    question: "Can you scan a market we have not discussed?",
    answer: "Yes, but tell us the scope first so we can check crawl feasibility and coverage.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Bring us a market you already know"
        description="The most useful first conversation is you telling us our ranking is wrong — and why."
      />

      <Section className="bg-white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr]">
            <Reveal>
              <ContactForm />
            </Reveal>
            <Reveal delay={80}>
              <div className="flex flex-col gap-4">
                {channels.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <div key={channel.title} className="mk-card p-6">
                      <div
                        className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px]"
                        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                      >
                        <Icon size={19} strokeWidth={1.9} />
                      </div>
                      <h3 className="mk-h4">{channel.title}</h3>
                      <p className="mk-body mt-1.5 text-[14.5px]">{channel.body}</p>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <SectionTitle
                align="left"
                eyebrow="Good to know"
                title="Before you write"
                description="A few things that make the first exchange more useful."
              />
            </Reveal>
            <Reveal delay={80}>
              <Faq items={faqItems} />
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
