export function Progress({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
      <div
        className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
