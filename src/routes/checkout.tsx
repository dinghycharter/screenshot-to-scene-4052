import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { calculatePlatformFees } from "@/lib/platform-fees";
import { countCharterDays } from "@/lib/booking";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({ offer: typeof search.offer === "string" ? search.offer : undefined }),
  head: () => ({ meta: [{ title: "Review your charter — DinghyCharter" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPreviewPage,
});

function CheckoutPreviewPage() {
  const { user, loading } = useAuth();
  const { offer: offerId } = Route.useSearch();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const checkoutQuery = useQuery({
    queryKey: ["checkout-preview", offerId, user?.id],
    enabled: !!offerId && !!user,
    queryFn: async () => {
      const { data: offer, error: offerError } = await supabase.from("price_offers").select("id, conversation_id, sender_id, amount, status").eq("id", offerId!).maybeSingle();
      if (offerError) throw offerError;
      if (offer?.status === "cancelled") throw new Error("The owner cancelled this price, so it can no longer be paid. Message the owner to agree a new price.");
      if (!offer || (offer.status !== "accepted" && offer.status !== "paid")) throw new Error("This price has not been accepted or is no longer available.");

      const { data: conversation, error: conversationError } = await supabase.from("conversations").select("id, boat_id, owner_id, sailor_id").eq("id", offer.conversation_id).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation || conversation.sailor_id !== user!.id) throw new Error("Only the buyer in this conversation can review checkout.");

      const { data: boat, error: boatError } = await supabase.from("boats").select("id, title, city, country, currency, security_deposit, cancellation_policy").eq("id", conversation.boat_id).maybeSingle();
      if (boatError) throw boatError;
      if (!boat) throw new Error("This boat listing is no longer available.");
      return { offer, conversation, boat };
    },
  });

  const record = checkoutQuery.data;
  const days = startDate && endDate ? countCharterDays(startDate, endDate) : 0;
  const rentalSubtotal = record && days > 0 ? Math.round(Number(record.offer.amount) * days * 100) / 100 : 0;
  const fees = useMemo(() => calculatePlatformFees(rentalSubtotal), [rentalSubtotal]);
  const currency = record?.boat.currency ?? "EUR";
  const isPaid = record?.offer.status === "paid";
  const total = fees.buyerTotal + (record ? Number(record.boat.security_deposit) : 0);

  return (
    <main className="container-page min-h-[70vh] py-10 sm:py-14">
      <Link to="/dashboard/messages" search={{ c: record?.conversation.id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to messages</Link>
      <div className="mx-auto mt-6 grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <p className="text-sm font-semibold text-ocean">DinghyCharter</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Review your charter</h1>
          <p className="mt-2 text-muted-foreground">The owner accepted this daily price. Review the dates and full amount before continuing to secure payment.</p>

          {loading || checkoutQuery.isLoading ? <div className="mt-8 rounded-2xl border border-border p-6 text-muted-foreground">Loading accepted offer…</div> : checkoutQuery.isError ? <div role="alert" className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{checkoutQuery.error instanceof Error ? checkoutQuery.error.message : "Could not load this accepted offer."}</div> : record ? (
            <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card">
              <div><h2 className="text-xl font-semibold">{record.boat.title}</h2><p className="mt-1 text-sm text-muted-foreground">{record.boat.city}, {record.boat.country}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">Pick-up date <span className="text-destructive">*</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(""); }} className="h-11 w-full rounded-xl border border-input bg-background px-3" /></label>
                <label className="space-y-2 text-sm font-medium">Return date <span className="text-destructive">*</span><input type="date" min={startDate || new Date().toISOString().slice(0, 10)} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3" /></label>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary/60 p-4 text-sm"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ocean" /><p>The agreed rate is <strong>{formatPrice(Number(record.offer.amount), currency)} per day</strong>. Check that your dates match the booking you discussed with the owner.</p></div>
              {record.boat.cancellation_policy && <div><h3 className="font-semibold">Cancellation policy</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{record.boat.cancellation_policy}</p></div>}
            </div>
          ) : null}
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Price breakdown</h2>
          {record ? <>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{formatPrice(Number(record.offer.amount), currency)} × {days || "—"} {days === 1 ? "day" : "days"}</span><span>{formatPrice(rentalSubtotal, currency)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">DinghyCharter buyer fee (3%)</span><span>{formatPrice(fees.buyerFee, currency)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Refundable security deposit</span><span>{formatPrice(Number(record.boat.security_deposit), currency)}</span></div>
              <div className="flex justify-between border-t border-border pt-4 text-base font-semibold"><span>Total to pay</span><span>{formatPrice(total, currency)}</span></div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">The buyer fee applies to the rental subtotal, not the refundable deposit.</p>
            <Button variant="ocean" size="lg" className="mt-6 w-full" disabled><CreditCard className="h-4 w-4" /> {isPaid ? "Paid" : "Continue to secure payment"}</Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">{isPaid ? "This charter has been paid and can no longer be cancelled." : "Payment processing is not connected yet. This preview will not charge you."}</p>
            <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-ocean" />The owner receives the rental amount minus the 3% seller fee: {formatPrice(fees.sellerPayout, currency)} estimated for these dates, before payment processing costs.</div>
          </> : <p className="mt-3 text-sm text-muted-foreground">The breakdown will appear after an accepted offer loads.</p>}
        </aside>
      </div>
    </main>
  );
}

