import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

/** Base surface for grouped content. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)] border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  headingLevel = 2,
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  id?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        )}
        <Heading id={id} className="font-display text-xl font-semibold tracking-tight text-ink">
          {title}
        </Heading>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
        {icon && (
          <span aria-hidden="true" className="text-subtle">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 font-display text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
        <span className="min-w-0 break-all">{value}</span>
        {unit && <span className="font-sans text-sm font-normal text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </Card>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-line-strong bg-surface-overlay text-muted",
};

/** Status pill. Always pairs colour with a text label so state is never conveyed by colour alone. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
