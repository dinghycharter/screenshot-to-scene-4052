import { countCharterDays } from "./booking";
import { calculatePlatformFees } from "./platform-fees";

export type OfferStatus = "pending" | "accepted" | "declined" | "countered" | "cancelled" | "paid";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
  countered: "Countered",
  cancelled: "Cancelled",
  paid: "Paid",
};

export function offerStatusLabel(status: string): string {
  return OFFER_STATUS_LABEL[status as OfferStatus] ?? status;
}

/** What the owner receives per day after the DinghyCharter seller fee. */
export function sellerNetPerDay(dailyPrice: number) {
  const { sellerFee, sellerPayout } = calculatePlatformFees(dailyPrice);
  return { fee: sellerFee, net: sellerPayout };
}

/** The owner can withdraw a price at any time until the buyer has paid. */
export function canOwnerCancel(status: string): boolean {
  return status === "pending" || status === "accepted";
}

/** The buyer can go to checkout only on a price both sides agreed. */
export function canBuyerCheckout(status: string): boolean {
  return status === "accepted";
}

/** Once a price is accepted or paid, no new offers are allowed in the conversation. */
export function hasSettledOffer(offers: { status: string }[]): boolean {
  return offers.some((offer) => offer.status === "accepted" || offer.status === "paid");
}

export function hasPaidOffer(offers: { status: string }[]): boolean {
  return offers.some((offer) => offer.status === "paid");
}

/** A price is per day and applies to the chosen dates (inclusive). */
export function offerTotals(dailyPrice: number, startDate: string | null | undefined, endDate: string | null | undefined) {
  const days = startDate && endDate ? countCharterDays(startDate, endDate) : 0;
  const subtotal = Math.round(dailyPrice * days * 100) / 100;
  const { sellerFee, sellerPayout } = calculatePlatformFees(subtotal);
  return { days, subtotal, sellerFee, sellerNet: sellerPayout };
}

/** Like formatPrice, but keeps cents when there are any (fees and payouts are not round numbers). */
export function formatMoney(amount: number | string, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));
}
