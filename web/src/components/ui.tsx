import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Shared class strings so form controls stay consistent across pages. */
export const inputClass =
  "w-full rounded-lg border border-ctp-surface1 bg-ctp-mantle px-3 py-2 text-sm text-ctp-text " +
  "placeholder:text-ctp-overlay0 outline-none transition focus:border-ctp-blue " +
  "focus:ring-2 focus:ring-ctp-blue/30";

export const cardClass = "rounded-xl border border-ctp-surface0 bg-ctp-mantle";

type Variant = "default" | "primary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  default:
    "border border-ctp-surface1 bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1 " +
    "focus-visible:ring-ctp-overlay0/40",
  primary:
    "border border-transparent bg-ctp-blue text-ctp-base hover:opacity-90 " +
    "focus-visible:ring-ctp-blue/40",
  danger:
    "border border-ctp-red/30 bg-transparent text-ctp-red hover:bg-ctp-red/10 " +
    "focus-visible:ring-ctp-red/40",
  ghost:
    "border border-transparent bg-transparent text-ctp-subtext0 hover:bg-ctp-surface0 " +
    "hover:text-ctp-text focus-visible:ring-ctp-overlay0/40",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = "default", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 " +
        "text-sm font-medium transition outline-none focus-visible:ring-2 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        `${variants[variant]} ${className}`
      }
    >
      {children}
    </button>
  );
}
