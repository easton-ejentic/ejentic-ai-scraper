import { siteConfig } from "@/lib/site-config";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Dashboard chrome.
 *
 * `siteConfig()` is read on the server so the parent-site origin and mount mode
 * reach the client without exposing server-only settings.
 */
export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mainSiteUrl } = siteConfig();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar mainSiteUrl={mainSiteUrl} />
      <div className="min-w-0 flex-1">
        <Topbar mainSiteUrl={mainSiteUrl} />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
}
