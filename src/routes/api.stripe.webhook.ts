import { createFileRoute } from "@tanstack/react-router";

// Stripe calls this endpoint when a payment completes or a seller account changes.
// The signature is checked against STRIPE_WEBHOOK_SECRET before anything is trusted.
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        const rawBody = await request.text();
        if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
          return new Response("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
        try {
          if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
            const { finalizeCheckoutSession } = await import("@/lib/payments.server");
            await finalizeCheckoutSession(String(event.data.object["id"]));
          } else if (event.type === "account.updated") {
            const { syncPayoutAccount } = await import("@/lib/payments.server");
            await syncPayoutAccount(event.data.object);
          }
        } catch (cause) {
          console.error("[stripe webhook]", event.type, cause);
          return new Response("Handler error", { status: 500 }); // Stripe retries
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
