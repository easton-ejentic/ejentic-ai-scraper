import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
    secondary:
      "border border-[var(--border-strong)] bg-white text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]",
    ghost:
      "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]",
    danger: "bg-[var(--danger)] text-white hover:bg-red-700",
  };

  return (
    <button
      className={[
        "inline-flex h-10 items-center justify-center rounded-lg px-4",
        "text-[14px] font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
