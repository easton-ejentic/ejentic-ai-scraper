"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2, Lock, Search, Sparkles } from "lucide-react";

type Result = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  kind: string;
};

const EXAMPLES = [
  "emergency plumbers in Manchester",
  "independent dental practices in Bristol",
  "commercial solicitors in Birmingham",
  "accountants in Leeds",
];

/**
 * Public, login-free search preview.
 *
 * Deliberately shallow: it runs one live web search and shows real websites.
 * Crawling, evidence and scoring stay behind the login because they cost real
 * crawl budget — the copy below says so rather than implying otherwise.
 */
export function PublicExplorer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(searchTerm: string) {
    const term = searchTerm.trim();
    if (term.length < 3) {
      setError("Describe what you are looking for in at least 3 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await fetch(`/api/public/explore?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The search could not be completed.");
        return;
      }
      setResults(data.results ?? []);
      setProvider(data.provider ?? null);
    } catch {
      setError("The search service is unreachable right now. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(query);
        }}
        className="mx-auto flex w-full max-w-[680px] flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. emergency plumbers in Manchester"
            aria-label="Describe the businesses you are looking for"
            className="h-14 w-full rounded-xl border border-[var(--border)] bg-white pl-12 pr-4 text-[15px] outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mk-btn mk-btn-primary h-14 px-7 text-[15px] disabled:opacity-60"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          Search the web
        </button>
      </form>

      <div className="mx-auto mt-4 flex max-w-[680px] flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => {
              setQuery(example);
              void run(example);
            }}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-[860px]">
        {loading && (
          <div className="mk-card p-8 text-center text-[14px] text-[var(--text-muted)]">
            Searching the open web for real businesses…
          </div>
        )}

        {!loading && error && (
          <div className="mk-card border-[var(--warning)] p-6">
            <p className="text-[15px] font-medium">We could not complete that search</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{error}</p>
          </div>
        )}

        {!loading && results && results.length === 0 && !error && (
          <div className="mk-card p-8 text-center">
            <p className="text-[15px] font-medium">Nothing found for that description</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              We only ever show websites a search engine actually returned — we never fill
              the gap with sample data. Try a more specific trade, niche or city.
            </p>
          </div>
        )}

        {!loading && results && results.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between text-[13px] text-[var(--text-muted)]">
              <span>
                {results.length} real website{results.length === 1 ? "" : "s"} found
                {provider ? ` · via ${provider}` : ""}
              </span>
              <span>Live web search</span>
            </div>

            <div className="space-y-3">
              {results.map((result) => (
                <a
                  key={result.url}
                  href={result.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mk-card mk-card-hover block p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold text-[var(--text-primary)]">
                        {result.title || result.domain}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[var(--primary)]">
                        {result.domain}
                        <ExternalLink size={12} />
                      </div>
                    </div>
                    <span className="mk-pill shrink-0">{result.kind}</span>
                  </div>
                  {result.snippet && (
                    <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                      {result.snippet}
                    </p>
                  )}
                </a>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-7 text-center">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <Lock size={15} className="text-[var(--text-muted)]" />
                Want the full picture?
              </div>
              <p className="max-w-[520px] text-[14px] text-[var(--text-secondary)]">
                The free search finds the websites. The platform then reads them, pulls the
                evidence, identifies the manual workflows and scores each company across seven
                dimensions. That part needs an account.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/login" className="mk-btn mk-btn-primary">
                  Open the app <ArrowRight size={16} strokeWidth={2.2} />
                </Link>
                <Link href="/contact" className="mk-btn mk-btn-secondary">
                  Request access
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
