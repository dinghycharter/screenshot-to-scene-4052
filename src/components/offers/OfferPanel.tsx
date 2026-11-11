import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatPrice } from "@/lib/format";
import { canBuyerCheckout, canOwnerCancel, hasPaidOffer, hasSettledOffer, offerStatusLabel, sellerNetPerDay } from "@/lib/offers";

type PriceOffer = Tables<"price_offers">;

type Props = {
  conversationId: string;
  ownerId: string;
  boat: { daily_price: number; currency: string; price_negotiable: boolean };
  closed: boolean;
};

type Confirm =
  | { kind: "send"; amount: number; counterOfferId?: string }
  | { kind: "accept"; offer: PriceOffer }
  | { kind: "cancel"; offer: PriceOffer };

export const priceOffersKey = (conversationId: string) => ["price-offers", conversationId] as const;

/**
 * Price and checkout steps of a conversation:
 * 1. the buyer asks to buy at the listed price, or proposes another price;
 * 2. the owner accepts, or answers with a different price (the owner can always set a price);
 * 3. the buyer accepts the agreed price and reviews checkout.
 * The owner can cancel any unpaid price; once paid, nothing can be changed.
 */
export function OfferPanel({ conversationId, ownerId, boat, closed }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const isOwner = user?.id === ownerId;
  const currency = boat.currency;

  const offersQuery = useQuery({
    queryKey: priceOffersKey(conversationId),
    enabled: !!user,
    refetchInterval: 4000,
    queryFn: async (): Promise<PriceOffer[]> => {
      const { data, error } = await supabase.from("price_offers").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const offers = offersQuery.data ?? [];
  const pendingOffer = [...offers].reverse().find((offer) => offer.status === "pending") ?? null;
  const acceptedOffer = [...offers].reverse().find((offer) => offer.status === "accepted") ?? null;
  const settled = hasSettledOffer(offers);
  const paid = hasPaidOffer(offers);
  const waitingOnOther = pendingOffer?.sender_id === user?.id;
  const canCounter = isOwner || boat.price_negotiable;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: priceOffersKey(conversationId) });
  };

  const sendOffer = useMutation({
    mutationFn: async ({ amount, counterOfferId }: { amount: number; counterOfferId?: string }) => {
      if (!user) throw new Error("Sign in to send a price.");
      if (closed) throw new Error("This conversation has been closed.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid daily price.");
      if (counterOfferId) {
        const { data, error } = await supabase.from("price_offers").update({ status: "countered" }).eq("id", counterOfferId).eq("status", "pending").select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("That price was already answered. Refresh and try again.");
      }
      const { error } = await supabase.from("price_offers").insert({ conversation_id: conversationId, sender_id: user.id, amount });
      if (error) throw error;
    },
    onSuccess: () => {
      setAmountInput("");
      setConfirm(null);
      refresh();
    },
    onError: (error: unknown) => {
      setConfirm(null);
      refresh();
      toast.error(error instanceof Error ? error.message : "Couldn't send this price.");
    },
  });

  const respond = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: "accepted" | "declined" }) => {
      if (closed) throw new Error("This conversation has been closed.");
      const { data, error } = await supabase.from("price_offers").update({ status }).eq("id", offerId).eq("status", "pending").select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("That price was already answered or cancelled.");
    },
    onSuccess: () => {
      setConfirm(null);
      refresh();
    },
    onError: (error: unknown) => {
      setConfirm(null);
      refresh();
      toast.error(error instanceof Error ? error.message : "Couldn't respond to this price.");
    },
  });

  const cancel = useMutation({
    mutationFn: async (offerId: string) => {
      const { data, error } = await supabase.from("price_offers").update({ status: "cancelled" }).eq("id", offerId).in("status", ["pending", "accepted"]).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This price can no longer be cancelled. It may already have been paid.");
    },
    onSuccess: () => {
      setConfirm(null);
      toast.success("Price cancelled. The buyer can no longer pay at this price.");
      refresh();
    },
    onError: (error: unknown) => {
      setConfirm(null);
      refresh();
      toast.error(error instanceof Error ? error.message : "Couldn't cancel this price.");
    },
  });

  if (!user) return null;

  const busy = sendOffer.isPending || respond.isPending || cancel.isPending;
  const typedAmount = Number(amountInput);
  const typedNet = Number.isFinite(typedAmount) && typedAmount > 0 ? sellerNetPerDay(typedAmount) : null;

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    if (!amountInput) return;
    const request = { amount: typedAmount, counterOfferId: pendingOffer?.id };
    if (isOwner) setConfirm({ kind: "send", ...request });
    else sendOffer.mutate(request);
  };

  const confirmAmount = confirm?.kind === "send" ? confirm.amount : confirm?.kind === "accept" ? Number(confirm.offer.amount) : 0;
  const confirmNet = sellerNetPerDay(confirmAmount);

  return (
    <div className="border-t border-ocean/20 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Price & checkout</p>
          <p className="text-xs text-muted-foreground">Listed at {formatPrice(boat.daily_price, currency)} per day</p>
        </div>
        <span className="rounded-full bg-ocean-soft px-3 py-1 text-xs font-semibold text-ocean">{boat.price_negotiable ? "Negotiable" : "Fixed price"}</span>
      </div>

      {offersQuery.isError && <p className="mt-2 text-xs text-destructive">Prices could not be loaded.</p>}

      {offers.length > 0 && (
        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
          {offers.map((offer) => {
            const ownOffer = offer.sender_id === user.id;
            const amount = Number(offer.amount);
            const { net } = sellerNetPerDay(amount);
            const canRespond = !closed && offer.status === "pending" && !ownOffer;
            return (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">
                    {ownOffer ? "Your price" : isOwner ? "Buyer's price" : "Owner's price"}: {formatPrice(amount, currency)} / day
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {offerStatusLabel(offer.status)} · {format(parseISO(offer.created_at), "d MMM, HH:mm")}
                    {isOwner && offer.status !== "declined" && offer.status !== "countered" ? ` · you receive ${formatPrice(net, currency)} / day` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canRespond && (
                    <>
                      <Button type="button" size="sm" variant="ocean" disabled={busy} onClick={() => (isOwner ? setConfirm({ kind: "accept", offer }) : respond.mutate({ offerId: offer.id, status: "accepted" }))}>
                        <Check /> Accept
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => respond.mutate({ offerId: offer.id, status: "declined" })}>
                        <X /> Decline
                      </Button>
                    </>
                  )}
                  {isOwner && canOwnerCancel(offer.status) && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "cancel", offer })}>
                      Cancel price
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paid && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Payment received. This deal can no longer be cancelled or changed.
        </p>
      )}

      {acceptedOffer && !paid && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            Price agreed at {formatPrice(Number(acceptedOffer.amount), currency)} per day.
            {isOwner ? " The buyer can pay at any time. You can cancel until they pay." : ""}
          </p>
          {!isOwner && canBuyerCheckout(acceptedOffer.status) && (
            <Button asChild size="sm" variant="ocean">
              <Link to="/checkout" search={{ offer: acceptedOffer.id }}>Review checkout</Link>
            </Button>
          )}
        </div>
      )}

      {!closed && !settled && (
        <>
          {waitingOnOther && <p className="mt-3 text-xs text-muted-foreground">Your price is waiting for the other person to respond.</p>}

          {!isOwner && !pendingOffer && (
            <Button type="button" variant="ocean" size="sm" className="mt-3" disabled={busy} onClick={() => sendOffer.mutate({ amount: boat.daily_price })}>
              {sendOffer.isPending ? <LoaderCircle className="animate-spin" /> : null}
              Request to buy at {formatPrice(boat.daily_price, currency)} / day
            </Button>
          )}

          {!waitingOnOther && canCounter && (
            <form className="mt-3 space-y-2" onSubmit={submitTyped}>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1 space-y-1.5">
                  <label htmlFor="offerAmount" className="text-xs font-medium">
                    {isOwner ? (pendingOffer ? "Your price per day (answers their offer)" : "Set a price per day") : pendingOffer ? "Counter price per day" : "Or negotiate: your price per day"}
                  </label>
                  <Input id="offerAmount" type="number" min="0.01" step="0.01" required value={amountInput} onChange={(event) => setAmountInput(event.currentTarget.value)} placeholder={String(boat.daily_price)} disabled={busy} />
                </div>
                <Button type="submit" variant="ocean" disabled={!amountInput || busy}>
                  {sendOffer.isPending ? <LoaderCircle className="animate-spin" /> : null}
                  {isOwner ? "Send price" : pendingOffer ? "Counter" : "Send offer"}
                </Button>
              </div>
              {isOwner && typedNet && (
                <p className="text-xs text-muted-foreground">
                  You would receive <strong>{formatPrice(typedNet.net, currency)}</strong> per day after the 3% DinghyCharter fee ({formatPrice(typedNet.fee, currency)}).
                </p>
              )}
            </form>
          )}

          {!isOwner && !boat.price_negotiable && pendingOffer && !waitingOnOther && (
            <p className="mt-3 text-xs text-muted-foreground">This boat has a fixed price on the listing, but the owner has offered a different price. You can accept or decline it.</p>
          )}
        </>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open && !busy) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "cancel" ? "Cancel this price?" : confirm?.kind === "accept" ? "Accept this price?" : "Send this price to the buyer?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {confirm?.kind === "cancel" ? (
                <div className="space-y-2 text-sm">
                  <p>The buyer will no longer be able to pay at {formatPrice(Number(confirm.offer.amount), currency)} per day. You can send a new price afterwards.</p>
                  <p>You can cancel until the buyer pays. After payment nothing can be cancelled.</p>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    Price: <strong>{formatPrice(confirmAmount, currency)}</strong> per day. You receive <strong>{formatPrice(confirmNet.net, currency)}</strong> per day after the 3% DinghyCharter fee ({formatPrice(confirmNet.fee, currency)}).
                  </p>
                  <p>From this moment the buyer can pay at any time. You can cancel this price until the buyer pays. After payment nothing can be cancelled.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (!confirm) return;
                if (confirm.kind === "send") sendOffer.mutate({ amount: confirm.amount, counterOfferId: confirm.counterOfferId });
                else if (confirm.kind === "accept") respond.mutate({ offerId: confirm.offer.id, status: "accepted" });
                else cancel.mutate(confirm.offer.id);
              }}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : null}
              {confirm?.kind === "cancel" ? "Cancel price" : confirm?.kind === "accept" ? "Accept and allow payment" : "Send price"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
