"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, HelpCircle, LogOut, Search } from "lucide-react";

type SessionUser = { id: string; email: string; name: string; role: string } | null;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/**
 * Dashboard top bar.
 *
 * `mainSiteUrl` is passed down from the server layout because the parent-site
 * origin is server-side configuration, not a client env var.
 */
export function Topbar({ mainSiteUrl }: { mainSiteUrl?: string | null }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (active) setUser(data.user ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Routed through the router rather than `window.location` so the redirect
  // respects `basePath` - a hard assign to "/login" would escape the mount
  // point entirely when the app is served under ejenticai.com/<prefix>.
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    // Drop any server-rendered payload that was fetched while signed in.
    router.refresh();
  }

  const displayName = user?.name ?? user?.email ?? (loaded ? "Guest" : "Loading…");
  const subtitle = user?.email ?? (loaded ? "Authentication disabled" : "");

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-5 lg:px-7">
      <div className="flex min-w-0 flex-1 items-center">
        <div className="relative w-full max-w-[440px]">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            placeholder="Search anything..."
            className="h-10 w-full rounded-lg bg-[var(--surface-subtle)] pl-10 pr-4 text-[14px] outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
      </div>

      <div className="ml-4 flex items-center gap-2">
        {mainSiteUrl && (
          <a
            href={mainSiteUrl}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] sm:flex"
          >
            Main site <ExternalLink size={13} />
          </a>
        )}

        <button
          aria-label="Help"
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <HelpCircle size={19} />
        </button>

        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
          >
            <LogOut size={15} /> Sign out
          </button>
        )}

        <div
          className="flex items-center gap-2 rounded-lg px-2 py-1.5"
          title={subtitle}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text-primary)] text-[12px] font-medium text-white">
            {initialsFor(displayName)}
          </div>
          <span className="hidden max-w-[160px] truncate text-[14px] font-medium sm:block">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
