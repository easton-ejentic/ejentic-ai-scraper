"use client";

import { useEffect, useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  company?: string;
  market?: string;
  interest?: string;
  message: string;
  status: "new" | "read" | "archived";
  createdAt: string;
};

const STATUSES = ["new", "read", "archived"] as const;

function badgeFor(status: Enquiry["status"]) {
  if (status === "new") return { status: "success" as const, label: "New" };
  if (status === "archived") return { status: "neutral" as const, label: "Archived" };
  return { status: "running" as const, label: "Read" };
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // Fixed UTC formatting: server and browser locales differ and would otherwise
  // produce a hydration mismatch.
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // `active` guards against a response landing after the user navigates away.
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/enquiries");
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error ?? "Could not load enquiries");
        setEnquiries(body.enquiries ?? []);
        setError(null);
      } catch (cause: unknown) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load enquiries");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setStatus = async (id: string, status: Enquiry["status"]) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/enquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not update the enquiry");
      setEnquiries((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update the enquiry");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow="SYSTEM"
        title="Enquiries"
        description="Contact form submissions from the public site. Stored in your database — nothing is emailed anywhere yet."
      />

      {error && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center gap-2 p-8 text-[14px] text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" /> Loading enquiries...
        </Card>
      ) : enquiries.length === 0 ? (
        <Card className="p-8 text-center text-[14px] text-[var(--text-muted)]">
          <Inbox size={20} className="mx-auto mb-2 text-[var(--text-muted)]" />
          No enquiries yet. Submissions from the public contact form will appear here.
        </Card>
      ) : (
        <div className="space-y-3">
          {enquiries.map((enquiry) => {
            const badge = badgeFor(enquiry.status);
            return (
              <Card key={enquiry.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{enquiry.name}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {enquiry.email}
                      </a>
                      {enquiry.company ? ` · ${enquiry.company}` : ""}
                      {enquiry.market ? ` · ${enquiry.market}` : ""}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                      {formatWhen(enquiry.createdAt)}
                      {enquiry.interest ? ` · interested in: ${enquiry.interest}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>

                {enquiry.message && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--surface-subtle)] p-3 text-[13px] text-[var(--text-secondary)]">
                    {enquiry.message}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUSES.filter((status) => status !== enquiry.status).map((status) => (
                    <Button
                      key={status}
                      variant="secondary"
                      disabled={busyId === enquiry.id}
                      onClick={() => setStatus(enquiry.id, status)}
                    >
                      Mark {status}
                    </Button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
