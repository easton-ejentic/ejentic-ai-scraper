import type { Metadata } from "next";
import "./marketing.css";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Ejentic AI — Find the companies where AI actually pays off",
    template: "%s — Ejentic AI",
  },
  description:
    "Ejentic scans the open web for evidence of manual, repetitive knowledge work, scores every company on seven dimensions, and delivers qualified, evidence-backed leads.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Reveal animations start hidden; keep content visible without JS. */}
      <noscript>
        <style>{`.mk-reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
