import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { authStatus } from "@/lib/auth/users";
import "./login.css";

export const metadata: Metadata = {
  title: "Sign in — Ejentic AI",
  description: "Sign in to the Ejentic AI discovery platform.",
};

export default function LoginPage() {
  const { enabled, backend } = authStatus();

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true" />
          Ejentic AI
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">
          Access the discovery workspace, crawler control center and qualified lead pipeline.
        </p>

        {enabled ? (
          <LoginForm />
        ) : (
          <p className="login-error" role="status">
            No user accounts are configured, so authentication is currently disabled and the
            dashboard is open.
          </p>
        )}

        <p className="login-notice">
          {enabled ? (
            <>
              Accounts are supplied by the <strong>{backend}</strong> backend. Sessions expire
              after 8 hours.
            </>
          ) : (
            <>
              To enable sign-in, set <code>EJENTIC_ADMIN_EMAIL</code> and{" "}
              <code>EJENTIC_ADMIN_PASSWORD</code>, or configure <code>DATABASE_URL</code> and run{" "}
              <code>npm run db:seed</code>. Set <code>SESSION_SECRET</code> in production.
            </>
          )}
        </p>
      </div>
    </main>
  );
}
