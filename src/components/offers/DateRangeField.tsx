import { useState } from "react";
import { format, parseISO, startOfToday } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isRangeBookable, isWithinRanges, type Range } from "@/lib/availability";
import { countCharterDays } from "@/lib/booking";
import { formatDateRange } from "@/lib/format";

type Props = {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  availability: Range[];
  booked: Range[];
  /** Buyers can only pick available dates. The owner may offer other dates. */
  restrictToAvailable: boolean;
  disabled?: boolean;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Range picker that shows a boat's open dates and, for buyers, only allows those. */
export function DateRangeField({ start, end, onChange, availability, booked, restrictToAvailable, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const today = startOfToday();
  const selected: DateRange | undefined = start ? { from: parseISO(start), to: end ? parseISO(end) : undefined } : undefined;
  const days = start && end ? countCharterDays(start, end) : 0;
  const outside = !!start && !!end && !isRangeBookable(start, end, availability, booked);

  const isOpenDay = (d: Date) => isWithinRanges(d, availability) && !isWithinRanges(d, booked);

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className="h-11 w-full justify-start gap-2 rounded-xl px-3 font-normal">
            <CalendarDays className="h-4 w-4 text-ocean" />
            {start && end ? (
              <span>
                {formatDateRange(start, end)} <span className="text-muted-foreground">· {days} {days === 1 ? "day" : "days"}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Choose dates</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={1}
            defaultMonth={selected?.from ?? (availability[0] ? parseISO(availability[0].start_date) : today)}
            selected={selected}
            onSelect={(range) => {
              if (!range?.from) {
                onChange("", "");
                return;
              }
              const from = iso(range.from);
              const to = range.to ? iso(range.to) : from;
              onChange(from, to);
              if (range.to && range.to > range.from) setOpen(false);
            }}
            disabled={(d) => d < today || (restrictToAvailable && !isOpenDay(d))}
            modifiers={{ open: (d) => isOpenDay(d), booked: (d) => isWithinRanges(d, booked) }}
            modifiersClassNames={{
              open: "[&>button]:bg-ocean-soft [&>button]:text-ocean [&>button]:font-semibold",
              booked: "[&>button]:line-through [&>button]:text-muted-foreground",
            }}
          />
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-ocean-soft align-middle ring-1 ring-ocean/30" />
            Blue days are open.{restrictToAvailable ? " Other days can't be chosen." : " As the owner you can offer other dates too."}
          </p>
        </PopoverContent>
      </Popover>
      {outside && restrictToAvailable && <p className="text-xs text-destructive">These dates must sit inside one open period of this boat.</p>}
      {outside && !restrictToAvailable && <p className="text-xs text-amber-700">These dates are outside the dates listed for this boat. The buyer will see them as your offer.</p>}
    </div>
  );
}
