"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type State = "idle" | "sending" | "error";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState("error");
        setMessage(data?.error || "Sign-in failed");
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setState("error");
      setMessage("Could not reach the server. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label className="login-label" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        className="login-input"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
      />

      <label className="login-label" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="login-input"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••••"
      />

      {message ? (
        <p className="login-error" role="alert">
          {message}
        </p>
      ) : null}

      <button type="submit" className="login-button" disabled={state === "sending"}>
        {state === "sending" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="login-form" />}>
      <LoginFormInner />
    </Suspense>
  );
}
