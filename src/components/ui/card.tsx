interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={[
        "rounded-[10px] border border-[var(--border)] bg-white",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
