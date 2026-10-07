"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const interests = ["Pro evaluation", "Enterprise", "Partnership", "Something else"];

export function ContactForm() {
  const [interest, setInterest] = useState(interests[0]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          company: data.get("company"),
          market: data.get("market"),
          message: data.get("message"),
          interest,
        }),
      });

      if (!response.ok) throw new Error("Request failed");
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
      setError("Something went wrong sending that. Email hello@ejentic.ai and we will pick it up.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mk-card flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 size={34} strokeWidth={1.8} className="text-[var(--success)]" />
        <h3 className="mk-h3">Thanks — that landed.</h3>
        <p className="mk-body max-w-[420px]">
          We read every request personally and usually reply within one working day. If it is urgent,
          email hello@ejentic.ai directly.
        </p>
        <button type="button" className="mk-btn mk-btn-secondary mt-2" onClick={() => setStatus("idle")}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mk-card flex flex-col gap-5 p-7 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mk-field" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" required className="mk-input" placeholder="Jordan Vance" />
        </div>
        <div>
          <label className="mk-field" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mk-input"
            placeholder="jordan@company.com"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mk-field" htmlFor="company">
            Company
          </label>
          <input id="company" name="company" className="mk-input" placeholder="Northwind" />
        </div>
        <div>
          <label className="mk-field" htmlFor="market">
            Market you want scanned
          </label>
          <input
            id="market"
            name="market"
            className="mk-input"
            placeholder="Freight brokerage, DACH"
          />
        </div>
      </div>

      <div>
        <span className="mk-field">What are you after?</span>
        <div className="flex flex-wrap gap-2">
          {interests.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterest(option)}
              className="mk-pill"
              style={
                interest === option
                  ? undefined
                  : {
                      background: "#fff",
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-strong)",
                    }
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mk-field" htmlFor="message">
          Anything we should know?
        </label>
        <textarea
          id="message"
          name="message"
          className="mk-input"
          placeholder="We sell workflow automation to mid-market logistics firms and want to see whether the signal holds up."
        />
      </div>

      {status === "error" && error ? (
        <p className="text-[14px] text-[var(--danger)]">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mk-btn mk-btn-primary self-start disabled:opacity-60"
      >
        {status === "sending" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending
          </>
        ) : (
          "Request access"
        )}
      </button>

      <p className="text-[12.5px] leading-[1.6] text-[var(--text-muted)]">
        We use this only to respond to your enquiry. No newsletter, no reselling, no enrichment of your
        details.
      </p>
    </form>
  );
}
