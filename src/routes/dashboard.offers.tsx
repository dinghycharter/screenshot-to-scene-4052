import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
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
import { formatPrice } from "@/lib/format";
import { canOwnerCancel, offerStatusLabel, sellerNetPerDay } from "@/lib/offers";

export const Route = createFileRoute("/dashboard/offers")({
  head: () => ({ meta: [{ title: "Your prices and offers — DinghyCharter" }, { name: "robots", content: "noindex" }] }),
  component: OwnerOffersPage,
});

type OwnerOffer = {
  id: string;
  conversationId: string;
  amount: number;
  status: string;
  createdAt: string;
  boatTitle: string;
  currency: string;
  buyerName: string;
};

function OwnerOffersPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<OwnerOffer | null>(null);
  const key = ["owner-offers", user?.id ?? "signed-out"] as const;

  const offersQuery = useQuery({
    queryKey: key,
    enabled: !!user,
    refetchInterval: 8000,
    queryFn: async (): Promise<OwnerOffer[]> => {
      const { data: conversations, error: conversationError } = await supabase.from("conversations").select("id, boat_id, sailor_id").eq("owner_id", user!.id);
      if (conversationError) throw conversationError;
      if (!conversations?.length) return [];

      const conversationIds = conversations.map((conversation) => conversation.id);
      const boatIds = [...new Set(conversations.map((conversation) => conversation.boat_id))];
      const buyerIds = [...new Set(conversations.map((conversation) => conversation.sailor_id))];

      const [offersResult, boatsResult, profilesResult] = await Promise.all([
        supabase.from("price_offers").select("id, conversation_id, amount, status, created_at, start_date, end_date").in("conversation_id", conversationIds).in("status", ["pending", "accepted", "paid"]).order("created_at", { ascending: false }),
        supabase.from("boats").select("id, title, currency").in("id", boatIds),
        supabase.from("profiles").select("id, full_name").in("id", buyerIds),
      ]);
      if (offersResult.error) throw offersResult.error;
      if (boatsResult.error) throw boatsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
      const boatById = new Map((boatsResult.data ?? []).map((boat) => [boat.id, boat]));
      const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

      return (offersResult.data ?? []).map((offer) => {
        const conversation = conversationById.get(offer.conversation_id)!;
        const boat = boatById.get(conversation.boat_id);
        return {
          id: offer.id,
          conversationId: offer.conversation_id,
          amount: Number(offer.amount),
          status: offer.status,
          createdAt: offer.created_at,
          dates: offer.start_date && offer.end_date ? `${offer.start_date} to ${offer.end_date}` : null,
          boatTitle: boat?.title ?? "Boat",
          currency: boat?.currency ?? "EUR",
          buyerName: profileById.get(conversation.sailor_id)?.full_name ?? "Buyer",
        };
      });
    },
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
          <h1 className="font-display text-2xl font-semibold">Sign in to see your prices</h1>
          <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: "/dashboard/offers" }}>Sign in</Link></Button>
        </div>
      </div>
    );
  }

  const offers = offersQuery.data ?? [];

  return (
    <main className="container-page min-h-[70vh] py-10 sm:py-14">
      <h1 className="font-display text-3xl font-semibold">Your prices and offers</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Prices you or buyers have proposed on your boats. You can cancel a price at any time until the buyer pays. After payment nothing can be cancelled.</p>

      <div className="mt-8 space-y-3">
        {offersQuery.isLoading ? (
          <div className="rounded-2xl border border-border p-6 text-muted-foreground">Loading…</div>
        ) : offersQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">We couldn't load your prices. Try again in a moment.</div>
        ) : offers.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
            No active prices yet. Open a conversation with a buyer to set a price.
            <div className="mt-4"><Button asChild variant="outline" size="sm"><Link to="/dashboard/messages"><MessageCircle /> Go to messages</Link></Button></div>
          </div>
        ) : offers.map((offer) => {
          const { net } = sellerNetPerDay(offer.amount);
          return (
            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="min-w-0">
                <p className="truncate font-semibold">{offer.boatTitle}</p>
                <p className="text-sm text-muted-foreground">{offer.buyerName} · {offer.dates ? `${offer.dates} · ` : ""}{format(parseISO(offer.createdAt), "d MMM, HH:mm")}</p>
                <p className="mt-1 text-sm">
                  <strong>{formatPrice(offer.amount, offer.currency)}</strong> / day · you receive <strong>{formatPrice(net, offer.currency)}</strong> / day after the 3% fee
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-ocean-soft text-ocean"}`}>{offerStatusLabel(offer.status)}</span>
                <Button asChild size="sm" variant="outline"><Link to="/dashboard/messages" search={{ c: offer.conversationId }}><MessageCircle /> Open chat</Link></Button>
                {canOwnerCancel(offer.status) ? (
                  <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => setToCancel(offer)}>Cancel price</Button>
                ) : (
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
              {toCancel ? `${toCancel.buyerName} will no longer be able to pay ${formatPrice(toCancel.amount, toCancel.currency)} per day for ${toCancel.boatTitle}. You can send a new price afterwards.` : ""}
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
