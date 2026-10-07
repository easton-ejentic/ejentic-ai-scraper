import { Check } from "lucide-react";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /** Renders the dark navy surface used for contrast bands. */
  dark?: boolean;
  size?: "default" | "sm";
  id?: string;
}

export function Section({ children, className = "", dark = false, size = "default", id }: SectionProps) {
  return (
    <section
      id={id}
      className={[
        size === "sm" ? "mk-section-sm" : "mk-section",
        dark ? "mk-dark" : "",
        "relative overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={["mk-container relative", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mk-eyebrow">{children}</p>;
}

interface SectionTitleProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
  className = "",
}: SectionTitleProps) {
  return (
    <div
      className={[
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-[720px] text-center items-center" : "max-w-[680px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mk-h2">{title}</h2>
      {description ? <p className="mk-lead">{description}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={["mk-card p-6", hover ? "mk-card-hover" : "", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-check">
      <Check size={17} strokeWidth={2.4} className="mt-[3px] shrink-0 text-[var(--primary)]" />
      <span>{children}</span>
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="mk-pill">{children}</span>;
}
