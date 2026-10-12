// Suite kit v7: copied from OnePortal src/components/ui/primitives.tsx. Change it in the hub first, then copy it here.
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";

/*
 * Small presentational building blocks shared by every page. Server-safe (no client state).
 */

/*
 * Responsive rules shared by every control (docs/ARCHITECTURE.md §0.9):
 * - text is 16px below the `sm` breakpoint — iOS Safari zooms into any smaller input;
 * - controls are 40px tall on phones (touch) and 36px from `sm` up.
 */
export const controlHeight = "h-10 sm:h-9";

export const inputClasses = cx(
  "block w-full min-w-0 rounded-field border border-line-strong bg-surface px-3 text-base text-ink shadow-xs sm:text-sm",
  "placeholder:text-faint transition-colors",
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10",
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15",
);

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A bordered white panel. Settings-style: header, body, optional footer with the actions. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-card border border-line bg-surface shadow-sm shadow-ink/5", className)}>{children}</section>;
}

export function CardHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-4 py-5 sm:px-6", className)}>{children}</div>;
}

export function CardFooter({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-card border-t border-line-soft bg-canvas/60 px-4 py-3 sm:px-6">
      <div className="min-w-0 text-[0.8125rem] text-muted">{hint}</div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * The coloured layer behind a hero panel: the theme's primary colour, a faint grid and two soft
 * glows. Put it first inside a `relative isolate overflow-hidden bg-primary text-on-primary` box.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-linear-to-br from-primary via-primary to-primary-hover" />
      <div className="pattern-grid absolute inset-0 text-on-primary" />
      <div className="absolute -top-24 -right-20 size-80 rounded-full bg-accent/35 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-on-primary/10 blur-3xl" />
    </div>
  );
}

/**
 * The welcome panel at the top of a home page: who is here, and the two or three numbers that
 * matter to them (`aside`, usually <HeroStat>s). One per page; other pages use <PageHeader>.
 */
export function Hero({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-card bg-primary px-5 py-6 text-on-primary shadow-lg shadow-primary/15 sm:px-8 sm:py-8">
      <HeroBackdrop />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="max-w-2xl min-w-0">
          {eyebrow && <p className="text-xs font-medium tracking-wider text-on-primary/75 uppercase">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-sm text-on-primary/80 sm:text-base">{description}</p>}
        </div>
        {aside && <div className="flex flex-wrap gap-3">{aside}</div>}
      </div>
    </section>
  );
}

/** A number on a <Hero>. */
export function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-24 rounded-lg bg-on-primary/10 px-4 py-3 ring-1 ring-on-primary/15 ring-inset">
      <p className="text-2xl leading-tight font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-on-primary/75">{label}</p>
    </div>
  );
}

/** A heading above a group of cards or tiles on a page, with an optional action on the right. */
export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * One number that matters, with what it is, an icon, and optionally how it moved
 * (`change`, in percent against `changeLabel`) and its shape over time (`children`, a <Sparkline>).
 * `goodWhen` says which direction is good news; without it the change is shown without colour.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  change,
  changeLabel,
  goodWhen,
  children,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  change?: number | null;
  changeLabel?: string;
  goodWhen?: "up" | "down";
  children?: ReactNode;
}) {
  const direction = change == null || change === 0 ? null : change > 0 ? "up" : "down";
  const tone: Tone = !direction || !goodWhen ? "neutral" : direction === goodWhen ? "success" : "danger";
  return (
    <div className="flex min-w-0 flex-col rounded-card border border-line bg-surface p-4 shadow-sm shadow-ink/5 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-muted">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-[1.125rem]" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {(change != null || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {change != null && (
            <Badge tone={tone}>
              {direction === "up" && <ArrowUpRight className="mr-0.5 size-3" aria-hidden />}
              {direction === "down" && <ArrowDownRight className="mr-0.5 size-3" aria-hidden />}
              {change > 0 ? "+" : ""}
              {change}%
            </Badge>
          )}
          {change != null && changeLabel && <span>{changeLabel}</span>}
          {hint && <span className="min-w-0 wrap-anywhere">{hint}</span>}
        </div>
      )}
      {children && <div className="mt-auto pt-4">{children}</div>}
    </div>
  );
}

/**
 * An on/off switch that is a link: the choice lives in the address bar (`href` is the address
 * of the other state), so the server renders the page for it and it can be bookmarked.
 */
export function SwitchLink({ href, checked, children }: { href: string; checked: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      role="switch"
      aria-checked={checked}
      scroll={false}
      className="group inline-flex min-h-10 items-center gap-2.5 rounded-full text-sm font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-2 sm:min-h-0"
    >
      <span className={cx("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-line-strong")}>
        <span className={cx("size-4 rounded-full bg-surface shadow-xs transition-transform", checked && "translate-x-4")} />
      </span>
      {children}
    </Link>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-soft ring-line",
  success: "bg-success-soft text-success ring-success-line",
  warning: "bg-warning-soft text-warning ring-warning-line",
  danger: "bg-danger-soft text-danger ring-danger-line",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const ALERT_STYLES: Record<"info" | "success" | "warning" | "error", { box: string; Icon: LucideIcon }> = {
  info: { box: "border-line bg-surface text-ink-soft", Icon: Info },
  success: { box: "border-success-line bg-success-soft text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning-line bg-warning-soft text-warning", Icon: TriangleAlert },
  error: { box: "border-danger-line bg-danger-soft text-danger", Icon: AlertCircle },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof ALERT_STYLES;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = ALERT_STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 wrap-anywhere">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="flex size-11 items-center justify-center rounded-full bg-subtle text-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Label/value rows, e.g. on a detail page. */
export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-soft">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-1 gap-1 py-2.5 text-sm sm:grid-cols-3 sm:gap-4">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 wrap-anywhere text-ink sm:col-span-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Initials in a circle — the avatar used throughout. On the top bar use tone="mark": a theme's
 * top bar may be the same colour as its primary.
 */
export function Avatar({ name, size = "md", tone = "primary" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "primary" | "mark" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "size-7 text-[0.6875rem]", md: "size-8 text-xs", lg: "size-11 text-sm" };
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        tone === "mark" ? "bg-mark text-on-mark" : "bg-primary text-on-primary",
        sizes[size],
      )}
    >
      {initials || "?"}
    </span>
  );
}
