import { ArrowUpRight, FileText, Globe, MapPin, ShieldCheck } from "lucide-react";

const scores = [
  { label: "Labour intensity", value: 8.4 },
  { label: "Repetition", value: 9.1 },
  { label: "Information support", value: 8.0 },
  { label: "Scalability", value: 7.6 },
  { label: "Economic consequence", value: 8.8 },
  { label: "AI plausibility", value: 9.3 },
  { label: "Strategic advantage", value: 7.9 },
];

const evidence = [
  {
    source: "Careers — Ops Analyst",
    quote: "Manually reconciles carrier invoices across four spreadsheets each week.",
  },
  {
    source: "Public process doc",
    quote: "Every new client is re-keyed into three internal systems by hand.",
  },
  {
    source: "Compliance PDF",
    quote: "Monthly reporting pack assembled manually — roughly 30 hours per cycle.",
  },
];

const RING_RADIUS = 32;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const OVERALL = 84;

export function LeadPreview() {
  return (
    <div className="mk-card overflow-hidden" style={{ boxShadow: "var(--mk-shadow-lg)" }}>
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3ea]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3ea]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dfe3ea]" />
        </div>
        <span className="ml-1 text-[12.5px] font-medium text-[var(--text-muted)]">
          Qualified leads — Freight &amp; logistics
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          Crawl complete
        </span>
      </div>

      {/* Company header */}
      <div className="flex flex-col gap-5 border-b border-[var(--border)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold text-white"
            style={{ background: "var(--mk-gradient)", fontFamily: "var(--font-display)" }}
          >
            NL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="mk-h3">Northwind Logistics</h3>
              <span className="mk-pill">Qualified</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Globe size={13} strokeWidth={1.9} />
                northwind-logistics.com
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} strokeWidth={1.9} />
                Rotterdam, NL
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText size={13} strokeWidth={1.9} />
                240–480 employees
              </span>
            </div>
          </div>
        </div>

        {/* Overall score */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Overall</div>
            <div className="text-[13px] font-medium text-[var(--text-secondary)]">Confidence 81%</div>
          </div>
          <div className="relative h-[84px] w-[84px]">
            <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="mk-score-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="60%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <circle cx="42" cy="42" r={RING_RADIUS} fill="none" stroke="var(--surface-subtle)" strokeWidth="7" />
              <circle
                cx="42"
                cy="42"
                r={RING_RADIUS}
                fill="none"
                stroke="url(#mk-score-ring)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - OVERALL / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[26px] font-bold leading-none text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {OVERALL}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dimensions + evidence */}
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-disabled)]">
            Seven-dimension score
          </div>
          <div className="flex flex-col gap-3.5">
            {scores.map((score) => (
              <div key={score.label} className="mk-dim-row">
                <span className="mk-dim-label">{score.label}</span>
                <span className="mk-dim-value">{score.value.toFixed(1)}</span>
                <span className="mk-bar">
                  <span className="mk-bar-fill block" style={{ width: `${score.value * 10}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-disabled)]">
            Evidence (3 sources)
          </div>
          <div className="flex flex-col gap-2.5">
            {evidence.map((item) => (
              <div
                key={item.source}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5"
              >
                <div className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.06em] text-[var(--primary)]">
                  {item.source}
                </div>
                <p className="text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">“{item.quote}”</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <ShieldCheck size={15} strokeWidth={1.9} className="text-[var(--success)]" />
          3 workflows detected · robots.txt respected · 41 pages crawled
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--primary)]">
          View full opportunity
          <ArrowUpRight size={15} strokeWidth={2.2} />
        </span>
      </div>
    </div>
  );
}
