import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon from "./icons";
import type { IconName } from "./icons";

/** Shared class strings so form controls stay consistent across pages. */
export const inputClass =
  "w-full rounded-xl border border-ctp-surface1 bg-ctp-mantle px-3.5 py-2.5 text-sm text-ctp-text " +
  "placeholder:text-ctp-overlay0 outline-none transition focus:border-brand " +
  "focus:ring-4 focus:ring-brand/15 pointer-coarse:py-3";

/** inputClass minus `w-full`, for selects that should size to their content (Tailwind can't
 *  reliably let a later `w-auto` beat `w-full`, so the rule must be absent). Keep in sync. */
export const selectClass =
  "rounded-xl border border-ctp-surface1 bg-ctp-mantle px-3.5 py-2.5 text-sm text-ctp-text " +
  "placeholder:text-ctp-overlay0 outline-none transition focus:border-brand " +
  "focus:ring-4 focus:ring-brand/15 pointer-coarse:py-3";

export const cardClass = "rounded-2xl border border-ctp-surface0 bg-ctp-mantle shadow-card";

type Variant = "default" | "primary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  default:
    "border border-ctp-surface1 bg-ctp-mantle text-ctp-text shadow-sm hover:bg-ctp-surface0 " +
    "focus-visible:ring-ctp-overlay0/40",
  primary:
    "border border-transparent bg-brand text-on-brand shadow-sm hover:bg-brand-strong " +
    "focus-visible:ring-brand/40",
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
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 whitespace-nowrap " +
        "text-sm font-semibold transition duration-150 outline-none active:scale-[0.98] " +
        "pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-50 " +
        "disabled:active:scale-100 " +
        `${variants[variant]} ${className}`
      }
    >
      {children}
    </button>
  );
}

/** Title block used at the top of every page, so headings line up everywhere. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold text-ctp-text sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ctp-subtext0">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "brand" | "green" | "pink" | "blue" | "yellow" | "red";

// Literal class strings so Tailwind's scanner sees every one of them.
const tones: Record<Tone, string> = {
  neutral: "bg-ctp-surface0 text-ctp-subtext1",
  brand: "bg-brand/12 text-brand",
  green: "bg-ctp-green/15 text-ctp-green",
  pink: "bg-ctp-pink/15 text-ctp-pink",
  blue: "bg-ctp-blue/15 text-ctp-blue",
  yellow: "bg-ctp-yellow/18 text-ctp-yellow",
  red: "bg-ctp-red/15 text-ctp-red",
};

export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Icon name={icon} className="size-7" />
      </span>
      <h3 className="text-base font-semibold text-ctp-text">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ctp-subtext0">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder block shown while data loads — keeps the layout from jumping. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-ctp-surface0 ${className}`} />;
}
