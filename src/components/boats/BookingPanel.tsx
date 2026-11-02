import { useState } from "react";
import { useLocation, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, Info, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateBookingTotal, countCharterDays } from "@/lib/booking";
import { isRangeBookable, isWithinRanges, type Range } from "@/lib/availability";
import { formatPrice } from "@/lib/format";
import { containsContactInfo } from "@/lib/contact-redaction";

type Props = {
  boatId: string;
  ownerId: string;
  dailyPrice: number;
  deposit: number;
  currency: string;
  availability: Range[];
  booked: Range[];
  events: { slug: string; name: string }[];
};

export function BookingPanel({ boatId, ownerId, dailyPrice, deposit, currency, availability, booked, events }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [range, setRange] = useState<DateRange | undefined>();
  const [message, setMessage] = useState("");
  const [eventSlug, setEventSlug] = useState<string>("none");
  const isOwner = user?.id === ownerId;

  const start = range?.from ? format(range.from, "yyyy-MM-dd") : null;
  const end = range?.to ? format(range.to, "yyyy-MM-dd") : start;
  const days = start && end ? countCharterDays(start, end) : 0;
  const total = start && end ? calculateBookingTotal(start, end, dailyPrice) : 0;
  const bookable = start && end ? isRangeBookable(start, end, availability, booked) : false;

  const requireAuth = () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: location.href } });
      return false;
    }
    return true;
  };

  const book = useMutation({
    mutationFn: async () => {
      let eventId: string | null = null;
      if (eventSlug !== "none") {
        const { data } = await supabase.from("events").select("id").eq("slug", eventSlug).maybeSingle();
        eventId = data?.id ?? null;
      }
      const { error } = await supabase.from("bookings").insert({
        boat_id: boatId,
        sailor_id: user!.id,
        owner_id: ownerId,
        start_date: start!,
        end_date: end!,
        message: message.trim() || null,
        event_id: eventId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking request sent", { description: "The owner will reply in your messages." });
      navigate({ to: "/dashboard/bookings" });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't send your request"),
  });

  const contact = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("boat_id", boatId)
        .eq("sailor_id", user!.id)
        .maybeSingle();
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ boat_id: boatId, sailor_id: user!.id, owner_id: ownerId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => navigate({ to: "/dashboard/messages", search: { c: id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isOwner) {
    return (
      <div className="rounded-2xl border border-border p-6 shadow-card">
        <p className="font-semibold">This is your boat</p>
        <p className="mt-1 text-sm text-muted-foreground">Manage photos, prices and availability from your dashboard.</p>
        <Button asChild className="mt-5 w-full" size="lg">
          <Link to="/dashboard/boats/$boatId" params={{ boatId }}>Edit boat</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
      <p className="text-2xl">
        <span className="font-bold">{formatPrice(dailyPrice, currency)}</span>
        <span className="text-base text-muted-foreground"> / day</span>
      </p>

      <Popover>
        <PopoverTrigger asChild>
          <button className="mt-5 grid w-full grid-cols-2 overflow-hidden rounded-xl border border-input text-left transition-colors hover:border-foreground/30">
            <span className="border-r border-input px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wider">Pick-up</span>
              <span className="text-sm text-muted-foreground">{start ? format(parseISO(start), "d MMM yyyy") : "Add date"}</span>
            </span>
            <span className="px-4 py-3">
              <span className="block text-[11px] font-bold uppercase tracking-wider">Return</span>
              <span className="text-sm text-muted-foreground">{end ? format(parseISO(end), "d MMM yyyy") : "Add date"}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
            defaultMonth={availability[0] ? parseISO(availability[0].start_date) : undefined}
            disabled={(d) => d < new Date(new Date().toDateString()) || !isWithinRanges(d, availability) || isWithinRanges(d, booked)}
          />
          <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Only the owner's available dates can be selected.
          </p>
        </PopoverContent>
      </Popover>

      {events.length > 0 && (
        <div className="mt-3">
          <Select value={eventSlug} onValueChange={setEventSlug}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Event (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific event</SelectItem>
              {events.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Textarea
        className="mt-3 min-h-[88px] rounded-xl"
        placeholder="Introduce yourself — your sailing level, weight, and plans for the boat."
        value={message}
        maxLength={2000}
        onChange={(e) => setMessage(e.target.value)}
      />
      {containsContactInfo(message) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Emails and phone numbers are hidden — keep the conversation on DinghyCharter.
        </p>
      )}

      <Button
        variant="ocean"
        size="lg"
        className="mt-4 w-full"
        disabled={!bookable || book.isPending}
        onClick={() => requireAuth() && book.mutate()}
      >
        {book.isPending ? "Sending request…" : "Request booking"}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">You won't be charged yet. The owner confirms first.</p>

      {days > 0 && (
        <div className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground underline decoration-dotted underline-offset-4">
              {formatPrice(dailyPrice, currency)} × {days} day{days > 1 ? "s" : ""}
            </span>
            <span>{formatPrice(total, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Security deposit (refundable)</span>
            <span>{formatPrice(deposit, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 font-semibold">
            <span>Charter total</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-2 border-t border-border pt-5">
        <Button variant="outline" onClick={() => requireAuth() && contact.mutate()} disabled={contact.isPending}>
          <MessageCircle /> Message the owner
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> All communication stays on DinghyCharter
        </p>
      </div>
    </div>
  );
}
