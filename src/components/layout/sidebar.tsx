"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { stripBasePath } from "@/lib/site-config";
import {
  Activity,
  Building2,
  Cpu,
  ExternalLink,
  FolderKanban,
  Gauge,
  GitBranch,
  Inbox,
  LayoutDashboard,
  List,
  ListTodo,
  ScrollText,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";

const sections = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Discovery",
    items: [
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: FolderKanban,
      },
      {
        label: "Companies",
        href: "/companies",
        icon: Building2,
      },
    ],
  },
  {
    label: "Research",
    items: [
      {
        label: "Research",
        href: "/research",
        icon: Search,
      },
      {
        label: "Workflows",
        href: "/workflows",
        icon: GitBranch,
      },
    ],
  },
  {
    label: "Opportunities",
    items: [
      {
        label: "Opportunities",
        href: "/opportunities",
        icon: Target,
      },
      {
        label: "Qualified Leads",
        href: "/qualified-leads",
        icon: Gauge,
      },
    ],
  },
  {
    label: "Scraper",
    items: [
      {
        label: "Control Center",
        href: "/scraper/control-center",
        icon: Cpu,
      },
      {
        label: "Jobs",
        href: "/scraper/jobs",
        icon: ListTodo,
      },
      {
        label: "Queue",
        href: "/scraper/queue",
        icon: List,
      },
      {
        label: "Sources",
        href: "/scraper/sources",
        icon: Activity,
      },
      {
        label: "Logs",
        href: "/scraper/logs",
        icon: ScrollText,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Enquiries",
        href: "/enquiries",
        icon: Inbox,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
      {
        label: "Team",
        href: "/team",
        icon: Users,
      },
    ],
  },
];

export function Sidebar({ mainSiteUrl }: { mainSiteUrl?: string | null }) {
  const rawPathname = usePathname();
  // When mounted under a sub-path (BASE_PATH=/app) we compare against the
  // route-relative path so the active item still highlights correctly.
  const pathname = stripBasePath(rawPathname);

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-[var(--border)] bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <span
            className="text-[20px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            EJENTIC AI
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.label} className="mb-6">
              <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-disabled)]">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex h-10 items-center gap-3 rounded-lg px-3",
                        "text-[14px] transition-colors",
                        active
                          ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {mainSiteUrl && (
          <div className="border-t border-[var(--border)] px-3 py-4">
            <a
              href={mainSiteUrl}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
            >
              <ExternalLink size={17} strokeWidth={1.8} />
              Back to main site
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
