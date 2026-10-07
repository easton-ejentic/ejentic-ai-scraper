type Status = "running" | "success" | "warning" | "error" | "neutral";

export function StatusBadge({
  status,
  label,
}: {
  status: Status;
  label: string;
}) {
  const styles = {
    running: "bg-[var(--primary-soft)] text-[#1d4ed8]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    error: "bg-[var(--danger-soft)] text-[var(--danger)]",
    neutral: "bg-[var(--neutral-soft)] text-[var(--neutral)]",
  };

  return (
    <span
      className={[
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2",
        "text-[11px] font-medium uppercase tracking-[0.02em]",
        styles[status],
      ].join(" ")}
    >
      <span className="text-[8px]">●</span>
      {label}
    </span>
  );
}
