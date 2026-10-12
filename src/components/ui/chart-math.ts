// Suite kit v7: copied from OnePortal src/components/ui/chart-math.ts. Change it in the hub first, then copy it here.
/*
 * The arithmetic behind the charts (src/components/ui/charts.tsx). Pure: numbers and strings in,
 * numbers and strings out — no clock and no locale, so the server and the browser always agree.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" → "5 Oct". Anything else is returned as it came. */
export function formatDay(day: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  const month = match ? MONTHS[Number(match[1]) - 1] : undefined;
  return match && month ? `${Number(match[2])} ${month}` : day;
}

/** 1284 → "1,284". */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** For stat tiles and axis ticks: 950 → "950", 12900 → "12.9K", 4200000 → "4.2M". */
export function compactNumber(value: number): string {
  const short = (scaled: number, unit: string) => `${scaled.toFixed(1).replace(/\.0$/, "")}${unit}`;
  if (Math.abs(value) >= 1_000_000) return short(value / 1_000_000, "M");
  if (Math.abs(value) >= 10_000) return short(value / 1_000, "K");
  return formatNumber(value);
}

const AXIS_INTERVALS = 4;

/**
 * The top of a value axis that starts at zero: the smallest "clean" number (1, 2, 2.5, 4 or 5 times
 * a power of ten, per interval) that fits `max`, so every tick is a round number. Never below 4,
 * so a chart of small counts still has whole-number ticks.
 */
export function axisTop(max: number): number {
  const perInterval = Math.max(max, AXIS_INTERVALS) / AXIS_INTERVALS;
  const magnitude = 10 ** Math.floor(Math.log10(perInterval));
  const step = [1, 2, 2.5, 4, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= perInterval && Number.isInteger(candidate));
  return (step ?? 10 * magnitude) * AXIS_INTERVALS;
}

/** The tick values of that axis, bottom to top: 0 … top. */
export function axisTicks(top: number): number[] {
  return Array.from({ length: AXIS_INTERVALS + 1 }, (_, index) => (top / AXIS_INTERVALS) * index);
}

/** Up to `wanted` positions spread evenly over `count` points, always including the first and the last. */
export function tickIndexes(count: number, wanted: number): number[] {
  if (count <= 0) return [];
  if (count <= wanted) return Array.from({ length: count }, (_, index) => index);
  const indexes = Array.from({ length: wanted }, (_, index) => Math.round((index * (count - 1)) / (wanted - 1)));
  return [...new Set(indexes)];
}

/** Change from `previous` to `current` in percent, rounded; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
