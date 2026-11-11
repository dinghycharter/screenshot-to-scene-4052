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
import { DateRangeField } from "@/components/offers/DateRangeField";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isRangeBookable, type Range } from "@/lib/availability";
import { formatDateRange } from "@/lib/format";
import { canBuyerCheckout, canOwnerCancel, formatMoney, hasPaidOffer, hasSettledOffer, offerStatusLabel, offerTotals } from "@/lib/offers";

type PriceOffer = Tables<"price_offers">;

type Props = {
  conversationId: string;
  ownerId: string;
  boat: { id: string; daily_price: number; currency: string; price_negotiable: boolean };
  closed: boolean;
};

type Confirm =
  | { kind: "send"; amount: number; startDate: string; endDate: string; counterOfferId?: string }
  | { kind: "accept"; offer: PriceOffer }
  | { kind: "cancel"; offer: PriceOffer };

export const priceOffersKey = (conversationId: string) => ["price-offers", conversationId] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  accepted: "bg-emerald-50 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-900",
  declined: "bg-secondary text-muted-foreground",
  countered: "bg-secondary text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

/**
 * Dates, price and checkout of a conversation. The price is per day and applies to the chosen dates.
 * 1. The buyer picks dates the boat is open for and asks to buy (listed price) or proposes a price.
 * 2. The owner accepts, or answers with another price and/or other dates (the owner can always do this).
 * 3. The buyer accepts the agreed price and reviews checkout.
 * The owner can cancel any unpaid price; once paid, nothing can be changed.
 */
export function OfferPanel({ conversationId, ownerId, boat, closed }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const isOwner = user?.id === ownerId;
  const currency = boat.currency;
  const today = format(new Date(), "yyyy-MM-dd");

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

  const datesQuery = useQuery({
    queryKey: ["boat-open-dates", boat.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<{ availability: Range[]; booked: Range[] }> => {
      const [availability, booked] = await Promise.all([
        supabase.from("availability").select("start_date, end_date").eq("boat_id", boat.id).gte("end_date", today).order("start_date"),
        supabase.rpc("boat_booked_ranges", { _boat_id: boat.id }),
      ]);
      if (availability.error) throw availability.error;
      return { availability: availability.data ?? [], booked: booked.data ?? [] };
    },
  });
  const availability = datesQuery.data?.availability ?? [];
  const booked = datesQuery.data?.booked ?? [];

  const offers = offersQuery.data ?? [];
  const pendingOffer = [...offers].reverse().find((offer) => offer.status === "pending") ?? null;
  const acceptedOffer = [...offers].reverse().find((offer) => offer.status === "accepted") ?? null;
  const settled = hasSettledOffer(offers);
  const paid = hasPaidOffer(offers);
  const waitingOnOther = pendingOffer?.sender_id === user?.id;
  const canCounter = isOwner || boat.price_negotiable;

  // Dates default to the ones in the offer being answered; either side can change them.
  const startDate = startInput || pendingOffer?.start_date || "";
  const endDate = endInput || (startInput ? "" : (pendingOffer?.end_date ?? ""));
  const typedAmount = Number(amountInput);
  const hasAmount = Number.isFinite(typedAmount) && typedAmount > 0;
  const datesChosen = !!startDate && !!endDate && endDate >= startDate && startDate >= today;
  const datesAllowed = datesChosen && (isOwner || isRangeBookable(startDate, endDate, availability, booked));
  const listedTotals = offerTotals(boat.daily_price, startDate, endDate);
  const typedTotals = hasAmount ? offerTotals(typedAmount, startDate, endDate) : null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: priceOffersKey(conversationId) });
  };

  const sendOffer = useMutation({
    mutationFn: async ({ amount, startDate: from, endDate: to, counterOfferId }: { amount: number; startDate: string; endDate: string; counterOfferId?: string }) => {
      if (!user) throw new Error("Sign in to send a price.");
      if (closed) throw new Error("This conversation has been closed.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid daily price.");
      if (!from || !to) throw new Error("Choose the charter dates.");
      if (to < from) throw new Error("The return date must be on or after the pick-up date.");
      if (from < today) throw new Error("The pick-up date can't be in the past.");
      if (!isOwner && !isRangeBookable(from, to, availability, booked)) throw new Error("Choose dates inside one open period of this boat.");
      if (counterOfferId) {
        const { data, error } = await supabase.from("price_offers").update({ status: "countered" }).eq("id", counterOfferId).eq("status", "pending").select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("That price was already answered. Refresh and try again.");
      }
      const { error } = await supabase.from("price_offers").insert({ conversation_id: conversationId, sender_id: user.id, amount, start_date: from, end_date: to });
      if (error) throw error;
    },
    onSuccess: () => {
      setAmountInput("");
      setStartInput("");
      setEndInput("");
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

  // Step 1 buyer asks, 2 owner replies, 3 buyer confirms. Done once accepted.
  const step = settled ? 4 : pendingOffer ? (pendingOffer.sender_id === ownerId ? 3 : 2) : 1;

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    if (!hasAmount || !datesAllowed) return;
    const request = { amount: typedAmount, startDate, endDate, counterOfferId: pendingOffer?.id };
    if (isOwner) setConfirm({ kind: "send", ...request });
    else sendOffer.mutate(request);
  };

  const confirmOffer = confirm?.kind === "accept" ? confirm.offer : null;
  const confirmAmount = confirm?.kind === "send" ? confirm.amount : confirmOffer ? Number(confirmOffer.amount) : 0;
  const confirmFrom = confirm?.kind === "send" ? confirm.startDate : confirmOffer?.start_date;
  const confirmTo = confirm?.kind === "send" ? confirm.endDate : confirmOffer?.end_date;
  const confirmTotals = offerTotals(confirmAmount, confirmFrom, confirmTo);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Dates & price</p>
            <p className="text-xs text-muted-foreground">Listed at {formatMoney(boat.daily_price, currency)} per day</p>
          </div>
          <span className="rounded-full bg-ocean-soft px-2.5 py-1 text-[11px] font-semibold text-ocean">{boat.price_negotiable ? "Negotiable" : "Fixed price"}</span>
        </div>

        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-medium leading-tight">
          {["Buyer asks", "Owner replies", "Buyer confirms"].map((label, index) => {
            const done = step > index + 1;
            const current = step === index + 1;
            return (
              <li key={label} className={`rounded-lg px-2 py-1.5 text-center ${done ? "bg-emerald-50 text-emerald-800" : current ? "bg-ocean text-ocean-foreground" : "bg-secondary text-muted-foreground"}`}>
                {done ? <Check className="mx-auto mb-0.5 h-3 w-3" /> : <span className="block">{index + 1}</span>}
                {label}
              </li>
            );
          })}
        </ol>

        <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs">
          <p className="font-semibold">Open dates for this boat</p>
          {datesQuery.isLoading ? (
            <p className="mt-1 text-muted-foreground">Loading…</p>
          ) : availability.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {availability.map((window) => (
                <span key={`${window.start_date}-${window.end_date}`} className="rounded-full bg-background px-2.5 py-1 font-medium text-ocean ring-1 ring-ocean/20">
                  {formatDateRange(window.start_date, window.end_date)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-muted-foreground">No open dates listed. The owner can still offer dates.</p>
          )}
        </div>
      </div>

      {offersQuery.isError && <p className="text-xs text-destructive">Prices could not be loaded.</p>}

      {offers.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {offers.map((offer) => {
            const ownOffer = offer.sender_id === user.id;
            const amount = Number(offer.amount);
            const totals = offerTotals(amount, offer.start_date, offer.end_date);
            const canRespond = !closed && offer.status === "pending" && !ownOffer;
            const live = offer.status !== "declined" && offer.status !== "countered" && offer.status !== "cancelled";
            return (
              <div key={offer.id} className={`rounded-xl border p-3 ${live ? "border-border bg-card" : "border-border/60 bg-secondary/30 opacity-80"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{ownOffer ? "Your offer" : isOwner ? "Buyer's offer" : "Owner's offer"} · {format(parseISO(offer.created_at), "d MMM, HH:mm")}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[offer.status] ?? "bg-secondary"}`}>{offerStatusLabel(offer.status)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold">{formatMoney(amount, currency)} <span className="font-normal text-muted-foreground">per day</span></p>
                {offer.start_date && offer.end_date ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(offer.start_date, offer.end_date)} · {totals.days} {totals.days === 1 ? "day" : "days"} · <span className="font-medium text-foreground">{formatMoney(totals.subtotal, currency)} total</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No dates on this older offer.</p>
                )}
                {isOwner && live && totals.days > 0 && (
                  <p className="text-xs text-muted-foreground">You receive {formatMoney(totals.sellerNet, currency)} after the 3% fee.</p>
                )}
                {(canRespond || (isOwner && canOwnerCancel(offer.status))) && (
                  <div className="mt-2 flex flex-wrap gap-2">
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {paid && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Payment received. This deal can no longer be cancelled or changed.
        </p>
      )}

      {acceptedOffer && !paid && (
        <div className="space-y-2">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            Agreed: {formatMoney(Number(acceptedOffer.amount), currency)} per day
            {acceptedOffer.start_date && acceptedOffer.end_date ? ` for ${formatDateRange(acceptedOffer.start_date, acceptedOffer.end_date)}` : ""}.
            {isOwner ? " The buyer can pay at any time. You can cancel until they pay." : ""}
          </p>
          {!isOwner && canBuyerCheckout(acceptedOffer.status) && (
            <Button asChild size="sm" variant="ocean" className="w-full">
              <Link to="/checkout" search={{ offer: acceptedOffer.id }}>Review checkout</Link>
            </Button>
          )}
        </div>
      )}

      {!closed && !settled && (
        <div className="space-y-3 border-t border-border pt-4">
          {waitingOnOther && <p className="text-xs text-muted-foreground">Your offer is waiting for the other person to respond.</p>}

          {!waitingOnOther && (
            <form className="space-y-3" onSubmit={submitTyped}>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">
                  {isOwner ? (pendingOffer ? "Answer with your dates" : "Dates") : pendingOffer ? "Dates" : "Your dates"}
                  {!isOwner && <span className="font-normal text-muted-foreground"> · only open dates can be chosen</span>}
                </p>
                <DateRangeField
                  start={startDate}
                  end={endDate}
                  onChange={(from, to) => {
                    setStartInput(from);
                    setEndInput(to);
                  }}
                  availability={availability}
                  booked={booked}
                  restrictToAvailable={!isOwner}
                  disabled={busy}
                />
              </div>

              {!isOwner && !pendingOffer && (
                <Button type="button" variant="ocean" className="w-full" disabled={busy || !datesAllowed} onClick={() => sendOffer.mutate({ amount: boat.daily_price, startDate, endDate })}>
                  {sendOffer.isPending ? <LoaderCircle className="animate-spin" /> : null}
                  Request to buy at {formatMoney(boat.daily_price, currency)} / day
                </Button>
              )}
              {!isOwner && !pendingOffer && datesAllowed && listedTotals.days > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatMoney(boat.daily_price, currency)} × {listedTotals.days} {listedTotals.days === 1 ? "day" : "days"} = <strong className="text-foreground">{formatMoney(listedTotals.subtotal, currency)}</strong> before the buyer fee.
                </p>
              )}

              {canCounter && (
                <div className="space-y-1.5">
                  <label htmlFor="offerAmount" className="text-xs font-medium">
                    {isOwner ? (pendingOffer ? "Your price per day" : "Set a price per day") : pendingOffer ? "Counter price per day" : "Or propose your price per day"}
                  </label>
                  <div className="flex gap-2">
                    <Input id="offerAmount" type="number" min="0.01" step="0.01" value={amountInput} onChange={(event) => setAmountInput(event.currentTarget.value)} placeholder={String(boat.daily_price)} disabled={busy} className="h-10" />
                    <Button type="submit" variant="ocean" className="h-10" disabled={!hasAmount || !datesAllowed || busy}>
                      {sendOffer.isPending ? <LoaderCircle className="animate-spin" /> : null}
                      {isOwner ? "Send" : pendingOffer ? "Counter" : "Offer"}
                    </Button>
                  </div>
                  {typedTotals && typedTotals.days > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(typedAmount, currency)} × {typedTotals.days} {typedTotals.days === 1 ? "day" : "days"} = <strong className="text-foreground">{formatMoney(typedTotals.subtotal, currency)}</strong>
                      {isOwner && (
                        <>
                          . You receive <strong className="text-foreground">{formatMoney(typedTotals.sellerNet, currency)}</strong> after the 3% DinghyCharter fee ({formatMoney(typedTotals.sellerFee, currency)}).
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
            </form>
          )}

          {!isOwner && !boat.price_negotiable && pendingOffer && !waitingOnOther && (
            <p className="text-xs text-muted-foreground">This boat has a fixed price on the listing, but the owner has offered something different. You can accept or decline it.</p>
          )}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open && !busy) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "cancel" ? "Cancel this price?" : confirm?.kind === "accept" ? "Accept this offer?" : "Send this offer to the buyer?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {confirm?.kind === "cancel" ? (
                <div className="space-y-2 text-sm">
                  <p>The buyer will no longer be able to pay {formatMoney(Number(confirm.offer.amount), currency)} per day. You can send a new price afterwards.</p>
                  <p>You can cancel until the buyer pays. After payment nothing can be cancelled.</p>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>{formatMoney(confirmAmount, currency)}</strong> per day
                    {confirmFrom && confirmTo ? <> for <strong>{formatDateRange(confirmFrom, confirmTo)}</strong> ({confirmTotals.days} {confirmTotals.days === 1 ? "day" : "days"}, {formatMoney(confirmTotals.subtotal, currency)} total)</> : null}.
                  </p>
                  <p>
                    You receive <strong>{formatMoney(confirmTotals.sellerNet, currency)}</strong> after the 3% DinghyCharter fee ({formatMoney(confirmTotals.sellerFee, currency)}).
                  </p>
                  <p>From this moment the buyer can pay at any time. You can cancel until the buyer pays. After payment nothing can be cancelled.</p>
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
                if (confirm.kind === "send") sendOffer.mutate({ amount: confirm.amount, startDate: confirm.startDate, endDate: confirm.endDate, counterOfferId: confirm.counterOfferId });
                else if (confirm.kind === "accept") respond.mutate({ offerId: confirm.offer.id, status: "accepted" });
                else cancel.mutate(confirm.offer.id);
              }}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : null}
              {confirm?.kind === "cancel" ? "Cancel price" : confirm?.kind === "accept" ? "Accept and allow payment" : "Send offer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
