import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Star } from "lucide-react";
import type { BoatCardData } from "@/lib/catalog.functions";
import { formatDateRange, formatPrice } from "@/lib/format";
import { SaveButton } from "@/components/boats/SaveButton";
import { ClassNameWithLogo } from "@/components/boats/ClassNameWithLogo";

export function BoatCard({ boat, index = 0 }: { boat: BoatCardData; index?: number }) {
  const shown = boat.availability.slice(0, 2);
  return (
    <Link
      to="/boats/$boatId"
      params={{ boatId: boat.id }}
      className="group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {boat.photo ? (
          <img
            src={boat.photo}
            alt={boat.title}
            loading="lazy"
            width={1280}
            height={960}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">No photo yet</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/95 px-2.5 py-1 text-xs font-bold text-navy shadow-soft dark:text-foreground">
          <ClassNameWithLogo name={boat.className} slug={boat.classSlug} logoClassName="h-3.5 w-6" />
        </span>
        <SaveButton boatId={boat.id} className="absolute right-3 top-3" />
      </div>

      <div className="mt-3.5 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-sans text-[15px] font-semibold tracking-normal">{boat.title}</h3>
          {boat.rating != null ? (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-star text-star" />
              {boat.rating.toFixed(1)}
              <span className="text-muted-foreground">({boat.reviewCount})</span>
            </span>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-ocean">New</span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {boat.city}, {boat.country}
        </p>
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {shown.length ? (
            <span className="flex flex-wrap gap-x-2 gap-y-0.5">
              {shown.map((window) => (
                <span key={`${window.start_date}-${window.end_date}`} className="font-medium text-foreground">{formatDateRange(window.start_date, window.end_date)}</span>
              ))}
              {boat.availability.length > shown.length && <span className="text-xs">+{boat.availability.length - shown.length} more</span>}
            </span>
          ) : (
            <span>Dates on request</span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1.5">
          <p className="text-[15px]">
            <span className="font-bold">{formatPrice(boat.dailyPrice, boat.currency)}</span>
            <span className="text-muted-foreground"> / day</span>
          </p>
          <span className="rounded-lg px-2.5 py-1 text-sm font-semibold text-ocean transition-colors group-hover:bg-ocean-soft">
            View boat →
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BoatCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] rounded-2xl bg-muted" />
      <div className="mt-3.5 h-4 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
    </div>
  );
}
