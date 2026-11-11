// Server-only payment logic shared by server functions and the Stripe webhook.
// Direct charges: payments are made on the seller's own Stripe account and DinghyCharter keeps an application fee.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stripeRequest, stripeRequestV2, type StripeObject } from "@/lib/stripe.server";

export type CheckoutOutcome = "paid" | "pending" | "refunded" | "expired";

/**
 * Turns a paid Stripe Checkout Session into a paid offer. Safe to call many times
 * (the webhook and the return page can both call it).
 * If the owner cancelled the price while the buyer was paying, the payment is refunded automatically.
 */
export async function finalizeCheckoutSession(sessionId: string): Promise<CheckoutOutcome> {
  const { data: payment, error } = await supabaseAdmin.from("payments").select("*").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw error;
  if (!payment) {
    console.error("[payments] Checkout session without a payment row", sessionId);
    return "pending";
  }
  if (payment.status === "paid") return "paid";
  if (payment.status === "refunded") return "refunded";

  const { data: seller } = await supabaseAdmin.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", payment.seller_id).maybeSingle();
  if (!seller?.stripe_account_id) throw new Error("Seller Stripe account not found for payment " + payment.id);
  const stripeAccount = seller.stripe_account_id;

  const session = await stripeRequest(
    "GET",
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { expand: ["payment_intent.latest_charge"] },
    { stripeAccount },
  );
  if (session["payment_status"] !== "paid") {
    return session["status"] === "expired" ? "expired" : "pending";
  }

  const paymentIntent: StripeObject = typeof session["payment_intent"] === "object" ? session["payment_intent"] : { id: session["payment_intent"] };
  const charge: StripeObject | null = paymentIntent["latest_charge"] && typeof paymentIntent["latest_charge"] === "object" ? paymentIntent["latest_charge"] : null;

  // Only an accepted offer can become paid. The database trigger allows this transition for the service role only.
  const { data: updatedOffer, error: offerError } = await supabaseAdmin
    .from("price_offers")
    .update({ status: "paid" })
    .eq("id", payment.offer_id)
    .eq("status", "accepted")
    .select("id");
  if (offerError) throw offerError;

  if (!updatedOffer?.length) {
    await stripeRequest(
      "POST",
      "/refunds",
      {
        payment_intent: paymentIntent["id"],
        refund_application_fee: true,
        reason: "requested_by_customer",
        metadata: { payment_id: payment.id, cause: "offer_no_longer_accepted" },
      },
      { idempotencyKey: `refund_${payment.id}`, stripeAccount },
    );
    await supabaseAdmin
      .from("payments")
      .update({ status: "refunded", refunded_at: new Date().toISOString(), stripe_payment_intent_id: paymentIntent["id"] ?? null })
      .eq("id", payment.id);
    return "refunded";
  }

  const { error: paymentError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent["id"] ?? null,
      stripe_charge_id: charge?.["id"] ?? null,
    })
    .eq("id", payment.id);
  if (paymentError) throw paymentError;
  return "paid";
}

/** Reads the seller's Stripe account (Accounts v2) and stores whether it can take payments. */
export async function refreshPayoutAccount(userId: string, stripeAccountId: string) {
  const account = await stripeRequestV2("GET", `/core/accounts/${encodeURIComponent(stripeAccountId)}?include=configuration.merchant&include=requirements`);
  const capabilities = account["configuration"]?.["merchant"]?.["capabilities"] ?? {};
  const chargesEnabled = capabilities["card_payments"]?.["status"] === "active";
  const payoutsEnabled = capabilities["stripe_balance"]?.["payouts"]?.["status"] === "active";
  const detailsSubmitted = chargesEnabled || payoutsEnabled;
  await supabaseAdmin
    .from("seller_payout_accounts")
    .update({ charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled, details_submitted: detailsSubmitted, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return { chargesEnabled, payoutsEnabled, detailsSubmitted };
}
