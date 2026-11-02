import { format, parseISO } from "date-fns";

export function formatPrice(amount: number | string, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(date: string, pattern = "d MMM yyyy") {
  return format(parseISO(date), pattern);
}

export function formatDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) return `${format(s, "d")}–${format(e, "d MMM yyyy")}`;
    return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
  }
  return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "DC"
  );
}
