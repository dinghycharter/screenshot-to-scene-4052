import { createFileRoute } from "@tanstack/react-router";

// Daily job (Vercel cron): pays sellers once their charter has started.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET variable is set.
export const Route = createFileRoute("/api/payouts/release")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
        const provided = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!provided || !timingSafeEqual(digest(provided), digest(secret))) return new Response("Unauthorized", { status: 401 });

        const { isStripeConfigured } = await import("@/lib/stripe.server");
        if (!isStripeConfigured()) return Response.json({ skipped: "stripe not configured" });

        const { releaseDuePayouts } = await import("@/lib/payments.server");
        return Response.json(await releaseDuePayouts());
      },
    },
  },
});
