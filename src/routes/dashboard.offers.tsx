import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, CircleCheck, Landmark, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateRange } from "@/lib/format";
import { getPayoutStatus, startPayoutOnboarding } from "@/lib/payments.functions";
import { canBuyerCheckout, canOwnerCancel, formatMoney, offerStatusLabel, offerTotals } from "@/lib/offers";

export const Route = createFileRoute("/dashboard/offers")({
  head: () => ({ meta: [{ title: "Your offers — DinghyCharter" }, { name: "robots", content: "noindex" }] }),
  component: OffersPage,
});

type Role = "buyer" | "seller";

type DashboardOffer = {
  id: string;
  role: Role;
  conversationId: string;
  senderId: string;
  amount: number;
  status: string;
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
  boatTitle: string;
  currency: string;
  otherName: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  accepted: "bg-emerald-50 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-destructive/10 text-destructive",
};

function OffersPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<DashboardOffer | null>(null);
  const [roleChoice, setRoleChoice] = useState<Role | null>(null);
  const key = ["dashboard-offers", user?.id ?? "signed-out"] as const;

  const offersQuery = useQuery({
    queryKey: key,
    enabled: !!user,
    refetchInterval: 8000,
    queryFn: async (): Promise<DashboardOffer[]> => {
      const { data: conversations, error: conversationError } = await supabase
        .from("conversations")
        .select("id, boat_id, owner_id, sailor_id")
        .or(`owner_id.eq.${user!.id},sailor_id.eq.${user!.id}`);
      if (conversationError) throw conversationError;
      if (!conversations?.length) return [];

      const conversationIds = conversations.map((conversation) => conversation.id);
      const boatIds = [...new Set(conversations.map((conversation) => conversation.boat_id))];
      const personIds = [...new Set(conversations.flatMap((conversation) => [conversation.owner_id, conversation.sailor_id]))];

      const [offersResult, boatsResult, profilesResult] = await Promise.all([
        supabase
          .from("price_offers")
          .select("id, conversation_id, sender_id, amount, status, created_at, start_date, end_date")
          .in("conversation_id", conversationIds)
          .in("status", ["pending", "accepted", "paid", "cancelled"])
          .order("created_at", { ascending: false }),
        supabase.from("boats").select("id, title, currency").in("id", boatIds),
        supabase.from("profiles").select("id, full_name").in("id", personIds),
      ]);
      if (offersResult.error) throw offersResult.error;
      if (boatsResult.error) throw boatsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
      const boatById = new Map((boatsResult.data ?? []).map((boat) => [boat.id, boat]));
      const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

      return (offersResult.data ?? []).map((offer) => {
        const conversation = conversationById.get(offer.conversation_id)!;
        const role: Role = conversation.owner_id === user!.id ? "seller" : "buyer";
        const otherId = role === "seller" ? conversation.sailor_id : conversation.owner_id;
        const boat = boatById.get(conversation.boat_id);
        return {
          id: offer.id,
          role,
          conversationId: offer.conversation_id,
          senderId: offer.sender_id,
          amount: Number(offer.amount),
          status: offer.status,
          createdAt: offer.created_at,
          startDate: offer.start_date,
          endDate: offer.end_date,
          boatTitle: boat?.title ?? "Boat",
          currency: boat?.currency ?? "EUR",
          otherName: profileById.get(otherId)?.full_name || (role === "seller" ? "Buyer" : "Owner"),
        };
      });
    },
  });

  const payoutQuery = useQuery({
    queryKey: ["payout-status", user?.id ?? "signed-out"],
    enabled: !!user,
    queryFn: async () => getPayoutStatus(),
  });
  const connect = useMutation({
    mutationFn: async () => startPayoutOnboarding(),
    onSuccess: (result) => {
      if (result.ok) window.location.assign(result.url);
      else toast.error(result.error);
    },
    onError: () => toast.error("Couldn't start the payout setup. Try again in a moment."),
  });

  const cancel = useMutation({
    mutationFn: async (offerId: string) => {
      const { data, error } = await supabase.from("price_offers").update({ status: "cancelled" }).eq("id", offerId).in("status", ["pending", "accepted"]).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This price can no longer be cancelled. It may already have been paid.");
    },
    onSuccess: () => toast.success("Price cancelled. The buyer can no longer pay at this price."),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't cancel this price."),
    onSettled: () => {
      setToCancel(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (loading) {
    return <div className="container-page grid min-h-[60vh] place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-ocean" /></div>;
  }

  if (!user) {
    return (
      <div className="container-page grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Sign in to see your offers</h1>
          <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: "/dashboard/offers" }}>Sign in</Link></Button>
        </div>
      </div>
    );
  }

  const all = offersQuery.data ?? [];
  const sellerCount = all.filter((offer) => offer.role === "seller").length;
  const buyerCount = all.filter((offer) => offer.role === "buyer").length;
  const role: Role = roleChoice ?? (sellerCount > 0 && buyerCount === 0 ? "seller" : buyerCount > 0 && sellerCount === 0 ? "buyer" : sellerCount >= buyerCount ? "seller" : "buyer");
  const offers = all.filter((offer) => offer.role === role);
  const showTabs = sellerCount > 0 && buyerCount > 0;

  return (
    <main className="container-page min-h-[70vh] py-10 sm:py-14">
      <h1 className="font-display text-3xl font-semibold">Your offers</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {role === "seller"
          ? "Prices you or buyers have proposed on your boats, with their dates. You can cancel a price at any time until the buyer pays. After payment nothing can be cancelled."
          : "Offers on boats you want to charter. When the owner agrees a price you can go to checkout from here."}
      </p>

      {role === "seller" && payoutQuery.data?.ok && payoutQuery.data.configured && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ocean" />
            <div>
              <p className="font-semibold">Payouts</p>
              <p className="text-sm text-muted-foreground">
                {payoutQuery.data.chargesEnabled
                  ? "Your Stripe account is ready. You are paid once the charter starts, minus the 3% DinghyCharter fee."
                  : "Connect your Stripe account so buyers can pay you. It takes a few minutes and Stripe verifies your identity."}
              </p>
            </div>
          </div>
          {payoutQuery.data.chargesEnabled ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CircleCheck className="h-4 w-4" /> Ready</span>
          ) : (
            <Button variant="ocean" size="sm" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? <LoaderCircle className="animate-spin" /> : null}
              {payoutQuery.data.connected ? "Finish payout setup" : "Set up payouts"}
            </Button>
          )}
        </div>
      )}

      {showTabs && (
        <div className="mt-6 inline-flex rounded-full border border-border bg-secondary/50 p-1 text-sm font-medium" role="tablist">
          {(["buyer", "seller"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={role === value}
              onClick={() => setRoleChoice(value)}
              className={`rounded-full px-4 py-1.5 transition-colors ${role === value ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
            >
              {value === "buyer" ? `As a buyer (${buyerCount})` : `As a seller (${sellerCount})`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {offersQuery.isLoading ? (
          <div className="rounded-2xl border border-border p-6 text-muted-foreground">Loading…</div>
        ) : offersQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">We couldn't load your offers. Try again in a moment.</div>
        ) : offers.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
            {role === "seller" ? "No active prices yet. Open a conversation with a buyer to set a price." : "No offers yet. Message an owner, choose your dates and ask to buy."}
            <div className="mt-4"><Button asChild variant="outline" size="sm"><Link to="/dashboard/messages"><MessageCircle /> Go to messages</Link></Button></div>
          </div>
        ) : offers.map((offer) => {
          const totals = offerTotals(offer.amount, offer.startDate, offer.endDate);
          const awaitingMe = offer.status === "pending" && offer.senderId !== user.id;
          return (
            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold">{offer.boatTitle}</p>
                <p className="text-sm text-muted-foreground">{role === "seller" ? "Buyer" : "Owner"}: {offer.otherName} · {format(parseISO(offer.createdAt), "d MMM, HH:mm")}</p>
                {offer.startDate && offer.endDate && (
                  <p className="flex items-center gap-1.5 text-sm"><CalendarDays className="h-3.5 w-3.5 text-ocean" /> {formatDateRange(offer.startDate, offer.endDate)} · {totals.days} {totals.days === 1 ? "day" : "days"}</p>
                )}
                <p className="text-sm">
                  <strong>{formatMoney(offer.amount, offer.currency)}</strong> / day
                  {totals.days > 0 && <> · <strong>{formatMoney(totals.subtotal, offer.currency)}</strong> total</>}
                  {role === "seller" && totals.days > 0 && <> · you receive <strong>{formatMoney(totals.sellerNet, offer.currency)}</strong> after the 3% fee</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[offer.status] ?? "bg-ocean-soft text-ocean"}`}>
                  {role === "buyer" && offer.status === "pending" ? (awaitingMe ? "Needs your answer" : "Waiting for the owner") : offerStatusLabel(offer.status)}
                </span>
                <Button asChild size="sm" variant="outline"><Link to="/dashboard/messages" search={{ c: offer.conversationId }}><MessageCircle /> Open chat</Link></Button>
                {role === "buyer" && canBuyerCheckout(offer.status) && (
                  <Button asChild size="sm" variant="ocean"><Link to="/checkout" search={{ offer: offer.id }}>Review checkout</Link></Button>
                )}
                {role === "seller" && canOwnerCancel(offer.status) && (
                  <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => setToCancel(offer)}>Cancel price</Button>
                )}
                {offer.status === "paid" && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-ocean" /> Paid, can't be cancelled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!toCancel} onOpenChange={(open) => { if (!open && !cancel.isPending) setToCancel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this price?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel ? `${toCancel.otherName} will no longer be able to pay ${formatMoney(toCancel.amount, toCancel.currency)} per day for ${toCancel.boatTitle}. You can send a new price afterwards.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isPending} onClick={(event) => { event.preventDefault(); if (toCancel) cancel.mutate(toCancel.id); }}>
              {cancel.isPending ? <LoaderCircle className="animate-spin" /> : null} Cancel price
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
