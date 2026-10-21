/*
 * How import amounts are shown (old Import.js: worked at 4 decimals, shown with 2), shared by the
 * form and the View page. Pure.
 */

/** Calculated values: 2 decimals. */
export const formatMoney = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** FOB values and totals: as entered, up to 4 decimals (old setNumFull). */
export const formatAmount = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** A rate as a percentage ("7.5%"), or "—" when there is none. */
export const formatRate = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${Number(value)}%`);
