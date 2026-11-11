import { describe, expect, it } from "vitest";
import { calculatePlatformFees, calculatePlatformFeesCents } from "./platform-fees";

describe("platform fees in cents", () => {
  it("splits 3% + 3% on a 65 EUR/day, 17 day charter", () => {
    expect(calculatePlatformFeesCents(110500)).toEqual({
      rental: 110500,
      buyerFee: 3315,
      sellerFee: 3315,
      buyerTotal: 113815,
      sellerPayout: 107185,
      platformGross: 6630,
    });
  });

  it("matches the euro based calculation", () => {
    const euros = calculatePlatformFees(1105);
    const cents = calculatePlatformFeesCents(110500);
    expect(cents.buyerTotal / 100).toBe(euros.buyerTotal);
    expect(cents.sellerPayout / 100).toBe(euros.sellerPayout);
  });
});
