import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { Container, Section } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Ejentic AI handles data: what we collect, why, and what we deliberately do not do.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy"
        description="What we collect, why we collect it, and the things we deliberately do not do."
      />

      <Section className="bg-white">
        <Container>
          <div className="mk-prose mx-auto max-w-[760px]">
            <p className="text-[13px] text-[var(--text-muted)]">
              Last updated 5 September 2026. This is a template document and is not legal advice.
            </p>

            <h2>What we collect</h2>
            <p>
              Ejentic collects publicly available business information from websites: company names,
              domains, addresses, process and careers documentation, and other material a company has
              published on the open web. We also collect the details you give us directly when you
              contact us or use the platform.
            </p>

            <h2>What we deliberately do not do</h2>
            <ul>
              <li>We do not buy or enrich personal contact data.</li>
              <li>We do not attempt to bypass logins, paywalls or authentication.</li>
              <li>We do not crawl private-network or non-public destinations.</li>
              <li>We do not sell the data we collect.</li>
            </ul>

            <h2>How crawling is governed</h2>
            <p>
              Our crawler honours robots.txt, throttles requests per host, validates resolved DNS
              addresses to block private destinations, caps response size, and records every fetch
              decision in an activity log. Site owners can request exclusion at any time.
            </p>

            <h2>Your data</h2>
            <p>
              Information you submit through our contact form is used solely to respond to your
              enquiry. We do not add it to a mailing list, resell it, or enrich it against third-party
              sources. You can ask us to delete it at any time by emailing hello@ejentic.ai.
            </p>

            <h2>Retention</h2>
            <p>
              Collected business information is retained while it remains useful for scoring and
              re-crawl comparison. You may request deletion of your company&apos;s record, and we will
              remove it and stop re-crawling the associated sources.
            </p>

            <h2>Contact</h2>
            <p>
              Questions, deletion requests and exclusion requests:{" "}
              <a href="mailto:hello@ejentic.ai" className="text-[var(--primary)]">
                hello@ejentic.ai
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
