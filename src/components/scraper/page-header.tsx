interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow = "SCRAPER",
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-[32px] font-bold tracking-[-0.025em] lg:text-[40px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[620px] text-[15px] text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
