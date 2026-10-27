import { clsx } from "clsx";

// Plain (non-client) module so server components such as the landing page can
// style links as buttons; Button.tsx is a client component.

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-surface hover:bg-primary/90 disabled:bg-primary/40 font-semibold",
  secondary:
    "bg-surface-overlay text-ink border border-line hover:border-line-strong hover:bg-surface-overlay/80 disabled:text-subtle",
  outline:
    "border border-line-strong text-ink hover:border-primary hover:text-primary disabled:text-subtle disabled:border-line",
  ghost:
    "text-muted hover:text-ink hover:bg-surface-overlay disabled:text-subtle",
  danger:
    "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 disabled:opacity-50",
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2.5",
};

/** Classes for link-styled buttons (e.g. a Next.js Link that should look like a Button). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(
    "inline-flex items-center justify-center rounded-xl transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  );
}
