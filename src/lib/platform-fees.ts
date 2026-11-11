export const PLATFORM_FEE_RATE = 0.03;

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculatePlatformFees(rentalAmount: number) {
  const rental = roundCurrency(Math.max(0, rentalAmount));
  const buyerFee = roundCurrency(rental * PLATFORM_FEE_RATE);
  const sellerFee = roundCurrency(rental * PLATFORM_FEE_RATE);

  return {
    rental,
    buyerFee,
    sellerFee,
    buyerTotal: roundCurrency(rental + buyerFee),
    sellerPayout: roundCurrency(rental - sellerFee),
    platformGross: roundCurrency(buyerFee + sellerFee),
  };
}

/**
 * Same 3% + 3% split as calculatePlatformFees, in integer cents so the amounts sent to Stripe
 * never carry floating point errors. Buyer pays rental + buyerFee; the seller is paid rental - sellerFee.
 */
export function calculatePlatformFeesCents(rentalCents: number) {
  const rental = Math.max(0, Math.round(rentalCents));
  const buyerFee = Math.round(rental * PLATFORM_FEE_RATE);
  const sellerFee = Math.round(rental * PLATFORM_FEE_RATE);
  return {
    rental,
    buyerFee,
    sellerFee,
    buyerTotal: rental + buyerFee,
    sellerPayout: rental - sellerFee,
    platformGross: buyerFee + sellerFee,
  };
}
