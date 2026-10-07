import Link from "next/link";
import { footerNav, siteConfig } from "@/lib/marketing/site";

export function SiteFooter() {
  return (
    <footer className="mk-dark relative overflow-hidden">
      <div className="mk-grid-lines-dark opacity-60" aria-hidden="true" />
      <div className="mk-container relative py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <div
              className="text-[19px] font-bold tracking-[-0.02em] text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              EJENTIC<span className="text-[#6f9bff]"> AI</span>
            </div>
            <p className="mk-body mt-4 max-w-[320px]">
              Opportunity intelligence for teams selling and deploying AI agents. Evidence first,
              scored on seven dimensions, delivered as qualified leads.
            </p>
            <a
              href={`mailto:${siteConfig.email}`}
              className="mt-5 inline-block text-[14.5px] text-[#9dbaff] hover:text-white"
              style={{ textDecoration: "none" }}
            >
              {siteConfig.email}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerNav.map((group) => (
              <div key={group.title}>
                <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mk-on-dark-muted)]">
                  {group.title}
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-[14.5px] text-[var(--mk-on-dark)] hover:text-white"
                      style={{ textDecoration: "none" }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr className="mk-hairline my-10" />

        <div className="flex flex-col gap-3 text-[13.5px] text-[var(--mk-on-dark-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Ejentic AI. All rights reserved.</span>
          <span>Scoring methodology: heuristic-v1 — indicative, not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}
