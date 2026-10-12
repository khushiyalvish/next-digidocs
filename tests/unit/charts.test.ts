// Suite kit v7: copied from OnePortal tests/unit/charts.test.ts. Change it in the hub first, then copy it here.
import { describe, expect, it } from "vitest";
import { axisTicks, axisTop, compactNumber, formatDay, formatNumber, percentChange, tickIndexes } from "@/components/ui/chart-math";

/* Suite kit: the same file in the hub and in every suite application. */

describe("chart arithmetic (components/ui/chart-math.ts)", () => {
  it("gives a value axis a round top with whole-number ticks", () => {
    expect(axisTop(0)).toBe(4);
    expect(axisTop(3)).toBe(4);
    expect(axisTop(7)).toBe(8);
    expect(axisTop(10)).toBe(16);
    expect(axisTop(12)).toBe(16);
    expect(axisTop(45)).toBe(80);
    expect(axisTop(96)).toBe(100);
    expect(axisTop(1704)).toBe(2000);
    for (const max of [0, 1, 5, 9, 12, 33, 250, 999, 12_345]) {
      const top = axisTop(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(axisTicks(top).every(Number.isInteger)).toBe(true);
      expect(axisTicks(top)).toHaveLength(5);
    }
  });

  it("writes days and numbers the same way on the server and in the browser", () => {
    expect(formatDay("2026-10-05")).toBe("5 Oct");
    expect(formatDay("2026-01-31")).toBe("31 Jan");
    expect(formatDay("not a day")).toBe("not a day");
    expect(formatNumber(1284)).toBe("1,284");
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(1704)).toBe("1,704");
    expect(compactNumber(12_900)).toBe("12.9K");
    expect(compactNumber(4_200_000)).toBe("4.2M");
  });

  it("spreads axis labels evenly and keeps both ends", () => {
    expect(tickIndexes(0, 5)).toEqual([]);
    expect(tickIndexes(3, 5)).toEqual([0, 1, 2]);
    expect(tickIndexes(30, 5)).toEqual([0, 7, 15, 22, 29]);
  });

  it("compares with the period before, and says nothing when there is no period before", () => {
    expect(percentChange(114, 100)).toBe(14);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(5, 0)).toBeNull();
  });
});
