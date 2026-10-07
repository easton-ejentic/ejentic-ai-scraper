import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { Card, Container, Section, SectionTitle } from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Ejentic pricing: Scout for validating the signal, Pro for teams running outbound against live signals, Enterprise for custom weighting and dedicated capacity.",
};

const included = [
  {
    title: "Every plan includes",
    items: [
      "All seven evaluation dimensions",
      "Source-linked evidence on every score",
      "robots-aware, throttled crawling",
      "Dashboard access and CSV export",
    ],
  },
  {
    title: "Pro and above",
    items: [
      "REST API and webhooks",
      "CRM sync",
      "Continuous re-crawl with change alerts",
      "Configurable qualification thresholds",
    ],
  },
  {
    title: "Enterprise only",
    items: [
      "Custom dimensions and weighting",
      "SSO, audit logs and data residency",
      "Dedicated queue infrastructure",
      "Named engineer and uptime SLA",
    ],
  },
];

const pricingFaq = [
  {
    question: "What counts as a scored company?",
    answer:
      "One company record evaluated in a billing period, including all workflows detected for it. Re-crawling an existing company to refresh its score does not consume additional quota — only newly discovered companies do.",
  },
  {
    question: "Do unused credits roll over?",
    answer:
      "No. Quotas reset at the start of each billing period. If your volume is highly variable, Enterprise agreements can be structured around committed capacity instead of monthly quotas.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes, at any time. Upgrades take effect immediately and downgrades apply at the end of the current billing period. Your historical scores and evidence remain accessible either way.",
  },
  {
    question: "Is there a free trial of Pro?",
    answer:
      "Yes. We run a two-week Pro evaluation with a real segment of your choosing, and we will tell you honestly if the signal is not useful for your market.",
  },
  {
    question: "Do you charge for crawl capacity?",
    answer:
      "Crawl capacity is bundled with your plan rather than metered separately. Enterprise customers with very large crawl footprints get dedicated queue infrastructure and capacity planning instead.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Priced on companies scored, not seats"
        description="Your whole team can look at the output. You are paying for discovery, not for logins."
      />

      <Section className="bg-white">
        <Container>
          <Reveal>
            <PricingPlans />
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="What's included"
              title="No feature hostage-taking"
              description="The scoring framework is the product. It is not withheld from the cheaper plans."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {included.map((group, index) => (
              <Reveal key={group.title} delay={index * 70}>
                <Card className="h-full">
                  <h3 className="mk-h3">{group.title}</h3>
                  <div className="mt-5 flex flex-col gap-3">
                    {group.items.map((item) => (
                      <div key={item} className="flex items-start gap-2.5 text-[14px] text-[var(--text-secondary)]">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="bg-white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <SectionTitle
                align="left"
                eyebrow="Pricing FAQ"
                title="The details people ask about"
                description="Anything not covered here, ask and we will answer in writing."
              />
            </Reveal>
            <Reveal delay={80}>
              <Faq items={pricingFaq} />
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
