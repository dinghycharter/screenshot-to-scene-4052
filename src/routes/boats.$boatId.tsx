import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import { Anchor, Check, ChevronLeft, MapPin, Share2, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { getBoat } from "@/lib/catalog.functions";
import { PhotoGallery } from "@/components/boats/PhotoGallery";
import { BookingPanel } from "@/components/boats/BookingPanel";
import { SaveButton } from "@/components/boats/SaveButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, formatDateRange, formatPrice, initials } from "@/lib/format";
import { isWithinRanges } from "@/lib/availability";

const boatQuery = (id: string) => queryOptions({ queryKey: ["boat", id], queryFn: () => getBoat({ data: { id } }) });

export const Route = createFileRoute("/boats/$boatId")({
  loader: async ({ context, params }) => {
    const boat = await context.queryClient.ensureQueryData(boatQuery(params.boatId)).catch(() => null);
    if (!boat) throw notFound();
    return { title: boat.title, className: boat.class?.name, city: boat.city, country: boat.country, price: boat.daily_price, currency: boat.currency };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Boat unavailable — DinghyCharter" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.title} · ${loaderData.className} charter in ${loaderData.city} — DinghyCharter`;
    const description = `Charter this ${loaderData.className} in ${loaderData.city}, ${loaderData.country} from ${formatPrice(loaderData.price, loaderData.currency)} per day.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="container-page py-32 text-center">
      <h1 className="text-3xl font-semibold">This boat isn't available</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed by its owner.</p>
      <Link to="/search" className="mt-6 inline-block font-semibold text-ocean">Browse other boats →</Link>
    </div>
  ),
  component: BoatPage,
});

function BoatPage() {
  const { boatId } = Route.useParams();
  const { data: boat } = useSuspenseQuery(boatQuery(boatId));
  if (!boat) return null;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const specs = Object.entries(boat.specs);
  const firstMonth = boat.availability[0] ? parseISO(boat.availability[0].start_date) : new Date();

  return (
    <div className="container-page pb-24 pt-6 md:pt-8">
      <div className="flex items-center justify-between">
        <Link to="/search" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All boats
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={share} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <SaveButton boatId={boat.id} variant="inline" />
        </div>
      </div>

      <div className="mt-4">
        <h1 className="text-balance text-3xl font-semibold md:text-[40px] md:leading-tight">{boat.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="rounded-full bg-ocean-soft px-2.5 py-0.5 font-semibold text-ocean">{boat.class?.name}</span>
          {boat.rating != null && (
            <span className="flex items-center gap-1 font-semibold">
              <Star className="h-4 w-4 fill-star text-star" /> {boat.rating.toFixed(2)}
              <span className="font-normal text-muted-foreground">· {boat.reviewCount} reviews</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{boat.city}, {boat.country}</span>
        </div>
      </div>

      <div className="mt-6">
        <PhotoGallery photos={boat.photoUrls} title={boat.title} />
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 divide-y divide-border">
          {/* Owner summary */}
          <div className="flex items-center justify-between gap-4 pb-8">
            <div>
              <h2 className="font-sans text-xl font-semibold tracking-normal">
                {boat.manufacturer} {boat.model}{boat.year ? ` · ${boat.year}` : ""}
              </h2>
              <p className="mt-1 text-muted-foreground">
                Offered by {boat.owner?.full_name}{boat.sail_number ? ` · Sail no. ${boat.sail_number}` : ""}
              </p>
            </div>
            <Avatar className="h-14 w-14">
              <AvatarImage src={boat.ownerAvatar ?? undefined} alt={boat.owner?.full_name} />
              <AvatarFallback className="bg-navy text-navy-foreground">{initials(boat.owner?.full_name ?? "")}</AvatarFallback>
            </Avatar>
          </div>

          <section className="py-8">
            <h2 className="text-xl font-semibold">About this boat</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{boat.description}</p>
            <p className="mt-4 text-sm"><span className="font-semibold">Condition:</span> <span className="text-muted-foreground">{boat.condition}</span></p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Cancellation policy</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{boat.cancellation_policy}</p>
          </section>

          {boat.equipment.length > 0 && (
            <section className="py-8">
              <h2 className="text-xl font-semibold">Equipment included</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {boat.equipment.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ocean-soft text-ocean"><Check className="h-4 w-4" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {specs.length > 0 && (
            <section className="py-8">
              <h2 className="text-xl font-semibold">Specifications</h2>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Class", boat.class?.name ?? ""],
                  ["Builder", boat.manufacturer],
                  ...(boat.year ? [["Year", String(boat.year)]] : []),
                  ...specs,
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface p-4">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-1 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="py-8">
            <h2 className="text-xl font-semibold">Pickup location</h2>
            <div className="mt-4 flex items-start gap-4 rounded-2xl border border-border p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy text-navy-foreground"><Anchor className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold">{boat.pickup_location || `${boat.city}, ${boat.country}`}</p>
                <p className="text-sm text-muted-foreground">{boat.city}, {boat.country}. Exact handover details are shared after confirmation.</p>
              </div>
            </div>
            {boat.events.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {boat.events.map((e) => (
                  <Link key={e.slug} to="/search" search={{ event: e.slug }} className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm hover:border-ocean/40 hover:bg-ocean-soft">
                    <Trophy className="h-3.5 w-3.5 text-ocean" /> {e.name} · {formatDateRange(e.start_date, e.end_date)}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {boat.availability.length ? `Open for ${boat.availability.length} period${boat.availability.length > 1 ? "s" : ""}` : "No open dates — message the owner."}
            </p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-border p-2">
              <Calendar
                mode="single"
                numberOfMonths={2}
                defaultMonth={firstMonth}
                modifiers={{
                  available: (d) => isWithinRanges(d, boat.availability) && !isWithinRanges(d, boat.bookedRanges),
                  booked: (d) => isWithinRanges(d, boat.bookedRanges),
                }}
                modifiersClassNames={{
                  available: "[&>button]:bg-ocean-soft [&>button]:text-ocean [&>button]:font-semibold",
                  booked: "[&>button]:line-through [&>button]:text-muted-foreground",
                }}
                className="mx-auto"
              />
            </div>
            <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-ocean-soft ring-1 ring-ocean/30" /> Available</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-muted" /> Booked / unavailable</span>
            </div>
            {boat.availability.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {boat.availability.map((a) => (
                  <li key={a.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{formatDateRange(a.start_date, a.end_date)}</span>
                    {a.note ? ` · ${a.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="py-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {boat.rating != null ? (
                <>
                  <Star className="h-5 w-5 fill-star text-star" /> {boat.rating.toFixed(2)} · {boat.reviewCount} review{boat.reviewCount === 1 ? "" : "s"}
                </>
              ) : "No reviews yet"}
            </h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              {boat.reviews.map((r) => (
                <figure key={r.id}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={r.reviewerAvatar ?? undefined} />
                      <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(r.reviewer?.full_name ?? "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <figcaption className="text-sm font-semibold">{r.reviewer?.full_name}</figcaption>
                      <p className="text-xs text-muted-foreground">{r.reviewer?.country} · {formatDate(r.created_at.slice(0, 10), "MMMM yyyy")}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-star text-star" : "text-border"}`} />
                    ))}
                  </div>
                  <blockquote className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.comment}</blockquote>
                </figure>
              ))}
            </div>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Meet the owner</h2>
            <div className="mt-5 grid gap-6 rounded-3xl bg-surface p-6 sm:grid-cols-[220px_1fr] md:p-8">
              <div className="rounded-2xl bg-card p-6 text-center shadow-card">
                <Avatar className="mx-auto h-20 w-20">
                  <AvatarImage src={boat.ownerAvatar ?? undefined} />
                  <AvatarFallback className="bg-navy text-xl text-navy-foreground">{initials(boat.owner?.full_name ?? "")}</AvatarFallback>
                </Avatar>
                <p className="mt-3 text-lg font-semibold">{boat.owner?.full_name}</p>
                <p className="text-xs text-muted-foreground">Boat owner</p>
                <div className="mt-4 grid grid-cols-2 divide-x divide-border border-t border-border pt-4 text-sm">
                  <div><p className="font-bold">{boat.reviewCount}</p><p className="text-xs text-muted-foreground">Reviews</p></div>
                  <div><p className="font-bold">{boat.rating?.toFixed(1) ?? "–"}</p><p className="text-xs text-muted-foreground">Rating</p></div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {boat.owner?.bio && <p className="leading-relaxed text-muted-foreground">{boat.owner.bio}</p>}
                {boat.owner?.home_club && <p><span className="font-semibold">Club:</span> {boat.owner.home_club}</p>}
                {boat.owner?.country && <p><span className="font-semibold">Based in:</span> {boat.owner.country}</p>}
                {boat.owner?.languages?.length ? <p><span className="font-semibold">Speaks:</span> {boat.owner.languages.join(", ")}</p> : null}
                <p><span className="font-semibold">Boats listed:</span> {boat.ownerBoatCount}</p>
                <p className="pt-2 text-xs text-muted-foreground">To protect your booking, never pay or communicate outside DinghyCharter.</p>
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="lg:sticky lg:top-24">
            <BookingPanel
              boatId={boat.id}
              ownerId={boat.owner_id}
              dailyPrice={boat.daily_price}
              deposit={boat.security_deposit}
              currency={boat.currency}
              availability={boat.availability}
              booked={boat.bookedRanges}
              events={boat.events.map((e) => ({ slug: e.slug, name: e.name }))}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
