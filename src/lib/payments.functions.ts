import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePlatformFeesCents } from "@/lib/platform-fees";
import { countCharterDays } from "@/lib/booking";

// Payment server functions. Server-only modules are loaded inside the handlers so they never reach the browser bundle.

export type PaymentResult<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; code: "not_configured" | "seller_not_ready" | "invalid" | "error"; error: string };

const NOT_CONFIGURED = { ok: false as const, code: "not_configured" as const, error: "Payments are not available yet." };

async function appOrigin(): Promise<string> {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const origin = request?.headers.get("origin");
  return origin ?? new URL(request!.url).origin;
}

/** Status of the signed-in seller's Stripe payout account. */
export const getPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentResult<{ configured: boolean; connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }>> => {
    const { isStripeConfigured, stripeRequest } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncPayoutAccount } = await import("@/lib/payments.server");
    const empty = { ok: true as const, configured: false, connected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    if (!isStripeConfigured()) return empty;
    try {
      const { data: row } = await supabaseAdmin.from("seller_payout_accounts").select("*").eq("user_id", context.userId).maybeSingle();
      if (!row) return { ...empty, configured: true };
      const account = await stripeRequest("GET", `/accounts/${row.stripe_account_id}`);
      await syncPayoutAccount(account);
      return {
        ok: true,
        configured: true,
        connected: true,
        chargesEnabled: !!account["charges_enabled"],
        payoutsEnabled: !!account["payouts_enabled"],
        detailsSubmitted: !!account["details_submitted"],
      };
    } catch (cause) {
      console.error("[payments] getPayoutStatus", cause);
      return { ok: false, code: "error", error: "Couldn't check your payout account." };
    }
  });

/** Creates the seller's Stripe Express account if needed and returns the onboarding link. */
export const startPayoutOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentResult<{ url: string }>> => {
    const { isStripeConfigured, stripeRequest } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!isStripeConfigured()) return NOT_CONFIGURED;
    try {
      const { data: existing } = await supabaseAdmin.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", context.userId).maybeSingle();
      let accountId = existing?.stripe_account_id;
      if (!accountId) {
        const email = typeof context.claims["email"] === "string" ? context.claims["email"] : undefined;
        const account = await stripeRequest(
          "POST",
          "/accounts",
          { type: "express", email, capabilities: { card_payments: { requested: true }, transfers: { requested: true } }, metadata: { user_id: context.userId } },
          { idempotencyKey: `acct_${context.userId}` },
        );
        accountId = account["id"] as string;
        const { error } = await supabaseAdmin.from("seller_payout_accounts").insert({ user_id: context.userId, stripe_account_id: accountId });
        if (error) throw error;
      }
      const origin = await appOrigin();
      const link = await stripeRequest("POST", "/account_links", {
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${origin}/dashboard/offers?payouts=refresh`,
        return_url: `${origin}/dashboard/offers?payouts=return`,
      });
      return { ok: true, url: link["url"] as string };
    } catch (cause) {
      console.error("[payments] startPayoutOnboarding", cause);
      return { ok: false, code: "error", error: "Couldn't start the payout setup. Try again in a moment." };
    }
  });

/** Starts a Stripe Checkout for an accepted offer. Only the buyer of that conversation can do this. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string }) => z.object({ offerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PaymentResult<{ url: string }>> => {
    const { isStripeConfigured, stripeRequest } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!isStripeConfigured()) return NOT_CONFIGURED;
    try {
      // Read with the user's own session so row level security decides what they may see.
      const { data: offer } = await context.supabase.from("price_offers").select("id, conversation_id, amount, status, start_date, end_date").eq("id", data.offerId).maybeSingle();
      if (!offer) return { ok: false, code: "invalid", error: "This offer could not be found." };
      if (offer.status === "paid") return { ok: false, code: "invalid", error: "This charter has already been paid." };
      if (offer.status !== "accepted") return { ok: false, code: "invalid", error: "This price is no longer available." };
      if (!offer.start_date || !offer.end_date) return { ok: false, code: "invalid", error: "This offer has no dates. Ask the owner to send a new price with dates." };
      if (offer.start_date < new Date().toISOString().slice(0, 10)) return { ok: false, code: "invalid", error: "The pick-up date has already passed. Ask the owner for a new price with new dates." };

      const { data: conversation } = await context.supabase.from("conversations").select("id, boat_id, owner_id, sailor_id").eq("id", offer.conversation_id).maybeSingle();
      if (!conversation || conversation.sailor_id !== context.userId) return { ok: false, code: "invalid", error: "Only the buyer in this conversation can pay." };
      const { data: boat } = await context.supabase.from("boats").select("id, title, currency").eq("id", conversation.boat_id).maybeSingle();
      if (!boat) return { ok: false, code: "invalid", error: "This boat listing is no longer available." };

      const { data: seller } = await supabaseAdmin.from("seller_payout_accounts").select("stripe_account_id, charges_enabled").eq("user_id", conversation.owner_id).maybeSingle();
      if (!seller?.stripe_account_id || !seller.charges_enabled) {
        return { ok: false, code: "seller_not_ready", error: "The owner hasn't finished setting up payouts yet. Ask them to connect their payout account." };
      }

      const days = countCharterDays(offer.start_date, offer.end_date);
      const rentalCents = Math.round(Number(offer.amount) * 100) * days;
      const fees = calculatePlatformFeesCents(rentalCents);
      const currency = boat.currency.toLowerCase();
      const origin = await appOrigin();

      const session = await stripeRequest("POST", "/checkout/sessions", {
        mode: "payment",
        client_reference_id: offer.id,
        customer_email: typeof context.claims["email"] === "string" ? context.claims["email"] : undefined,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${origin}/checkout?offer=${offer.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout?offer=${offer.id}`,
        line_items: [
          { quantity: 1, price_data: { currency, unit_amount: fees.rental, product_data: { name: `${boat.title}: ${days} ${days === 1 ? "day" : "days"} (${offer.start_date} to ${offer.end_date})` } } },
          { quantity: 1, price_data: { currency, unit_amount: fees.buyerFee, product_data: { name: "DinghyCharter service fee (3%)" } } },
        ],
        payment_intent_data: { transfer_group: `offer_${offer.id}`, metadata: { offer_id: offer.id } },
        metadata: { offer_id: offer.id, buyer_id: context.userId, seller_id: conversation.owner_id },
      });

      // Older unfinished attempts for this offer are no longer valid.
      await supabaseAdmin.from("payments").update({ status: "expired" }).eq("offer_id", offer.id).eq("status", "pending");
      const { error } = await supabaseAdmin.from("payments").insert({
        offer_id: offer.id,
        conversation_id: conversation.id,
        buyer_id: context.userId,
        seller_id: conversation.owner_id,
        currency,
        rental_cents: fees.rental,
        buyer_fee_cents: fees.buyerFee,
        seller_fee_cents: fees.sellerFee,
        buyer_total_cents: fees.buyerTotal,
        seller_payout_cents: fees.sellerPayout,
        start_date: offer.start_date,
        end_date: offer.end_date,
        stripe_session_id: session["id"] as string,
      });
      if (error) throw error;
      return { ok: true, url: session["url"] as string };
    } catch (cause) {
      console.error("[payments] createCheckout", cause);
      return { ok: false, code: "error", error: "Couldn't start the payment. Try again in a moment." };
    }
  });

/** Called when the buyer returns from Stripe. Confirms the payment even if the webhook has not arrived yet. */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => z.object({ sessionId: z.string().min(1).max(255) }).parse(input))
  .handler(async ({ data, context }): Promise<PaymentResult<{ outcome: "paid" | "pending" | "refunded" | "expired" }>> => {
    const { isStripeConfigured } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!isStripeConfigured()) return NOT_CONFIGURED;
    try {
      const { data: payment } = await supabaseAdmin.from("payments").select("buyer_id").eq("stripe_session_id", data.sessionId).maybeSingle();
      if (!payment || payment.buyer_id !== context.userId) return { ok: false, code: "invalid", error: "This payment could not be found." };
      const { finalizeCheckoutSession } = await import("@/lib/payments.server");
      return { ok: true, outcome: await finalizeCheckoutSession(data.sessionId) };
    } catch (cause) {
      console.error("[payments] confirmCheckout", cause);
      return { ok: false, code: "error", error: "Couldn't confirm the payment yet. Refresh in a moment." };
    }
  });
