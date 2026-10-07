"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Database,
  Layers,
  Search,
  Server,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Settings = {
  user: { email: string; name: string; role: string } | null;
  deployment: {
    productName: string;
    companyName: string;
    supportEmail: string;
    basePath: string;
    mountMode: string;
    mainSiteUrl: string | null;
    embeddingAllowed: boolean;
    nodeEnv: string;
  };
  storage: { backend: string; detail: string; configured: boolean };
  queue: {
    backend: string;
    configured: boolean;
    fallbackReason: string | null;
    workerConcurrency: number;
    pollMs: number;
  };
  auth: {
    enabled: boolean;
    backend: string;
    sessionSecretSet: boolean;
    cookieSameSite: string;
    sessionTtlHours: number;
  };
  search: {
    status: { provider: string | null; label: string; configured: boolean; note: string };
    providers: { id: string; label: string; available: boolean; envVar: string }[];
  };
  crawler: {
    maxPagesPerJobDefault: number;
    requestTimeoutMs: number;
    maxBodyBytes: number;
    robotsRespected: boolean;
    retriesDefault: number;
  };
  counts: {
    jobs: number;
    companies: number;
    workflows: number;
    opportunities: number;
    campaigns: number;
  };
  integrations: { name: string; status: string }[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-3 last:border-0">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-[var(--text-muted)]" />
        <h2 className="text-[15px] font-semibold">{title}</h2>
      </div>
      {description && <p className="mt-1 text-[13px] text-[var(--text-muted)]">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Failed to load settings");
        return body as Settings;
      })
      .then(setSettings)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Failed to load settings"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-5 py-8 lg:px-8">
        <p className="text-[14px] text-[var(--text-muted)]">Loading settings...</p>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="mx-auto max-w-[1100px] px-5 py-8 lg:px-8">
        <Card className="p-8">
          <h2 className="text-[18px] font-semibold">Could not load settings</h2>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{error}</p>
        </Card>
      </div>
    );
  }

  const { deployment, storage, queue, auth, search, crawler, counts, integrations, user } = settings;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow="SYSTEM"
        title="Settings"
        description="How this deployment is wired, which services are live, and exactly which environment variables would improve results."
      />

      {!auth.enabled && (
        <div className="flex items-start gap-3 rounded-[10px] bg-[var(--warning-soft)] p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <div className="text-[13px] text-[var(--warning)]">
            <strong>Authentication is off.</strong> No admin or user credentials are configured,
            so the dashboard is open to anyone who can reach it. Set{" "}
            <code className="rounded bg-white/60 px-1">EJENTIC_ADMIN_EMAIL</code> and{" "}
            <code className="rounded bg-white/60 px-1">EJENTIC_ADMIN_PASSWORD</code> (or a{" "}
            <code className="rounded bg-white/60 px-1">DATABASE_URL</code>) and restart.
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          icon={ShieldCheck}
          title="Account & access"
          description="The signed-in operator. Roles: ADMIN > OPERATOR > RESEARCHER > VIEWER."
        >
          {user ? (
            <>
              <Row label="Signed in as" value={user.name} />
              <Row label="Username" value={user.email} />
              <Row label="Role" value={<StatusBadge status="success" label={user.role} />} />
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">
              No session — authentication is currently disabled for this deployment.
            </p>
          )}
          <div className="mt-2">
            <Row label="Auth backend" value={auth.backend} />
            <Row
              label="SESSION_SECRET"
              value={
                auth.sessionSecretSet ? (
                  <span className="inline-flex items-center gap-1 text-[var(--success)]">
                    <CheckCircle2 size={13} /> set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[var(--warning)]">
                    <XCircle size={13} /> using dev fallback
                  </span>
                )
              }
            />
            <Row label="Cookie policy" value={`SameSite=${auth.cookieSameSite}, HttpOnly`} />
            <Row label="Session lifetime" value={`${auth.sessionTtlHours} hours`} />
          </div>
        </Section>

        <Section
          icon={Server}
          title="Deployment"
          description="How this app is mounted — standalone, or as a section of the main site."
        >
          <Row label="Product" value={deployment.productName} />
          <Row label="Mount mode" value={deployment.mountMode} />
          <Row label="Base path" value={deployment.basePath} />
          <Row label="Main site" value={deployment.mainSiteUrl ?? "not configured"} />
          <Row
            label="Framing allowed"
            value={
              deployment.embeddingAllowed ? (
                <span className="inline-flex items-center gap-1 text-[var(--success)]">
                  <CheckCircle2 size={13} /> yes (frame-ancestors allow-list)
                </span>
              ) : (
                <span className="text-[var(--text-secondary)]">no (X-Frame-Options: DENY)</span>
              )
            }
          />
          <Row label="Environment" value={deployment.nodeEnv} />
          <Row label="Support" value={deployment.supportEmail} />
        </Section>

        <Section
          icon={Database}
          title="Storage & queue"
          description="Where crawl results are written and how crawl work is distributed."
        >
          <Row
            label="Database"
            value={
              <span
                className={
                  storage.configured ? "text-[var(--success)]" : "text-[var(--warning)]"
                }
              >
                {storage.backend}
              </span>
            }
          />
          <Row label="Detail" value={storage.detail} />
          <Row
            label="Queue"
            value={queue.configured ? queue.backend : `${queue.backend} (fallback)`}
          />
          {queue.fallbackReason && <Row label="Fallback reason" value={queue.fallbackReason} />}
          <Row label="Worker concurrency" value={queue.workerConcurrency} />
          <Row label="Queue poll interval" value={`${queue.pollMs} ms`} />
          <Row
            label="Stored rows"
            value={`${counts.campaigns} campaigns · ${counts.jobs} jobs · ${counts.companies} companies · ${counts.workflows} workflows · ${counts.opportunities} opportunities`}
          />
        </Section>

        <Section
          icon={Search}
          title="Search providers"
          description="Discovery runs on live web search. Keyed APIs are far more reliable than scraped endpoints."
        >
          <div className="mb-3 rounded-lg bg-[var(--surface-subtle)] p-3 text-[13px]">
            <strong className="font-medium">In use:</strong>{" "}
            {search.status.configured ? search.status.label : "none"}
            {search.status.note && (
              <span className="mt-1 block text-[var(--text-secondary)]">{search.status.note}</span>
            )}
          </div>
          <div className="space-y-2">
            {search.providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{provider.label}</div>
                  <div className="truncate text-[12px] text-[var(--text-muted)]">
                    {provider.envVar}
                  </div>
                </div>
                {provider.available ? (
                  <StatusBadge status="success" label="available" />
                ) : (
                  <StatusBadge status="neutral" label="not configured" />
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section
          icon={Layers}
          title="Crawler defaults"
          description="Safety limits applied to every crawl. These are deliberate and not user-editable in the UI."
        >
          <Row label="Default page limit" value={`${crawler.maxPagesPerJobDefault} URLs`} />
          <Row label="Request timeout" value={`${crawler.requestTimeoutMs / 1000}s`} />
          <Row label="Max response body" value={`${crawler.maxBodyBytes / (1024 * 1024)} MB`} />
          <Row label="Default retries" value={crawler.retriesDefault} />
          <Row
            label="robots.txt respected"
            value={crawler.robotsRespected ? "yes" : "no"}
          />
          <Row label="SSRF protection" value="private IPs and loopback blocked" />
        </Section>

        <Section
          icon={CircleSlash}
          title="Integrations"
          description="Listed honestly: these are not built. Nothing here pretends to sync."
        >
          <div className="space-y-2">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="text-[13px]">{integration.name}</span>
                <StatusBadge status="neutral" label={integration.status} />
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <User size={16} className="text-[var(--text-muted)]" />
          <h2 className="text-[15px] font-semibold">Changing these values</h2>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Configuration lives in environment variables, not in the database, so it cannot be
          edited from this screen — that would let a compromised session reconfigure the
          deployment. Edit <code className="rounded bg-[var(--surface-subtle)] px-1">.env.local</code>{" "}
          and restart the app. The values above are read live, so this page is the fastest way
          to confirm a change took effect.
        </p>
      </Card>
    </div>
  );
}
