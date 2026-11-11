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
