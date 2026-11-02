import { format } from "date-fns";

export type Range = { start_date: string; end_date: string };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function isWithinRanges(day: Date, ranges: Range[]) {
  const d = iso(day);
  return ranges.some((r) => r.start_date <= d && r.end_date >= d);
}

// A charter request must fit inside one availability window and not overlap a confirmed booking.
export function isRangeBookable(start: string, end: string, available: Range[], booked: Range[]) {
  const fits = available.some((w) => w.start_date <= start && w.end_date >= end);
  const clashes = booked.some((b) => b.start_date <= end && b.end_date >= start);
  return fits && !clashes;
}
