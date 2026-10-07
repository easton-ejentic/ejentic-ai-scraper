"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/scraper/page-header";

type Role = "ADMIN" | "OPERATOR" | "RESEARCHER" | "VIEWER";

type Member = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** False for accounts defined by environment variables. */
  managed: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

const ROLES: Role[] = ["ADMIN", "OPERATOR", "RESEARCHER", "VIEWER"];

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Full access, including team management and destructive actions.",
  OPERATOR: "Can create and control campaigns, jobs and research runs.",
  RESEARCHER: "Can research, evaluate and triage findings.",
  VIEWER: "Read-only access to everything.",
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // `active` guards against a response landing after the user navigates away.
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/users");
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error ?? "Could not load the team");
        setMembers(body.users ?? []);
        setError(null);
      } catch (cause: unknown) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load the team");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const createMember = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create the account");
      setMembers((current) => [...current, body.user as Member]);
      setEmail("");
      setName("");
      setPassword("");
      setRole("VIEWER");
      setNotice(`Created ${body.user.email}.`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create the account");
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (id: string, next: Role) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not change the role");
      setMembers((current) =>
        current.map((member) => (member.id === id ? { ...member, role: next } : member)),
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not change the role");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.email}? They will lose access immediately.`)) return;

    setBusyId(member.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/users/${member.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not remove the account");
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice(`Removed ${member.email}.`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not remove the account");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow="SYSTEM"
        title="Team"
        description="Who can sign in, and what each of them can do. Roles: ADMIN > OPERATOR > RESEARCHER > VIEWER."
      />

      {error && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-4 py-3 text-[13px] text-[var(--success)]">
          {notice}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold">Add a member</h2>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Accounts are stored in the database. Environment-defined accounts cannot be edited here.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
              placeholder="name@company.com"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
              placeholder="At least 8 characters"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--primary)]"
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-2 text-[12px] text-[var(--text-muted)]">{ROLE_HELP[role]}</p>

        <div className="mt-4">
          <Button
            disabled={creating || !email || password.length < 8}
            onClick={createMember}
          >
            {creating ? (
              <Loader2 size={15} className="mr-2 animate-spin" />
            ) : (
              <UserPlus size={15} className="mr-2" />
            )}
            Create account
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold">Members</h2>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin" /> Loading team...
          </div>
        ) : members.length === 0 ? (
          <p className="mt-4 text-[14px] text-[var(--text-muted)]">No accounts found.</p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--border)]">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{member.name}</div>
                  <div className="text-[13px] text-[var(--text-muted)]">{member.email}</div>
                  {member.lastLoginAt && (
                    <div className="text-[12px] text-[var(--text-muted)]">
                      Last login {member.lastLoginAt.slice(0, 10)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {member.managed ? (
                    <>
                      <select
                        value={member.role}
                        disabled={busyId === member.id}
                        onChange={(event) => changeRole(member.id, event.target.value as Role)}
                        className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-[13px] outline-none focus:border-[var(--primary)]"
                      >
                        {ROLES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="danger"
                        disabled={busyId === member.id}
                        onClick={() => remove(member)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={14} className="text-[var(--warning)]" />
                      <StatusBadge status="warning" label={`${member.role} · env`} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {members.some((member) => !member.managed) && (
          <p className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-3 text-[12px] text-[var(--text-secondary)]">
            Accounts marked <strong>env</strong> come from environment variables
            (EJENTIC_ADMIN_EMAIL / EJENTIC_USER_EMAIL). They are read-only here: change them in
            your environment and restart, or set DATABASE_URL to manage accounts in the database.
          </p>
        )}
      </Card>
    </div>
  );
}
