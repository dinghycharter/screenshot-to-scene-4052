import { describe, expect, it } from "vitest";
import { canBuyerCheckout, canOwnerCancel, hasPaidOffer, hasSettledOffer, offerStatusLabel, sellerNetPerDay } from "./offers";

describe("offer rules", () => {
  it("shows the owner payout after the 3% seller fee", () => {
    expect(sellerNetPerDay(100)).toEqual({ fee: 3, net: 97 });
    expect(sellerNetPerDay(65)).toEqual({ fee: 1.95, net: 63.05 });
  });

  it("the owner can cancel until the buyer pays", () => {
    expect(canOwnerCancel("pending")).toBe(true);
    expect(canOwnerCancel("accepted")).toBe(true);
    expect(canOwnerCancel("paid")).toBe(false);
    expect(canOwnerCancel("cancelled")).toBe(false);
  });

  it("the buyer can only check out an accepted price", () => {
    expect(canBuyerCheckout("accepted")).toBe(true);
    expect(canBuyerCheckout("pending")).toBe(false);
    expect(canBuyerCheckout("cancelled")).toBe(false);
  });

  it("detects settled and paid conversations", () => {
    expect(hasSettledOffer([{ status: "declined" }, { status: "accepted" }])).toBe(true);
    expect(hasSettledOffer([{ status: "cancelled" }, { status: "countered" }])).toBe(false);
    expect(hasPaidOffer([{ status: "accepted" }])).toBe(false);
    expect(hasPaidOffer([{ status: "paid" }])).toBe(true);
  });

  it("labels every status", () => {
    expect(offerStatusLabel("cancelled")).toBe("Cancelled");
    expect(offerStatusLabel("paid")).toBe("Paid");
  });
});
