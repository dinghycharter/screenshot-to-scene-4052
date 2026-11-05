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
