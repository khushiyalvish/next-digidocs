// Suite kit v7: copied from OnePortal src/components/ui/charts.tsx. Change it in the hub first, then copy it here.
"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { axisTicks, axisTop, compactNumber, formatDay, formatNumber, tickIndexes } from "@/components/ui/chart-math";
import { cx } from "@/components/ui/cx";

/*
 * The suite's charts. Hand-drawn (HTML + a little SVG), no chart library: they take their
 * colours from the theme like everything else, and they stretch to any width.
 *
 * Rules they follow, so every chart in the suite reads the same way:
 * - A series gets a colour by its position (chart1, chart2, chart3), never by its value. Red, amber
 *   and green keep their meaning: use color="danger" only for a series that *is* a problem count.
 * - One value axis, starting at zero. Two measures of different size are two charts.
 * - Values are never shown by colour or hover alone: two or more series get a legend, every chart
 *   carries a table for screen readers, and the hover read-out also works with the arrow keys.
 */

export type SeriesColor = "chart1" | "chart2" | "chart3" | "danger";

// Written out in full: Tailwind only generates classes it can find as whole words.
const COLOR: Record<SeriesColor, { bg: string; stroke: string; wash: string }> = {
  chart1: { bg: "bg-chart-1", stroke: "stroke-chart-1", wash: "fill-chart-1/10" },
  chart2: { bg: "bg-chart-2", stroke: "stroke-chart-2", wash: "fill-chart-2/10" },
  chart3: { bg: "bg-chart-3", stroke: "stroke-chart-3", wash: "fill-chart-3/10" },
  danger: { bg: "bg-danger", stroke: "stroke-danger", wash: "fill-danger/10" },
};

export interface ChartSeries {
  label: string;
  color: SeriesColor;
  /** One value per day, in the same order as `days`. */
  values: number[];
}

/** Which series is which. Lines are keyed by a stroke, filled marks by a square. */
export function Legend({ series, mark = "line" }: { series: Pick<ChartSeries, "label" | "color">[]; mark?: "line" | "square" }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {series.map((each) => (
        <li key={each.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cx(COLOR[each.color].bg, mark === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-xs")} />
          {each.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Values per day. kind="line": one line per series, with a faint wash under it. kind="columns":
 * one bar per day for the first series (use it for counts that are often zero).
 * `days` are "YYYY-MM-DD", oldest first.
 */
export function TrendChart({
  days,
  series,
  kind = "line",
  title,
  emptyMessage = "Nothing in this period yet.",
}: {
  days: string[];
  series: ChartSeries[];
  kind?: "line" | "columns";
  /** What the chart shows, for screen readers and the table. */
  title: string;
  emptyMessage?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const shown = kind === "columns" ? series.slice(0, 1) : series;
  const count = days.length;
  const highest = Math.max(0, ...shown.flatMap((each) => each.values));
  const top = axisTop(highest);
  const ticks = axisTicks(top);

  // Horizontal position of a day and height of a value, both in percent of the plot.
  const xOf = (index: number) => (kind === "columns" ? ((index + 0.5) / count) * 100 : count > 1 ? (index / (count - 1)) * 100 : 50);
  const yOf = (value: number) => 100 - (value / top) * 100;

  function indexAt(event: PointerEvent<HTMLDivElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const index = kind === "columns" ? Math.floor(share * count) : Math.round(share * (count - 1));
    return Math.min(count - 1, Math.max(0, index));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") return setActive(null);
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + step)));
  }

  return (
    <figure className="min-w-0">
      {shown.length > 1 && (
        <div className="mb-4">
          <Legend series={shown} />
        </div>
      )}

      <div className="flex gap-2">
        {/* Value axis: labels sit on their gridlines. */}
        <div aria-hidden className="relative h-44 w-8 shrink-0 text-right text-[0.6875rem] text-muted tabular-nums sm:h-52">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${yOf(tick)}%` }}>
              {compactNumber(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`${title}. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={(event) => setActive(indexAt(event))}
            onPointerDown={(event) => setActive(indexAt(event))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((current) => current ?? count - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
            className="relative h-44 touch-pan-y rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-4 sm:h-52"
          >
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1="0"
                  x2="100"
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="1"
                  className={tick === 0 ? "stroke-line-strong" : "stroke-line-soft"}
                />
              ))}
              {kind === "line" &&
                count > 1 &&
                shown.map((each) => {
                  const points = each.values.map((value, index) => `${xOf(index)},${yOf(value)}`).join(" L");
                  return (
                    <g key={each.label}>
                      <path d={`M${points} L100,100 L0,100 Z`} className={COLOR[each.color].wash} />
                      <path
                        d={`M${points}`}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        className={COLOR[each.color].stroke}
                      />
                    </g>
                  );
                })}
            </svg>

            {kind === "columns" && (
              <div aria-hidden className="absolute inset-0 flex items-end">
                {shown[0]?.values.map((value, index) => (
                  <div key={days[index]} className={cx("flex h-full min-w-0 flex-1 items-end justify-center", count > 45 ? "px-[0.5px]" : "px-px")}>
                    <div
                      className={cx(
                        "w-full max-w-6 rounded-t-[4px] transition-opacity",
                        COLOR[shown[0].color].bg,
                        active !== null && active !== index && "opacity-45",
                      )}
                      style={{ height: `${(value / top) * 100}%`, minHeight: value > 0 ? 2 : 0 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {highest === 0 && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">{emptyMessage}</p>
            )}

            {active !== null && count > 0 && (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {kind === "line" && (
                  <>
                    <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-line-strong" style={{ left: `${xOf(active)}%` }} />
                    {shown.map((each) => (
                      <span
                        key={each.label}
                        className={cx("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", COLOR[each.color].bg)}
                        style={{ left: `${xOf(active)}%`, top: `${yOf(each.values[active] ?? 0)}%` }}
                      />
                    ))}
                  </>
                )}
                <div
                  className={cx(
                    "absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg shadow-ink/10",
                    xOf(active) > 50 ? "-translate-x-full" : "",
                  )}
                  style={{ left: `calc(${xOf(active)}% + ${xOf(active) > 50 ? "-0.75rem" : "0.75rem"})` }}
                >
                  <p className="text-muted">{formatDay(days[active])}</p>
                  {shown.map((each) => (
                    <p key={each.label} className="mt-1 flex items-center gap-2">
                      <span className={cx("h-0.5 w-3 rounded-full", COLOR[each.color].bg)} />
                      <span className="font-semibold text-ink tabular-nums">{formatNumber(each.values[active] ?? 0)}</span>
                      <span className="text-muted">{each.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div aria-hidden className="mt-2 flex justify-between text-[0.6875rem] text-muted">
            {tickIndexes(count, 5).map((index) => (
              <span key={index}>{formatDay(days[index])}</span>
            ))}
          </div>
        </div>
      </div>

      {/*
        The same numbers as a table: what a screen reader gets instead of the picture. The wrapper
        hides it — a table ignores a 1px width, and would make a phone page scroll sideways.
      */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {shown.map((each) => (
                <th key={each.label} scope="col">
                  {each.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day}>
                <th scope="row">{formatDay(day)}</th>
                {shown.map((each) => (
                  <td key={each.label}>{each.values[index] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** A tiny line with no axes: the shape of a number over time, for a stat tile. Decorative. */
export function Sparkline({ values, color = "chart1", className }: { values: number[]; color?: SeriesColor; className?: string }) {
  const top = Math.max(1, ...values);
  const points = values
    .map((value, index) => `${values.length > 1 ? (index / (values.length - 1)) * 100 : 50},${96 - (value / top) * 92}`)
    .join(" L");
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className={cx("h-9 w-full overflow-visible", className)}>
      {values.length > 1 && (
        <>
          <path d={`M${points} L100,100 L0,100 Z`} className={COLOR[color].wash} />
          <path
            d={`M${points}`}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className={COLOR[color].stroke}
          />
        </>
      )}
    </svg>
  );
}

/** A ranked list with a bar under each name: "which are the biggest". Every value is written out. */
export function BarList({
  items,
  color = "chart1",
  emptyMessage = "Nothing in this period yet.",
}: {
  items: { label: string; value: number }[];
  color?: SeriesColor;
  emptyMessage?: string;
}) {
  const highest = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">{item.label}</span>
            <span className="font-medium text-ink tabular-nums">{formatNumber(item.value)}</span>
          </div>
          <div
            aria-hidden
            className={cx("mt-1.5 h-2 rounded-r-[4px]", COLOR[color].bg)}
            style={{ width: `${(item.value / highest) * 100}%`, minWidth: item.value > 0 ? 2 : 0 }}
          />
        </li>
      ))}
    </ul>
  );
}

export type SegmentTone = "success" | "neutral" | "warning" | "danger";

const SEGMENT: Record<SegmentTone, string> = {
  success: "bg-success",
  neutral: "bg-faint",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Parts of a whole by state, as one bar and a list with the counts. The tones are the suite's
 * meaning colours, and each part is named and counted in the list, so colour never stands alone.
 */
export function SegmentBar({ segments }: { segments: { label: string; value: number; tone: SegmentTone }[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div>
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-subtle">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div key={segment.label} className={cx("min-w-1", SEGMENT[segment.tone])} style={{ flexGrow: segment.value, flexBasis: 0 }} />
          ))}
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex min-w-0 items-center gap-2">
            <span aria-hidden className={cx("size-2.5 shrink-0 rounded-full", SEGMENT[segment.tone])} />
            <span className="min-w-0 truncate text-ink-soft">{segment.label}</span>
            <span className="ml-auto font-medium text-ink tabular-nums">{formatNumber(segment.value)}</span>
            <span className="w-9 text-right text-xs text-muted tabular-nums">{total > 0 ? Math.round((segment.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
