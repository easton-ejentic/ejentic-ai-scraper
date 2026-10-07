"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

interface Plan {
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  cta: string;
  href: string;
  featured?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    name: "Scout",
    tagline: "Validate the signal on your own market.",
    monthly: 0,
    annual: 0,
    cta: "Start free",
    href: "/contact",
    features: [
      "25 companies scored per month",
      "All seven evaluation dimensions",
      "Evidence snippets with source links",
      "CSV export",
    ],
  },
  {
    name: "Pro",
    tagline: "For teams running outbound against live signals.",
    monthly: 490,
    annual: 390,
    cta: "Request access",
    href: "/contact",
    featured: true,
    features: [
      "1,000 companies scored per month",
      "Qualified lead queue with thresholds",
      "Continuous re-crawl and change alerts",
      "CRM sync, webhooks and REST API",
      "Shared Slack channel with our team",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Custom weighting, private data, dedicated capacity.",
    monthly: null,
    annual: null,
    cta: "Talk to us",
    href: "/contact",
    features: [
      "Unlimited volume and crawl capacity",
      "Custom dimensions and weighting",
      "SSO, audit logs and data residency",
      "Dedicated queue infrastructure",
      "Named engineer and uptime SLA",
    ],
  },
];

export function PricingPlans() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="mk-tier-toggle">
          <button type="button" data-active={!annual} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button type="button" data-active={annual} onClick={() => setAnnual(true)}>
            Annual
          </button>
        </div>
        <span className="text-[13px] text-[var(--text-muted)]">
          Annual billing saves 20%. All prices in USD, excluding tax.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = annual ? plan.annual : plan.monthly;
          return (
            <div
              key={plan.name}
              className={[
                "mk-card flex flex-col p-7",
                plan.featured ? "ring-2 ring-[var(--primary)]" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={plan.featured ? { boxShadow: "var(--mk-shadow-md)" } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="mk-h3">{plan.name}</h3>
                {plan.featured ? <span className="mk-pill">Most popular</span> : null}
              </div>
              <p className="mk-body mt-2 min-h-[46px]">{plan.tagline}</p>

              <div className="mt-6 flex items-end gap-1.5">
                {price === null ? (
                  <span className="mk-price-amount">Custom</span>
                ) : (
                  <>
                    <span className="mk-price-amount">${price}</span>
                    <span className="pb-1 text-[14px] text-[var(--text-muted)]">/ month</span>
                  </>
                )}
              </div>
              {price !== null && annual && price > 0 ? (
                <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
                  Billed annually — ${price * 12} per year
                </p>
              ) : (
                <p className="mt-1.5 text-[12.5px] text-transparent" aria-hidden="true">
                  placeholder
                </p>
              )}

              <Link
                href={plan.href}
                className={[
                  "mk-btn mt-6",
                  plan.featured ? "mk-btn-primary" : "mk-btn-secondary",
                ].join(" ")}
              >
                {plan.cta}
                <ArrowRight size={15} strokeWidth={2.2} />
              </Link>

              <hr className="mk-hairline my-7" />

              <div className="flex flex-col gap-3.5">
                {plan.features.map((feature) => (
                  <div key={feature} className="mk-check">
                    <Check size={16} strokeWidth={2.4} className="mt-[3px] shrink-0 text-[var(--primary)]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
