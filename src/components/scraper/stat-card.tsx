import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  description: string;
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-2 text-[30px] font-bold tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] text-[var(--text-muted)]">
        {description}
      </div>
    </Card>
  );
}
