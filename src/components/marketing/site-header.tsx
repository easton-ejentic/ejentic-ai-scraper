"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { primaryNav, siteConfig } from "@/lib/marketing/site";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}
const isScrolled = () => window.scrollY > 8;
const notScrolledOnServer = () => false;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Subscribed rather than driven by an effect: an effect would have to call
  // setState in its own body to seed the initial scroll position, which is
  // exactly the cascading-render pattern the React compiler rejects. The
  // server snapshot is always "not scrolled", so hydration matches.
  const scrolled = useSyncExternalStore(subscribeToScroll, isScrolled, notScrolledOnServer);

  // Close the mobile menu on navigation. Done as a render-time state
  // adjustment (React's documented "adjust state when props change" pattern)
  // rather than an effect, which would render one stale frame first.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={["mk-header", scrolled ? "mk-header-scrolled" : ""].filter(Boolean).join(" ")}>
      <div className="mk-container flex h-[68px] items-center justify-between gap-6">
        <Link
          href="/"
          className="text-[19px] font-bold tracking-[-0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)", textDecoration: "none" }}
        >
          EJENTIC<span className="text-[var(--primary)]"> AI</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={["mk-nav-link", isActive(item.href) ? "mk-nav-link-active" : ""].filter(Boolean).join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href={siteConfig.appUrl} className="mk-btn mk-btn-ghost mk-btn-sm">
            Open app
          </Link>
          <Link href={siteConfig.contactUrl} className="mk-btn mk-btn-primary mk-btn-sm">
            Request access
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] md:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-[var(--border)] bg-white md:hidden">
          <div className="mk-container flex flex-col gap-1 py-4">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-2.5 text-[15px]",
                  isActive(item.href)
                    ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                    : "text-[var(--text-secondary)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
            <hr className="mk-hairline my-2" />
            <Link href={siteConfig.appUrl} className="mk-btn mk-btn-secondary justify-center">
              Open app
            </Link>
            <Link href={siteConfig.contactUrl} className="mk-btn mk-btn-primary justify-center">
              Request access
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
