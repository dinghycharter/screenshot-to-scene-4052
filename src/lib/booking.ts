import { differenceInCalendarDays, parseISO } from "date-fns";

// Charter days are inclusive: picking up on the 1st and returning on the 3rd is 3 days.
// The database trigger bookings_before_insert() applies the same rule.
export function countCharterDays(startDate: string, endDate: string): number {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return days > 0 ? days : 0;
}

export function calculateBookingTotal(startDate: string, endDate: string, dailyPrice: number) {
  return countCharterDays(startDate, endDate) * dailyPrice;
}

export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled" | "completed";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Awaiting owner",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};
