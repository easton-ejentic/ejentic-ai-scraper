import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/lib/marketing/site";

interface CtaBandProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export function CtaBand({
  title = "Stop guessing which accounts are ready for AI.",
  description = "Point Ejentic at a market and get back companies ranked by how much value an agent would actually create — with the evidence attached to every score.",
}: CtaBandProps) {
  return (
    <section className="mk-dark mk-section relative overflow-hidden">
      <div className="mk-grid-lines-dark opacity-70" aria-hidden="true" />
      <div
        className="mk-glow"
        aria-hidden="true"
        style={{
          width: 520,
          height: 520,
          left: "50%",
          top: "-45%",
          transform: "translateX(-50%)",
          background: "rgba(37, 99, 235, 0.35)",
        }}
      />
      <div className="mk-container relative text-center">
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-6">
          <h2 className="mk-h2">{title}</h2>
          <p className="mk-lead">{description}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link href={siteConfig.contactUrl} className="mk-btn mk-btn-light">
              Request access
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
            <Link href="/platform" className="mk-btn mk-btn-outline-light">
              Explore the platform
            </Link>
          </div>
          <p className="mt-1 text-[13px] text-[var(--mk-on-dark-muted)]">
            No credit card. Scoring methodology is documented and open to inspection.
          </p>
        </div>
      </div>
    </section>
  );
}
