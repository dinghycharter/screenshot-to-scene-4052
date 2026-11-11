// Server-only payment logic shared by server functions, the Stripe webhook and the payout cron.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stripeRequest, type StripeObject } from "@/lib/stripe.server";

export type CheckoutOutcome = "paid" | "pending" | "refunded" | "expired";

/**
 * Turns a paid Stripe Checkout Session into a paid offer. Safe to call many times
 * (webhook and return page can both call it).
 * If the owner cancelled the price while the buyer was paying, the payment is refunded automatically.
 */
export async function finalizeCheckoutSession(sessionId: string): Promise<CheckoutOutcome> {
  const session = await stripeRequest("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["payment_intent.latest_charge"],
  });

  const { data: payment, error } = await supabaseAdmin.from("payments").select("*").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw error;
  if (!payment) {
    console.error("[payments] Checkout session without a payment row", sessionId);
    return "pending";
  }
  if (payment.status === "paid" || payment.status === "transferred") return "paid";
  if (payment.status === "refunded") return "refunded";

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
      { payment_intent: paymentIntent["id"], reason: "requested_by_customer", metadata: { payment_id: payment.id, cause: "offer_no_longer_accepted" } },
      { idempotencyKey: `refund_${payment.id}` },
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

/**
 * Pays sellers once the charter has started. The money was collected on the platform account;
 * this moves the seller's share (rental minus the 3% seller fee) to their connected account.
 */
export async function releaseDuePayouts(): Promise<{ transferred: number; skipped: number; failed: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabaseAdmin.from("payments").select("*").eq("status", "paid").lte("start_date", today).limit(50);
  if (error) throw error;

  let transferred = 0;
  let skipped = 0;
  let failed = 0;
  for (const payment of due ?? []) {
    const { data: account } = await supabaseAdmin.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", payment.seller_id).maybeSingle();
    if (!account?.stripe_account_id || !payment.stripe_charge_id) {
      skipped += 1;
      continue;
    }
    try {
      const transfer = await stripeRequest(
        "POST",
        "/transfers",
        {
          amount: payment.seller_payout_cents,
          currency: payment.currency,
          destination: account.stripe_account_id,
          source_transaction: payment.stripe_charge_id,
          transfer_group: `offer_${payment.offer_id}`,
          metadata: { payment_id: payment.id, offer_id: payment.offer_id },
        },
        { idempotencyKey: `transfer_${payment.id}` },
      );
      await supabaseAdmin
        .from("payments")
        .update({ status: "transferred", stripe_transfer_id: transfer["id"], transferred_at: new Date().toISOString() })
        .eq("id", payment.id);
      transferred += 1;
    } catch (cause) {
      console.error("[payments] Transfer failed", payment.id, cause);
      failed += 1;
    }
  }
  return { transferred, skipped, failed };
}

export async function syncPayoutAccount(account: StripeObject) {
  await supabaseAdmin
    .from("seller_payout_accounts")
    .update({
      charges_enabled: !!account["charges_enabled"],
      payouts_enabled: !!account["payouts_enabled"],
      details_submitted: !!account["details_submitted"],
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account["id"]);
}
