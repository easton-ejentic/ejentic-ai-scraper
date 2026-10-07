export interface NavLink {
  label: string;
  href: string;
}

export const primaryNav: NavLink[] = [
  { label: "Explore", href: "/explore" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

export const siteConfig = {
  name: "Ejentic AI",
  appUrl: "/dashboard",
  contactUrl: "/contact",
  email: "hello@ejentic.ai",
};

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Explore", href: "/explore" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Platform", href: "/platform" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

/**
 * The seven evaluation dimensions. These mirror the Ejentic evaluation
 * framework used by src/lib/research/evaluation.ts — keep the two in sync.
 */
export const dimensions: { key: string; label: string; description: string }[] = [
  {
    key: "labor",
    label: "Labour intensity",
    description: "How many person-hours the workflow absorbs before it produces anything.",
  },
  {
    key: "repetition",
    label: "Repetition",
    description: "How often the same sequence of steps recurs, unchanged, week to week.",
  },
  {
    key: "informationSupport",
    label: "Information support",
    description: "Whether the work is driven by documents, lookups and structured data.",
  },
  {
    key: "scalability",
    label: "Scalability",
    description: "What it costs to run the same workflow at ten times the volume.",
  },
  {
    key: "economicConsequence",
    label: "Economic consequence",
    description: "The value at stake when the workflow is slow, stale or wrong.",
  },
  {
    key: "aiPlausibility",
    label: "AI plausibility",
    description: "Whether agents can genuinely perform the work with today's tooling.",
  },
  {
    key: "strategicAdvantage",
    label: "Strategic advantage",
    description: "How much durable edge automation of this workflow actually confers.",
  },
];
